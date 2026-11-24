#!/usr/bin/env bun
/**
 * Fail unless every workspace package is at one version (lockstep releases, decision 2026-11-08-2310),
 * every package that peers on `@arnilo/liveframe` says so with the `~X.Y.Z` range of that version
 * (`~X.Y.Z-0` for a prerelease; decision 2026-11-24-1550), and, with `--tag`, the tag
 * names that version.
 *
 *   timeout 60s bun scripts/release/versions.ts [--tag v0.3.0]
 */
import { type Manifest, packageDirs, readManifest } from "./packages.ts";

/** The range a companion must peer on: `~X.Y.Z` for `X.Y.Z`, `~X.Y.Z-0` while the version is a prerelease. */
function expectedPeerRange(version: string): string | undefined {
  const match = /^(\d+\.\d+\.\d+)(-[\w.-]+)?(?:\+[\w.-]+)?$/.exec(version);
  return match ? `~${match[1]}${match[2] ? "-0" : ""}` : undefined;
}

export function versionProblems(manifests: readonly Manifest[], tag?: string): string[] {
  const problems: string[] = [];
  const [first] = manifests;
  if (!first) return ["no packages"];
  const expected = expectedPeerRange(first.version);
  if (expected === undefined) problems.push(`${first.name} has invalid release version ${first.version}`);
  for (const manifest of manifests)
    if (manifest.version !== first.version)
      problems.push(`${manifest.name} is ${manifest.version}, ${first.name} is ${first.version}`);
  for (const manifest of manifests) {
    if (manifest.name === "@arnilo/liveframe") continue;
    const peer = manifest.peerDependencies?.["@arnilo/liveframe"];
    if (expected !== undefined && peer !== expected)
      problems.push(
        `${manifest.name} must peer on @arnilo/liveframe at ${expected} for ${first.version}, not ${peer ?? "nothing"}`,
      );
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
