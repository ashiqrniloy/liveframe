import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveProblems, archiveRules, packageDirs, readManifest } from "../../scripts/release/packages.ts";
import { assertExportsPacked, stagePackage } from "../../scripts/release/publish-manifest.ts";
import { versionProblems } from "../../scripts/release/versions.ts";

const root = new URL("../../", import.meta.url).pathname;
let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "liveframe-workspace-test-"));
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

function run(args: string[], cwd: string): string {
  const result = Bun.spawnSync(["timeout", "60s", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return result.stdout.toString();
}

/** The files `bun pm pack` puts in the archive of one package, from its staged copy. */
async function archive(dir: string): Promise<{ files: Set<string>; manifest: { exports: unknown } }> {
  const staging = join(directory, `staging-${dir.replaceAll("/", "-")}`);
  await stagePackage(staging, dir);
  const tarball = join(directory, `${dir.replaceAll("/", "-")}.tgz`);
  run(["bun", "pm", "pack", "--filename", tarball], staging);
  const files = new Set(
    run(["tar", "-tzf", tarball], root)
      .trim()
      .split("\n")
      .map((file) => file.replace(/^package\//, "")),
  );
  return { files, manifest: JSON.parse(run(["tar", "-xOf", tarball, "package/package.json"], root)) };
}

test("workspace_lists_the_core_then_both_packages", async () => {
  expect(await packageDirs()).toEqual([".", "packages/runner-quickjs", "packages/starter"]);
});

test("workspace_packages_share_one_version", async () => {
  const manifests = await Promise.all((await packageDirs()).map(readManifest));
  expect(versionProblems(manifests)).toEqual([]);
  expect(new Set(manifests.map((manifest) => manifest.version)).size).toBe(1);
  for (const manifest of manifests.slice(1)) {
    expect(manifest.peerDependencies?.["@arnilo/liveframe"]).toBe("~0.3.0");
    expect(manifest.engines).toEqual({ bun: ">=1.4.2" });
  }
});

test("publish_workflow_fails_on_version_mismatch", () => {
  const core = { name: "@arnilo/liveframe", version: "0.3.0", exports: null, files: [] };
  const peer = { "@arnilo/liveframe": "~0.3.0" };
  const runner = {
    name: "@arnilo/liveframe-runner-quickjs",
    version: "0.3.0",
    exports: null,
    files: [],
    peerDependencies: peer,
  };
  expect(versionProblems([core, runner], "v0.3.0")).toEqual([]);
  expect(versionProblems([core, { ...runner, version: "0.3.1" }])).toEqual([
    "@arnilo/liveframe-runner-quickjs is 0.3.1, @arnilo/liveframe is 0.3.0",
  ]);
  expect(versionProblems([core, runner], "v0.3.1")).toEqual(["tag v0.3.1 does not match the package version v0.3.0"]);
  expect(versionProblems([core, runner], "0.3.0")).toHaveLength(1);
  expect(versionProblems([core, { ...runner, peerDependencies: { "@arnilo/liveframe": "^0.3.0" } }])).toHaveLength(1);
  expect(versionProblems([core, { ...runner, peerDependencies: {} }])).toHaveLength(1);
  expect(versionProblems([])).toEqual(["no packages"]);
});

test("archive_rules_forbid_and_require_files", () => {
  const needs = { forbid: [], require: [/^dist\/child\.js$/, /\.wasm$/] };
  expect(archiveProblems(needs, ["dist/child.js", "dist/q.wasm"])).toEqual([]);
  expect(archiveProblems(needs, ["dist/index.js"])).toEqual([
    "required file missing from the archive: /^dist\\/child\\.js$/",
    "required file missing from the archive: /\\.wasm$/",
  ]);
  expect(archiveProblems({ forbid: [/\.wasm$/], require: [] }, ["dist/q.wasm"])).toEqual([
    "forbidden file in the archive: dist/q.wasm",
  ]);
});

test("root_archive_has_no_wasm", async () => {
  const rules = archiveRules["@arnilo/liveframe"] as (typeof archiveRules)[string];
  expect(archiveProblems(rules, ["dist/a.wasm"])).toHaveLength(1);
  expect(archiveProblems(rules, ["dist/runner-quickjs/index.js"])).toHaveLength(1);
  expect(archiveProblems(rules, ["dist/starter/ui.gen.js"])).toHaveLength(1);
  const { files } = await archive(".");
  expect([...files].filter((file) => file.endsWith(".wasm"))).toEqual([]);
  expect(archiveProblems(rules, files)).toEqual([]);
});

test("each_package_archive_matches_exports", async () => {
  for (const dir of await packageDirs()) {
    const manifest = await readManifest(dir);
    const rules = archiveRules[manifest.name];
    expect(rules, `archive rules for ${manifest.name}`).toBeDefined();
    const packed = await archive(dir);
    expect(() => assertExportsPacked(packed.manifest.exports, packed.files), manifest.name).not.toThrow();
    expect(archiveProblems(rules as NonNullable<typeof rules>, packed.files), manifest.name).toEqual([]);
    expect(packed.files.has("package.json") && packed.files.has("LICENSE") && packed.files.has("README.md")).toBe(true);
  }
}, 120_000);
