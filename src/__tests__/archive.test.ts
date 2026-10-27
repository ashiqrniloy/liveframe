import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../../package.json" with { type: "json" };
import { assertExportsPacked, publishManifest, stagePackage } from "../../scripts/release/publish-manifest.ts";

const root = new URL("../../", import.meta.url).pathname;
let directory: string;
let files: string[];
let manifest: ReturnType<typeof publishManifest<typeof pkg>>;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "liveframe-archive-test-"));
  const staging = join(directory, "staging");
  await stagePackage(staging);
  run(["bun", "pm", "pack", "--filename", join(directory, "package.tgz")], staging);
  files = run(["tar", "-tzf", join(directory, "package.tgz")])
    .trim()
    .split("\n")
    .map((file) => file.replace(/^package\//, ""));
  manifest = JSON.parse(run(["tar", "-xOf", join(directory, "package.tgz"), "package/package.json"]));
});

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

function run(args: string[], cwd = root): string {
  const result = Bun.spawnSync(["timeout", "30s", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return result.stdout.toString();
}

test("published_manifest_has_no_source_condition", () => {
  const before = JSON.stringify(pkg);
  const published = publishManifest(pkg);
  expect(JSON.stringify(published.exports)).not.toContain("liveframe:source");
  expect(JSON.stringify(published.exports)).not.toContain("./src/");
  expect(JSON.stringify(pkg)).toBe(before);
  expect(published.repository).toEqual(pkg.repository);
  expect(published.publishConfig).toEqual(pkg.publishConfig);
  expect(manifest.exports).toEqual(published.exports);
  expect(() => assertExportsPacked(manifest.exports, new Set(files))).not.toThrow();
});

test("exports_targets_are_packed", () => {
  const files = new Set(["dist/index.js", "dist/index.d.ts", "schemas/catalog.json"]);
  const exports = {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./schemas/*": "./schemas/*",
  };
  expect(() => assertExportsPacked(exports, files)).not.toThrow();
  expect(() => assertExportsPacked({ ...exports, ".": { ...exports["."], bogus: "./missing.js" } }, files)).toThrow(
    'exports["."]["bogus"]',
  );
  expect(() => assertExportsPacked({ ".": { default: ["./dist/index.js", "./missing.js"] } }, files)).toThrow(
    'exports["."]["default"][1]',
  );
  expect(() => assertExportsPacked({ "./schemas/*": "./missing/*" }, files)).toThrow("./missing/*");
  expect(() => assertExportsPacked({ ".": null }, files)).not.toThrow();
  expect(() => assertExportsPacked(pkg.exports, new Set(files))).toThrow("liveframe:source");
});

test("archive_gate_rejects_a_packed_missing_condition", async () => {
  const broken = join(directory, "broken");
  await mkdir(join(broken, "package"), { recursive: true });
  await Bun.write(
    join(broken, "package/package.json"),
    JSON.stringify({ exports: { ".": { bogus: "./missing.js" } } }),
  );
  const tarball = join(directory, "broken.tgz");
  run(["tar", "-czf", tarball, "package"], broken);
  const result = Bun.spawnSync(["timeout", "30s", "bun", "scripts/release/archive-gate.ts", "--tarball", tarball], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain('exports["."]["bogus"]');
  expect(result.stderr.toString()).toContain("./missing.js");
});

// The published allowlist (plan 013 Task 1): compiled code, declarations, schemas, guides and package metadata.
const allowed = [
  /^package\.json$/,
  /^LICENSE$/,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^SECURITY\.md$/,
  /^dist\/(?:[^/]+\/)*[^/]+\.(?:js|d\.ts)$/,
  /^schemas\/[^/]+\.json$/,
  /^docs\/[^/]+\.md$/,
];

test("archive_contains_only_the_release_files", () => {
  expect(files.length).toBeGreaterThan(0);
  for (const file of files)
    expect(
      allowed.some((pattern) => pattern.test(file)),
      file,
    ).toBe(true);
  expect(files.some((file) => /^(?:src|proof|examples)\//.test(file))).toBe(false);
  expect(files.some((file) => file.includes("__tests__"))).toBe(false);
  expect(files.filter((file) => file.startsWith("dist/")).some((file) => file.includes("proof"))).toBe(false);
  expect(files).toContain("dist/preview/worker/entry.js");
  expect(files).toContain(pkg.bin.liveframe.replace(/^\.\//, ""));
});

test("every_export_has_types_and_default", () => {
  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    if (typeof entry === "string") {
      expect(subpath, "only the schemas export may map bare files").toBe("./schemas/*");
      expect(files).toContain("schemas/catalog.json");
      continue;
    }
    if (subpath !== ".") expect(subpath).toMatch(/^\.\//);
    expect(entry["liveframe:source"]).toStartWith("./src/");
    expect(entry.types).toEndWith(".d.ts");
    expect(entry.default).toEndWith(".js");
    expect(files).toContain(entry.types.replace(/^\.\//, ""));
    expect(files).toContain(entry.default.replace(/^\.\//, ""));
  }
});

test("package_metadata_is_publishable", () => {
  expect(Object.hasOwn(pkg, "private")).toBe(false);
  expect(pkg.publishConfig).toEqual({ access: "public", tag: "next" });
  expect(pkg.engines.bun).toBe(">=1.4.2");
  expect(pkg.files).toEqual(["dist", "schemas", "docs", "CHANGELOG.md", "SECURITY.md"]);
  expect(pkg.sideEffects).toEqual(["./dist/preview/worker/entry.js"]);
});
