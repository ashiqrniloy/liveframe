#!/usr/bin/env bun
/**
 * Emit the public API surface of a built Liveframe package root as deterministic JSON.
 *
 * Normalisation:
 * - Every `exports` subpath with a `types` target is opened through the TypeScript
 *   compiler API (`typescript/unstable/async`, `Checker.getExportsOfModule`).
 * - Each exported symbol (following `SymbolFlags.Alias` via `getAliasedSymbol`) has its
 *   declaration nodes printed with `Emitter.printNode`, plus any unexported top-level
 *   helper declarations in the subpath's defining `.d.ts` files that the declaration
 *   references transitively (for example `SurfaceProps` or `Emit`).
 * - Whitespace runs in every printed declaration collapse to a single ASCII space and
 *   leading/trailing whitespace is trimmed.
 * - Subpath names, exported symbol names, helper declaration names and file paths under
 *   `schemas/`, `conformance/corpus/`, `conformance/hash/` and `conformance/patch/` are
 *   sorted in UTF-16 code-unit order.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { API, type Project, type Symbol as TsSymbol, SymbolFlags } from "typescript/unstable/async";
import { type Node, SyntaxKind } from "typescript/unstable/ast";

export type ApiSurface = {
  readonly generatedFrom?: string;
  readonly exports: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly schemas: Readonly<Record<string, string>>;
  readonly corpus: Readonly<Record<string, string>>;
  readonly hash: Readonly<Record<string, string>>;
  readonly patch: Readonly<Record<string, string>>;
};

export type RegisterEntry = {
  readonly subpath: string;
  readonly name: string;
  readonly change: "added" | "widened" | "deferred";
  readonly reason: string;
  readonly hostAction: string;
  readonly task: number;
};

function normaliseText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isTopLevelStatement(node: Node): boolean {
  return (
    node.parent?.kind === SyntaxKind.SourceFile ||
    (node.kind === SyntaxKind.VariableDeclaration &&
      node.parent?.kind === SyntaxKind.VariableDeclarationList &&
      node.parent?.parent?.kind === SyntaxKind.VariableStatement &&
      node.parent?.parent?.parent?.kind === SyntaxKind.SourceFile)
  );
}

async function printSymbolDeclarations(project: Project, symbol: TsSymbol): Promise<string> {
  const parts: string[] = [];
  for (const handle of symbol.declarations ?? []) {
    const node = await handle.resolve(project);
    if (node) parts.push(normaliseText(await project.emitter.printNode(node)));
  }
  return parts.join(" ");
}

function collectIdentifiers(node: Node, out: Node[]): void {
  if (node.kind === SyntaxKind.Identifier) out.push(node);
  node.forEachChild((child) => {
    collectIdentifiers(child, out);
  });
}

function hashDirectory(root: string, subdir: string): Record<string, string> {
  const cwd = resolve(root, subdir);
  const files = [...new Bun.Glob("**/*").scanSync({ cwd, onlyFiles: true })].sort();
  const result: Record<string, string> = {};
  for (const file of files) {
    const bytes = readFileSync(resolve(cwd, file));
    result[`${subdir}/${file}`] = createHash("sha256").update(bytes).digest("hex");
  }
  return result;
}

