import { expect, test } from "bun:test";
import { canonicalJson, packageHash, sha256, utf8 } from "../pack/hash.ts";
import type { Manifest } from "../formats/manifest.ts";
import manifestDoc from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const manifest = manifestDoc as Manifest;
const pkg = {
  format: "liveframe-package/1" as const,
  manifest,
  code: "export default () => null;",
  scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
};
const oracle = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

test("sha256_nist_vectors", () => {
  for (const [message, digest] of [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    ["a".repeat(1000000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  ] as const)
    expect(sha256(utf8(message))).toBe(digest);
});

test("sha256_matches_bun", () => {
  let seed = 0x12345678;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  for (let i = 0; i < 500; i++) {
    let text = "\0éবাংলা😀";
    const length = next() % 2048;
    for (let j = 0; j < length; j++) {
      const point = next() % 0x110000;
      text += String.fromCodePoint(point >= 0xd800 && point <= 0xdfff ? 0x20 : point);
    }
    expect(sha256(utf8(text))).toBe(oracle(text));
    const bytes = Uint8Array.from({ length: i }, () => next() & 255);
    expect(sha256(bytes)).toBe(oracle(bytes));
  }
});

test("canonical_json_is_order_independent", () => {
  const reordered = {
    scenarios: pkg.scenarios.map(() => ({ data: {}, context: {}, params: {}, name: "default" })),
    code: pkg.code,
    manifest: Object.fromEntries(Object.entries(manifest).reverse()) as typeof manifest,
    format: pkg.format,
  };
  expect(canonicalJson(reordered)).toBe(canonicalJson(pkg));
  expect(packageHash(reordered)).toBe(packageHash(pkg));
  expect(packageHash(pkg)).toBe(`sha256-${oracle(canonicalJson(pkg))}`);
  const withHash = { ...pkg, hash: "ignored" };
  expect(packageHash(withHash)).toBe(packageHash(pkg));
  for (const changed of [
    { ...pkg, code: `${pkg.code}\n` },
    { ...pkg, manifest: { ...manifest, version: "changed" } },
    { ...pkg, scenarios: pkg.scenarios.map((scenario) => ({ ...scenario, name: "changed" })) },
  ])
    expect(packageHash(changed)).not.toBe(packageHash(pkg));
});

test("canonical_json_preserves_rfc8785_order_and_primitives", () => {
  expect(canonicalJson({ "2": 2, "10": 10, "😀": 3, "\ufffd": 4, "\r": 5 })).toBe(
    '{"\\r":5,"10":10,"2":2,"😀":3,"�":4}',
  );
  expect(canonicalJson([null, true, false, -0, 1e30, 1e-7, 0.000001, '\n"\\\u000f'])).toBe(
    '[null,true,false,0,1e+30,1e-7,0.000001,"\\n\\"\\\\\\u000f"]',
  );
  expect(canonicalJson([{ z: 1, a: 2 }, 3])).toBe('[{"a":2,"z":1},3]');
  expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  expect(canonicalJson("é")).not.toBe(canonicalJson("e\u0301"));
  const shared = { a: 1 };
  expect(canonicalJson([shared, shared])).toBe('[{"a":1},{"a":1}]');
});

test("canonical_json_rejects_non_json_and_lone_surrogates", () => {
  const cycle: unknown[] = [];
  cycle.push(cycle);
  for (const value of [
    undefined,
    NaN,
    Infinity,
    -Infinity,
    1n,
    Symbol(),
    () => {},
    new Date(),
    cycle,
    [undefined],
    Array(1),
    { a: undefined },
    "\ud800",
    "\udc00",
    { "\ud800": 1 },
    ["x\udc00y"],
  ]) {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  }
  expect(() => utf8("\ud800")).toThrow(TypeError);
});

test("package_hash_1_mib_under_50_ms", () => {
  const large = { ...pkg, code: "a".repeat(1048576) };
  packageHash(large);
  const start = performance.now();
  const hash = packageHash(large);
  const elapsed = performance.now() - start;
  expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
  expect(elapsed).toBeLessThan(50);
  console.info(`1 MiB package hash: ${elapsed.toFixed(2)} ms`);
});
