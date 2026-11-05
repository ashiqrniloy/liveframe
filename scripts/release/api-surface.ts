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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Node, SyntaxKind } from "typescript/unstable/ast";
import { API, type Project, SymbolFlags, type Symbol as TsSymbol } from "typescript/unstable/async";

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
  readonly change: "added" | "widened" | "deferred" | "removed" | "changed";
  readonly reason: string;
  readonly hostAction: string;
  readonly task: number | string;
  readonly migration?: string;
  readonly behavior?: { readonly file: string; readonly test: string };
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
  migrationGuide = readFileSync(new URL("../../docs/migration-0.3.md", import.meta.url), "utf8"),
): string[] {
  const failures: string[] = [];
  const usedEntries = new Set<number>();
  const prose = migrationGuide.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, "");
  const headings = new Set([...prose.matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)].map((match) => match[1]));
  for (const entry of register) {
    if (entry.change !== "removed" && entry.change !== "changed") continue;
    if (!entry.migration?.trim() || !headings.has(entry.migration)) {
      failures.push(`Migration heading not found: ${entry.subpath} ${entry.name} (${entry.migration ?? ""})`);
    }
  }

  // 1. Existing corpus, hash and patch files need a documented break to change.
  for (const group of ["corpus", "hash", "patch"] as const) {
    for (const [file, expectedHash] of Object.entries(baseline[group])) {
      const actualHash = current[group][file];
      const entryIndex = register.findIndex((e) => e.subpath === `./conformance/${group}/*` && e.name === file);
      const entry = register[entryIndex];
      if (entryIndex >= 0) usedEntries.add(entryIndex);
      if (!actualHash) {
        if (entry?.change !== "removed") failures.push(`Removed ${group} file: ${file}`);
      } else if (actualHash !== expectedHash) {
        if (entry?.change !== "changed") failures.push(`Changed ${group} file: ${file}`);
      } else if (entry && entry.change !== "deferred") {
        failures.push(`Stale register entry (${group} file did not change): ${file}`);
      }
    }
    for (const file of Object.keys(current[group])) {
      if (Object.hasOwn(baseline[group], file)) continue;
      const index = register.findIndex((e) => e.subpath === `./conformance/${group}/*` && e.name === file);
      if (index < 0) continue;
      usedEntries.add(index);
      if (register[index]?.change !== "added") failures.push(`New ${group} file must be registered as added: ${file}`);
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
      if (entry?.change !== "removed") failures.push(`Removed schema file: ${file}`);
    } else if (actualHash !== expectedHash) {
      if (!entry) failures.push(`Schema changed without a register entry: ${file}`);
      else if (entry.change === "deferred")
        failures.push(`Deferred schema change must not ship: ${file} (task ${entry.task})`);
      else if (entry.change !== "widened" && entry.change !== "changed")
        failures.push(`Existing schema changed with '${entry.change}': ${file}`);
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
    const currSub = current.exports[subpath] ?? {};
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
        if (entry?.change !== "removed") failures.push(`Removed export: ${subpath} ${name}`);
      } else if (actualDecl !== expectedDecl) {
        if (!entry) {
          failures.push(`Declaration changed without a register entry: ${subpath} ${name}`);
        } else if (entry.change === "deferred") {
          failures.push(
            `Deferred register entry shipped a declaration change: ${subpath} ${name} (task ${entry.task})`,
          );
        } else if (entry.change !== "widened" && entry.change !== "changed") {
          failures.push(
            `Existing export changed with '${entry.change}' instead of 'widened' or 'changed': ${subpath} ${name}`,
          );
        }
      } else if (entry && entry.change !== "deferred" && !behaviorEvidence(entry)) {
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

/** Behavior-only breaks name a regression test run by the full check. */
function behaviorEvidence(entry: RegisterEntry): boolean {
  const evidence = entry.behavior;
  return (
    entry.change === "changed" &&
    !!evidence &&
    /^src\/__tests__\/[a-zA-Z0-9_/-]+\.test\.tsx?$/.test(evidence.file) &&
    !evidence.file.includes("..") &&
    existsSync(evidence.file) &&
    readFileSync(evidence.file, "utf8").includes(`test("${evidence.test}"`)
  );
}
