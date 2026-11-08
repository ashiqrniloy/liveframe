#!/usr/bin/env bun
/**
 * Fail unless every workspace package is at one version (lockstep releases, decision 2026-11-08-2310),
 * every package that peers on `@arnilo/liveframe` says so with a `~` range, and, with `--tag`, the tag
 * names that version.
 *
 *   timeout 60s bun scripts/release/versions.ts [--tag v0.3.0]
 */
import { type Manifest, packageDirs, readManifest } from "./packages.ts";

export function versionProblems(manifests: readonly Manifest[], tag?: string): string[] {
  const problems: string[] = [];
  const [first] = manifests;
  if (!first) return ["no packages"];
  for (const manifest of manifests)
    if (manifest.version !== first.version)
      problems.push(`${manifest.name} is ${manifest.version}, ${first.name} is ${first.version}`);
  for (const manifest of manifests) {
    const peer = manifest.peerDependencies?.["@arnilo/liveframe"];
    if (manifest.name !== "@arnilo/liveframe" && !peer?.startsWith("~"))
      problems.push(`${manifest.name} must peer on @arnilo/liveframe with a ~ range, not ${peer ?? "nothing"}`);
  }
  if (tag !== undefined && tag !== `v${first.version}`)
    problems.push(`tag ${tag} does not match the package version v${first.version}`);
  return problems;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const tag = argv[0] === "--tag" ? argv[1] : undefined;
  if (argv.length > 0 && (argv.length !== 2 || tag === undefined)) {
    console.error("Usage: bun scripts/release/versions.ts [--tag v<version>]");
    process.exit(2);
  }
  const manifests = await Promise.all((await packageDirs()).map(readManifest));
  const problems = versionProblems(manifests, tag);
  if (problems.length > 0) {
    console.error(`Version check failed:\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`${manifests.length} packages at ${manifests[0]?.version}`);
}
