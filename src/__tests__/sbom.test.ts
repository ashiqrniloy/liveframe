import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Ajv } from "ajv";
import { buildSbom, closure, type Lock, type PackageJson } from "../../scripts/release/sbom.ts";

const root = resolve(import.meta.dir, "../..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as PackageJson & {
  devDependencies: object;
  peerDependencies: object;
};
const lock = Bun.JSONC.parse(readFileSync(resolve(root, "bun.lock"), "utf8")) as Lock;
const names = (bom: { components: { name: string }[] }) => bom.components.map((component) => component.name);

test("sbom_lists_exactly_the_runtime_closure", () => {
  const bom = buildSbom(pkg, lock) as { components: { name: string; purl: string }[]; dependencies: { ref: string }[] };
  const listed = names(bom);
  expect(listed).toContain("acorn");
  expect(listed).toContain("sucrase");
  for (const dev of Object.keys(pkg.devDependencies)) expect(listed).not.toContain(dev);
  for (const peer of Object.keys(pkg.peerDependencies)) expect(listed).not.toContain(peer);
  // The closure is closed: every dependency of a listed package is listed, and every purl is unique.
  const purls = bom.components.map((component) => component.purl);
  expect(new Set(purls).size).toBe(purls.length);
  const refs = new Set(bom.dependencies.map((entry) => entry.ref));
  for (const entry of bom.dependencies as { ref: string; dependsOn: string[] }[])
    for (const child of entry.dependsOn) expect(refs.has(child)).toBe(true);
});

test("sbom_resolves_nested_and_scoped_lock_entries", () => {
  const fakePkg = { name: "root", version: "0.0.0", dependencies: { a: "1.0.0", "@s/b": "1.0.0" } };
  const fake = {
    workspaces: { "": { dependencies: { a: "1.0.0", "@s/b": "1.0.0" } } },
    packages: {
      a: ["a@1.0.0", "", { dependencies: { c: "^1.0.0", "@s/b": "^2.0.0" } }, "sha512-AAAA"],
      "@s/b": ["@s/b@1.0.0", "", {}, "sha512-AAAA"],
      "a/@s/b": ["@s/b@2.0.0", "", { dependencies: { c: "^2.0.0" } }, "sha512-AAAA"],
      c: ["c@1.0.0", "", {}, "sha512-AAAA"],
      "a/@s/b/c": ["c@2.0.0", "", {}, "sha512-AAAA"],
      dev: ["dev@1.0.0", "", {}, "sha512-AAAA"],
    },
  } as unknown as Lock;
  const edges = closure(fake, fakePkg);
  expect([...edges.keys()].sort()).toEqual(["@s/b", "a", "a/@s/b", "a/@s/b/c", "c"]);
  expect(edges.get("a")).toEqual(["c", "a/@s/b"]);
  expect(edges.get("a/@s/b")).toEqual(["a/@s/b/c"]);
  const bom = buildSbom(fakePkg, fake) as { components: { purl: string }[] };
  expect(bom.components.map((component) => component.purl)).toContain("pkg:npm/%40s/b@2.0.0");
});

test("sbom_is_valid_cyclonedx_1_6", () => {
  const dir = resolve(root, "scripts/release/fixtures/cyclonedx");
  const read = (file: string) => JSON.parse(readFileSync(resolve(dir, file), "utf8"));
  // Formats (date-time, idn-email, …) need ajv-formats, which this repo does not install; none appears in an SBOM.
  const ajv = new Ajv({ strict: false, validateFormats: false });
  ajv.addSchema(read("spdx.schema.json"));
  ajv.addSchema(read("jsf-0.82.schema.json"));
  const validate = ajv.compile(read("bom-1.6.schema.json"));
  const bom = buildSbom(pkg, lock, () => "MIT");
  expect(validate(bom), JSON.stringify(validate.errors)).toBe(true);
  // The validator is not vacuous.
  expect(validate({ ...bom, specVersion: 1.6 })).toBe(false);
});
