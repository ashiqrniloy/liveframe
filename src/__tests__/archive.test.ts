import { expect, test } from "bun:test";
import pkg from "../../package.json" with { type: "json" };

const root = new URL("../../", import.meta.url).pathname;

// The published allowlist (plan 013 Task 1): compiled code, declarations, schemas, guides and package metadata.
const allowed = [
  /^package\.json$/,
  /^LICENSE$/,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^dist\/(?:[^/]+\/)*[^/]+\.(?:js|d\.ts)$/,
  /^schemas\/[^/]+\.json$/,
  /^docs\/[^/]+\.md$/,
];

function packed(): string[] {
  const run = Bun.spawnSync(["bun", "pm", "pack", "--dry-run"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const output = `${run.stdout.toString()}${run.stderr.toString()}`;
  expect(run.exitCode, output).toBe(0);
  return [...output.matchAll(/^packed \S+ (.+)$/gm)].map((match) => match[1] ?? "");
}

test("archive_contains_only_the_release_files", () => {
  const files = packed();
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
  const files = new Set(packed());
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
  expect(pkg.files).toEqual(["dist", "schemas", "docs", "CHANGELOG.md"]);
  expect(pkg.sideEffects).toEqual(["./dist/preview/worker/entry.js"]);
});