export async function readApiSurface(packageRoot: string, generatedFrom?: string): Promise<ApiSurface> {
  const root = resolve(packageRoot);
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    exports: Record<string, unknown>;
  };

  const subpaths: Array<[string, string]> = [];
  for (const [subpath, target] of Object.entries(manifest.exports).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (target && typeof target === "object" && "types" in target && typeof target.types === "string") {
      subpaths.push([subpath, resolve(root, target.types)]);
    }
  }

  const api = new API({ cwd: root });
  try {
    const snapshot = await api.updateSnapshot({ openFiles: subpaths.map(([, file]) => file) });
    const firstFile = subpaths[0]?.[1];
    if (!firstFile) throw new Error(`No typed subpaths in ${root}/package.json`);
    const project = await snapshot.getDefaultProjectForFile(firstFile);
    if (!project) throw new Error(`TypeScript API could not load project for ${firstFile}`);

    const allExportedIds = new Set<number>();
    const loadedSubpaths: Array<{
      subpath: string;
      definingFiles: Set<string>;
      exports: Array<{ name: string; symbol: TsSymbol }>;
    }> = [];

    for (const [subpath, file] of subpaths) {
      const sourceFile = await project.program.getSourceFile(file);
      if (!sourceFile) throw new Error(`Missing declaration file: ${file}`);
      const moduleSymbol = await project.checker.getSymbolAtLocation(sourceFile);
      if (!moduleSymbol) throw new Error(`Missing module symbol: ${file}`);
      const moduleExports = await project.checker.getExportsOfModule(moduleSymbol);
      const definingFiles = new Set<string>([sourceFile.path]);
      const resolvedExports: Array<{ name: string; symbol: TsSymbol }> = [];
      for (const exp of moduleExports) {
        const symbol = exp.flags & SymbolFlags.Alias ? await project.checker.getAliasedSymbol(exp) : exp;
        allExportedIds.add(symbol.id);
        for (const handle of symbol.declarations ?? []) definingFiles.add(handle.path);
        resolvedExports.push({ name: exp.name, symbol });
      }
      resolvedExports.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      loadedSubpaths.push({ subpath, definingFiles, exports: resolvedExports });
    }

    const exportsMap: Record<string, Record<string, string>> = {};
    for (const { subpath, definingFiles, exports: resolvedExports } of loadedSubpaths) {
      const subpathDeclarations: Record<string, string> = {};
      for (const { name, symbol } of resolvedExports) {
        const primary = await printSymbolDeclarations(project, symbol);
        const helpers = new Map<string, string>();
        const visited = new Set<number>([symbol.id]);

        const scanHelpers = async (current: TsSymbol): Promise<void> => {
          for (const handle of current.declarations ?? []) {
            if (!definingFiles.has(handle.path)) continue;
            const decl = await handle.resolve(project);
            if (!decl) continue;
            const identifiers: Node[] = [];
            collectIdentifiers(decl, identifiers);
            if (!identifiers.length) continue;
            const referenced = await project.checker.getSymbolAtLocation(identifiers);
            for (const ref of referenced) {
              if (!ref) continue;
              const target = ref.flags & SymbolFlags.Alias ? await project.checker.getAliasedSymbol(ref) : ref;
              if (allExportedIds.has(target.id) || visited.has(target.id)) continue;
              const firstDecl = target.declarations?.[0];
              if (!firstDecl || !definingFiles.has(firstDecl.path)) continue;
              const resolvedDecl = await firstDecl.resolve(project);
              if (!resolvedDecl || !isTopLevelStatement(resolvedDecl)) continue;
              visited.add(target.id);
              helpers.set(target.name, await printSymbolDeclarations(project, target));
              await scanHelpers(target);
            }
          }
        };

        await scanHelpers(symbol);
        const sortedHelpers = [...helpers.entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([, text]) => text);
        subpathDeclarations[name] = [primary, ...sortedHelpers].join(" ");
      }
      exportsMap[subpath] = subpathDeclarations;
    }

    return {
      ...(generatedFrom ? { generatedFrom } : {}),
      exports: exportsMap,
      schemas: hashDirectory(root, "schemas"),
      corpus: hashDirectory(root, "conformance/corpus"),
      hash: hashDirectory(root, "conformance/hash"),
      patch: hashDirectory(root, "conformance/patch"),
    };
  } finally {
    await api.close();
  }
}

