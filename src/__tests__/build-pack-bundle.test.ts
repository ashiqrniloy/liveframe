import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pack as sourcePack } from "@arnilo/liveframe/pack";
import pkg from "../../package.json" with { type: "json" };
import { drafts, packageOptions } from "./fixtures/widgets/drafts.ts";

const dist = fileURLToPath(new URL("../../dist/pack/", import.meta.url));
const vectors = (await Bun.file(new URL("../../conformance/hash/packages.json", import.meta.url)).json()) as {
  package: Parameters<typeof import("../pack/hash.ts").packageHash>[0];
  hash: string;
}[];

async function builtPack(): Promise<typeof import("../pack/index.ts")> {
  if (!(await Bun.file(`${dist}index.js`).exists())) throw new Error("dist/ is missing: run `bun run build`");
  return import(`${dist}index.js`);
}

test("bundled_pack_hashes_match_the_vectors", async () => {
  const built = await builtPack();
  // The vectors hash fixed packages, so they check the built hasher. Transpiling is checked by packing the proof
  // widgets through the built bundle and through the source: the packages must be byte-identical.
  for (const vector of vectors) expect(built.packageHash(vector.package)).toBe(vector.hash);
  expect(drafts.length).toBeGreaterThan(0);
  for (const draft of drafts) {
    const expected = sourcePack(draft as never, packageOptions as never);
    const actual = built.pack(draft as never, packageOptions as never);
    if (!expected.ok || !actual.ok) throw new Error(JSON.stringify(expected.ok ? actual : expected));
    expect(actual.value.code).toBe(expected.value.code);
    expect(actual.value.hash).toBe(expected.value.hash);
  }
});

test("dist_pack_imports_no_sucrase", async () => {
  const files = (await readdir(dist)).filter((file) => file.endsWith(".js"));
  expect(files).toContain("sucrase.js");
  for (const file of files) {
    const text = await Bun.file(`${dist}${file}`).text();
    expect(text, file).not.toMatch(/(?:from\s*|import\s*\(\s*|require\(\s*)["']sucrase["']/);
  }
  expect(await Bun.file(`${dist}bundle.js`).text()).toContain('from "./sucrase.js"');
  expect(Object.keys(pkg.dependencies)).toEqual(["acorn"]);
});

test("bundled_packages_ship_their_licences", async () => {
  const licences = await Bun.file(`${dist}THIRD-PARTY-LICENSES`).text();
  for (const name of ["sucrase", "lines-and-columns", "ts-interface-checker", "@jridgewell/gen-mapping"])
    expect(licences, name).toContain(`${name}@`);
  expect(licences).toContain("Apache License");
  expect(licences).toContain("Permission is hereby granted");
});
