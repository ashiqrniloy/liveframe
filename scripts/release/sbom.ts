#!/usr/bin/env bun
/**
 * Write a CycloneDX 1.6 JSON SBOM of what ships: the runtime dependency closure (`dependencies` in package.json,
 * resolved through bun.lock) plus the packages bundled into `dist/` at build time, read from
 * `dist/pack/THIRD-PARTY-LICENSES`. Run it after `bun run build`. Dev and peer dependencies are not shipped.
 *
 *   timeout 60s bun scripts/release/sbom.ts --out sbom.cdx.json
 *
 * bun.lock is JSONC (trailing commas), read with `Bun.JSONC`. It records no licences, so each one is read
 * from the installed package.json when `node_modules` has it, and left out otherwise.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type LockEntry = [ident: string, registry: string, meta: Record<string, unknown>, integrity?: string];
export type Lock = {
  workspaces: { "": { dependencies?: Record<string, string> } };
  packages: Record<string, LockEntry>;
};
export type PackageJson = { name: string; version: string; license?: string; dependencies?: Record<string, string> };

export type Component = {
  type: "library";
  "bom-ref": string;
  name: string;
  version: string;
  purl: string;
  hashes?: { alg: string; content: string }[];
  licenses?: { license: { id: string } }[];
  properties?: { name: string; value: string }[];
};

export type Bundled = { name: string; version: string };

/** The packages the build bundled into `dist/`, from the `### name@version` headings of its licence file. */
export function readBundled(root: string): Bundled[] {
  const file = join(root, "dist/pack/THIRD-PARTY-LICENSES");
  if (!existsSync(file)) throw new Error("dist/pack/THIRD-PARTY-LICENSES is missing: run `bun run build` first");
  const found = [...readFileSync(file, "utf8").matchAll(/^### (\S+)@(\S+)$/gm)].map(([, name, version]) => ({
    name: name as string,
    version: version as string,
  }));
  if (found.length === 0) throw new Error("dist/pack/THIRD-PARTY-LICENSES lists no bundled packages");
  return found;
}

const algorithms: Record<string, string> = { sha512: "SHA-512", sha384: "SHA-384", sha256: "SHA-256", sha1: "SHA-1" };

function split(ident: string): { name: string; version: string } {
  const at = ident.lastIndexOf("@");
  return { name: ident.slice(0, at), version: ident.slice(at + 1) };
}

/** `a/b` is `b` nested under `a`; a scope (`@s/n`) is one name segment. */
function segments(key: string): string[] {
  const parts = key.split("/");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] as string;
    out.push(part.startsWith("@") ? `${part}/${parts[++i]}` : part);
  }
  return out;
}

function purlOf(name: string, version: string): string {
  return `pkg:npm/${name.replace(/^@/, "%40")}@${version}`;
}

function hashOf(integrity: string | undefined): { alg: string; content: string }[] | undefined {
  const match = /^([a-z0-9]+)-(.+)$/.exec(integrity ?? "");
  const alg = match?.[1] ? algorithms[match[1]] : undefined;
  if (!match?.[2] || !alg) return undefined;
  return [{ alg, content: Buffer.from(match[2], "base64").toString("hex") }];
}

/** The lock keys of the runtime closure, in discovery order from the root's `dependencies`. */
export function closure(lock: Lock, pkg: PackageJson): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  const resolve = (from: string, dep: string): string | undefined => {
    let scope = from ? segments(from) : [];
    for (;;) {
      const key = [...scope, dep].join("/");
      if (lock.packages[key]) return key;
      if (scope.length === 0) return undefined;
      scope = scope.slice(0, -1);
    }
  };
  const visit = (key: string, deps: Record<string, string>): void => {
    if (edges.has(key)) return;
    const children: string[] = [];
    edges.set(key, children);
    for (const dep of Object.keys(deps)) {
      // For a package at `a/b`, its own nested dependencies live under `a/b/`, then `a/`, then the top level.
      const target = resolve(key, dep);
      if (!target) continue;
      children.push(target);
      visit(target, depsOf(lock.packages[target] as LockEntry));
    }
  };
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    const target = resolve("", dep);
    if (!target) throw new Error(`bun.lock has no entry for dependency ${dep}`);
    visit(target, depsOf(lock.packages[target] as LockEntry));
  }
  return edges;
}

function depsOf(entry: LockEntry): Record<string, string> {
  const meta = entry[2] as { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
  return { ...meta.optionalDependencies, ...meta.dependencies };
}

export function buildSbom(
  pkg: PackageJson,
  lock: Lock,
  licenseOf: (key: string) => string | undefined = () => undefined,
  bundled: readonly Bundled[] = [],
): Record<string, unknown> {
  const edges = closure(lock, pkg);
  // Bundled code is inlined, so it depends on nothing at install time.
  const inlined = new Set<string>();
  for (const { name, version } of bundled) {
    const key = Object.keys(lock.packages).find((candidate) => lock.packages[candidate]?.[0] === `${name}@${version}`);
    if (!key) throw new Error(`bun.lock has no entry for bundled ${name}@${version}`);
    inlined.add(key);
    if (!edges.has(key)) edges.set(key, []);
  }
  const ref = (key: string): string => {
    const { name, version } = split((lock.packages[key] as LockEntry)[0]);
    return purlOf(name, version);
  };
  const components: Component[] = [...edges.keys()].sort().map((key) => {
    const entry = lock.packages[key] as LockEntry;
    const { name, version } = split(entry[0]);
    const license = licenseOf(key);
    const hashes = hashOf(entry[3]);
    return {
      type: "library",
      "bom-ref": ref(key),
      name,
      version,
      purl: purlOf(name, version),
      ...(hashes ? { hashes } : {}),
      ...(license ? { licenses: [{ license: { id: license } }] } : {}),
      ...(inlined.has(key) ? { properties: [{ name: "liveframe:bundled", value: "dist/pack/sucrase.js" }] } : {}),
    };
  });
  const rootRef = purlOf(pkg.name, pkg.version);
  const rootDeps = [...new Set([...Object.keys(pkg.dependencies ?? {}), ...inlined].map((dep) => ref(dep)))];
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: { type: "library", "bom-ref": rootRef, name: pkg.name, version: pkg.version, purl: rootRef },
    },
    components,
    dependencies: [
      { ref: rootRef, dependsOn: rootDeps },
      ...[...edges].map(([key, children]) => ({ ref: ref(key), dependsOn: children.map(ref) })),
    ],
  };
}

if (import.meta.main) {
  const root = new URL("../../", import.meta.url).pathname;
  const argv = process.argv.slice(2);
  const out = argv[0] === "--out" ? argv[1] : undefined;
  if (!out || argv.length !== 2) {
    console.error("Usage: bun scripts/release/sbom.ts --out <file>");
    process.exit(2);
  }
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as PackageJson;
  const lock = Bun.JSONC.parse(readFileSync(join(root, "bun.lock"), "utf8")) as Lock;
  const licenseOf = (key: string): string | undefined => {
    const file = join(root, "node_modules", segments(key).join("/node_modules/"), "package.json");
    if (!existsSync(file)) return undefined;
    const license = (JSON.parse(readFileSync(file, "utf8")) as PackageJson).license;
    return typeof license === "string" ? license : undefined;
  };
  await Bun.write(out, `${JSON.stringify(buildSbom(pkg, lock, licenseOf, readBundled(root)), null, 2)}\n`);
}