export function compareApiSurface(
  baseline: ApiSurface,
  current: ApiSurface,
  register: readonly RegisterEntry[],
): string[] {
  const failures: string[] = [];
  const usedEntries = new Set<number>();

  // 1. Corpus, hash and patch files are never allowed to change or disappear.
  for (const group of ["corpus", "hash", "patch"] as const) {
    for (const [file, expectedHash] of Object.entries(baseline[group])) {
      const actualHash = current[group][file];
      if (!actualHash) failures.push(`Removed ${group} file: ${file}`);
      else if (actualHash !== expectedHash) failures.push(`Changed ${group} file: ${file}`);
    }
  }

  // 2. Check schemas against baseline and register (subpath "./schemas/*").
  for (const [file, expectedHash] of Object.entries(baseline.schemas)) {
    const actualHash = current.schemas[file];
    const name = file.replace(/^schemas\//, "");
    const entryIndex = register.findIndex((e) => e.subpath === "./schemas/*" && (e.name === name || e.name === file));
    const entry = entryIndex >= 0 ? register[entryIndex] : undefined;
    if (entryIndex >= 0) usedEntries.add(entryIndex);

    if (!actualHash) {
      failures.push(`Removed schema file: ${file}`);
    } else if (actualHash !== expectedHash) {
      if (!entry) failures.push(`Schema changed without a register entry: ${file}`);
      else if (entry.change === "deferred")
        failures.push(`Deferred schema change must not ship: ${file} (task ${entry.task})`);
    } else if (entry && entry.change !== "deferred") {
      failures.push(`Stale register entry (schema did not change): ./schemas/* ${entry.name}`);
    }
  }
  for (const file of Object.keys(current.schemas)) {
    if (Object.hasOwn(baseline.schemas, file)) continue;
    const name = file.replace(/^schemas\//, "");
    const entryIndex = register.findIndex((e) => e.subpath === "./schemas/*" && (e.name === name || e.name === file));
    const entry = entryIndex >= 0 ? register[entryIndex] : undefined;
    if (entryIndex >= 0) usedEntries.add(entryIndex);
    if (entry?.change !== "added") {
      failures.push(`Added schema without an 'added' register entry: ${file}`);
    }
  }

  // 3. Check exported declarations across all subpaths.
  const allSubpaths = new Set([...Object.keys(baseline.exports), ...Object.keys(current.exports)]);
  for (const subpath of [...allSubpaths].sort()) {
    const baseSub = baseline.exports[subpath];
    const currSub = current.exports[subpath];
    if (!currSub) {
      failures.push(`Removed export subpath: ${subpath}`);
      continue;
    }
    if (!baseSub) {
      for (const name of Object.keys(currSub).sort()) {
        const entryIndex = register.findIndex((e) => e.subpath === subpath && e.name === name);
        const entry = entryIndex >= 0 ? register[entryIndex] : undefined;
        if (entryIndex >= 0) usedEntries.add(entryIndex);
        if (entry?.change !== "added") {
          failures.push(`Added export without an 'added' register entry: ${subpath} ${name}`);
        }
      }
      continue;
    }

    for (const [name, expectedDecl] of Object.entries(baseSub)) {
      const actualDecl = currSub[name];
      const entryIndex = register.findIndex((e) => e.subpath === subpath && e.name === name);
      const entry = entryIndex >= 0 ? register[entryIndex] : undefined;
      if (entryIndex >= 0) usedEntries.add(entryIndex);

      if (actualDecl === undefined) {
        failures.push(`Removed export: ${subpath} ${name}`);
      } else if (actualDecl !== expectedDecl) {
        if (!entry) {
          failures.push(`Declaration changed without a register entry: ${subpath} ${name}`);
        } else if (entry.change === "deferred") {
          failures.push(
            `Deferred register entry shipped a declaration change: ${subpath} ${name} (task ${entry.task})`,
          );
        } else if (entry.change !== "widened") {
          failures.push(`Existing export changed with '${entry.change}' instead of 'widened': ${subpath} ${name}`);
        }
      } else if (entry && entry.change !== "deferred") {
        failures.push(`Stale register entry (declaration did not change): ${subpath} ${name}`);
      }
    }

    for (const name of Object.keys(currSub)) {
      if (Object.hasOwn(baseSub, name)) continue;
      const entryIndex = register.findIndex((e) => e.subpath === subpath && e.name === name);
      const entry = entryIndex >= 0 ? register[entryIndex] : undefined;
      if (entryIndex >= 0) usedEntries.add(entryIndex);
      if (!entry) {
        failures.push(`Added export without a register entry: ${subpath} ${name}`);
      } else if (entry.change === "deferred") {
        failures.push(`Deferred register entry shipped a new export: ${subpath} ${name} (task ${entry.task})`);
      } else if (entry.change !== "added") {
        failures.push(`New export registered as '${entry.change}' instead of 'added': ${subpath} ${name}`);
      }
    }
  }

  // 4. Any unused register entry (unless deferred and not in baseline, which still must not ship).
  for (const [index, entry] of register.entries()) {
    if (usedEntries.has(index)) continue;
    if (entry.change !== "deferred") {
      failures.push(`Stale register entry (target not found or unchanged): ${entry.subpath} ${entry.name}`);
    }
  }

  return failures;
}

if (import.meta.main) {
  const usage = "Usage: bun scripts/release/api-surface.ts <packageRoot> [--out <file>] [--from <command-description>]";
  const argv = process.argv.slice(2);
  let packageRoot = "";
  let out = "";
  let generatedFrom: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) out = argv[++i] as string;
    else if (arg === "--from" && argv[i + 1]) generatedFrom = argv[++i] as string;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    } else if (arg && !arg.startsWith("-") && !packageRoot) {
      packageRoot = arg;
    } else {
      console.error(`${usage}\nUnknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!packageRoot) {
    console.error(usage);
    process.exit(2);
  }
  const surface = await readApiSurface(packageRoot, generatedFrom);
  const json = `${JSON.stringify(surface, null, 2)}\n`;
  if (out) await Bun.write(out, json);
  else process.stdout.write(json);
}
