import { join } from "node:path";

export const root = new URL("../../", import.meta.url).pathname;

export type Manifest = {
  name: string;
  version: string;
  exports: unknown;
  files: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

/** The published packages, the root first: `.` and every directory the root `workspaces` globs match. */
export async function packageDirs(): Promise<string[]> {
  const { workspaces = [] } = (await Bun.file(join(root, "package.json")).json()) as { workspaces?: string[] };
  const dirs = new Set<string>(["."]);
  for (const glob of workspaces)
    for await (const manifest of new Bun.Glob(`${glob}/package.json`).scan(root))
      dirs.add(manifest.slice(0, -"/package.json".length));
  return [...dirs].sort((a, b) => (a === "." ? -1 : b === "." ? 1 : a.localeCompare(b)));
}

export async function readManifest(dir: string): Promise<Manifest> {
  return (await Bun.file(join(root, dir, "package.json")).json()) as Manifest;
}

/** What an archive must and must not hold, beyond its `exports` targets. Paths are archive-relative. */
export type ArchiveRules = { forbid: RegExp[]; require: RegExp[] };

const noWasm = /\.wasm$/;
export const archiveRules: Record<string, ArchiveRules> = {
  // Spec §13 rule 3 (scoped by decision 2026-11-08-2310): the core ships no WebAssembly, no isolation
  // engine and no starter components. Those are the two other packages.
  "@arnilo/liveframe": { forbid: [noWasm, /quickjs|starter/i], require: [] },
  // The runner spawns its compiled child entry; the wasm comes from its pinned dependency, which the install
  // smoke proves resolves outside the checkout (decision 2026-11-08-2310).
  "@arnilo/liveframe-runner-quickjs": { forbid: [], require: [/^dist\/child\.js$/] },
  "@arnilo/liveframe-starter": { forbid: [noWasm], require: [] },
};

/** Problems with an archive's file list: forbidden files present, required files missing. */
export function archiveProblems(rules: ArchiveRules, files: Iterable<string>): string[] {
  const list = [...files];
  const problems: string[] = [];
  for (const pattern of rules.forbid)
    for (const file of list) if (pattern.test(file)) problems.push(`forbidden file in the archive: ${file}`);
  for (const pattern of rules.require)
    if (!list.some((file) => pattern.test(file))) problems.push(`required file missing from the archive: ${pattern}`);
  return problems;
}
