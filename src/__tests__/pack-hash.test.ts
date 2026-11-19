import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { Manifest } from "../formats/manifest.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { canonicalJson, digest, packageHash, renderKey, sha256, utf8 } from "../pack/hash.ts";
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

test("meta_changes_hash", () => {
  const base = packageHash(pkg);
  const described = packageHash({ ...pkg, manifest: { ...manifest, description: "Pending decisions." } });
  const withMeta = packageHash({ ...pkg, manifest: { ...manifest, meta: { sizes: ["m"] } } });
  const changed = packageHash({ ...pkg, manifest: { ...manifest, meta: { sizes: ["l"] } } });
  expect(new Set([base, described, withMeta, changed]).size).toBe(4);
  const reordered = packageHash({ ...pkg, manifest: { ...manifest, meta: { b: 1, a: 2 } } });
  expect(packageHash({ ...pkg, manifest: { ...manifest, meta: { a: 2, b: 1 } } })).toBe(reordered);
});

test("package_hash_1_mib_is_deterministic_sha256", () => {
  const large = { ...pkg, code: "a".repeat(1048576) };
  const hash = packageHash(large);
  expect(hash).toMatch(/^sha256-[0-9a-f]{64}$/);
  expect(packageHash(large)).toBe(hash);
});

test("render_key_ignores_key_order_and_changes_with_any_input", () => {
  const inputs = {
    hash: "sha256-abc",
    catalogId: manifest.catalogId,
    params: { b: 1, a: [2, 3] },
    state: { cursors: { tasks: "t1" }, flag: false },
    data: { queue: { rows: [] } },
    context: { size: "md" },
  };
  const key = renderKey(inputs);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
  // Absent `actions` hashes as `{}` (plan 029 A8).
  expect(key).toBe(oracle(canonicalJson({ ...inputs, actions: {} })));
  expect(renderKey({ ...inputs, actions: {} })).toBe(key);
  expect(renderKey({ ...inputs, params: { a: [2, 3], b: 1 } })).toBe(key);
  expect(renderKey({ ...inputs, state: { flag: false, cursors: { tasks: "t1" } } })).toBe(key);
  for (const [field, value] of [
    ["hash", "sha256-def"],
    ["catalogId", "other.ui@1"],
    ["params", { a: [3, 2], b: 1 }],
    ["state", { cursors: { tasks: "t2" }, flag: false }],
    ["data", { queue: { rows: [{}] } }],
    ["context", { size: "lg" }],
    ["actions", { "tasks.claim": { status: "pending" } }],
  ] as const)
    expect(renderKey({ ...inputs, [field]: value })).not.toBe(key);
});

test("sha256_matches_native_on_random_inputs", () => {
  let seed = 0x9e3779b9;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  // Every padding boundary (55, 56, 63, 64, 119, 120 ...), then random lengths with random bytes.
  for (let length = 0; length <= 200; length++) {
    const bytes = Uint8Array.from({ length }, () => next() & 255);
    expect(sha256(bytes)).toBe(oracle(bytes));
  }
  for (let i = 0; i < 10_000; i++) {
    const bytes = Uint8Array.from({ length: next() % 4097 }, () => next() & 255);
    expect(sha256(bytes)).toBe(oracle(bytes));
  }
  for (const size of [1 << 20, 16 << 20]) {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = (i * 31 + (i >>> 8)) & 255;
    expect(sha256(bytes)).toBe(oracle(bytes));
  }
});

test("utf8_matches_text_encoder_and_rejects_lone_surrogates", () => {
  const encoder = new TextEncoder();
  for (const text of ["", "ascii only", "é", "€", "😀", "aé€😀b", "a".repeat(1000), `${"a".repeat(1000)}😀`])
    expect(utf8(text)).toEqual(encoder.encode(text));
  for (const text of ["\ud800", "\udc00", "a\ud800", "\ud800a", "\udc00\ud800", "é\udbff", "😀\udc00"])
    expect(() => utf8(text)).toThrow(new TypeError("Expected Unicode without lone surrogates"));
});

test("canonical_json_errors_unchanged_for_non_json", () => {
  const cycle: unknown[] = [];
  cycle.push(cycle);
  const notJson = new TypeError("Expected a JSON value");
  const notUnicode = new TypeError("Expected Unicode without lone surrogates");
  for (const value of [undefined, NaN, 1n, Symbol(), cycle, [undefined], { a: [{ b: new Date() }] }, [cycle]])
    expect(() => canonicalJson(value)).toThrow(notJson);
  for (const value of ["\ud800", { "\udc00": 1 }, ["x\ud800y"]]) expect(() => canonicalJson(value)).toThrow(notUnicode);
  // A value that is both invalid JSON and has a lone surrogate reports the JSON error, wherever the surrogate sits.
  expect(() => canonicalJson(["\ud800", undefined])).toThrow(notJson);
  expect(() => canonicalJson([undefined, "\ud800"])).toThrow(notJson);
  expect(() => canonicalJson({ "\ud800": cycle })).toThrow(notJson);
  // A shared reference is not a cycle.
  const shared = { a: 1 };
  expect(canonicalJson({ x: shared, y: [shared, [shared]] })).toBe('{"x":{"a":1},"y":[{"a":1},[{"a":1}]]}');
});

function decodeVectorValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeVectorValue);
  if (typeof value !== "object" || value === null) return value;
  const rec = value as Record<string, unknown>;
  if (Object.hasOwn(rec, "$liveframe")) {
    if (rec.$liveframe === "number") {
      if (rec.value === "NaN") return Number.NaN;
      if (rec.value === "Infinity") return Number.POSITIVE_INFINITY;
      if (rec.value === "-Infinity") return Number.NEGATIVE_INFINITY;
    }
    if (rec.$liveframe === "string" && Array.isArray(rec.codeUnits)) {
      return String.fromCharCode(...rec.codeUnits.map((u) => Number.parseInt(String(u), 16)));
    }
  }
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, decodeVectorValue(v)]));
}

function refCanonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(refCanonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${refCanonical((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

test("streamed_digest_equals_the_canonical_text_digest", async () => {
  const checkBoth = (value: unknown, label?: string) => {
    const canonical = canonicalJson(value);
    expect(canonical, label).toBe(refCanonical(value));
    const expected = sha256(utf8(canonical));
    expect(digest(value), label).toBe(expected);
    expect(
      renderKey({
        hash: "sha256-0",
        catalogId: manifest.catalogId,
        params: value,
        state: {},
        data: {},
        context: {},
      }),
      label,
    ).toBe(
      sha256(
        utf8(
          canonicalJson({
            hash: "sha256-0",
            catalogId: manifest.catalogId,
            params: value,
            state: {},
            data: {},
            context: {},
            actions: {},
          }),
        ),
      ),
    );
  };

  // 1. Every hash vector in conformance/hash/
  const hashRoot = fileURLToPath(new URL("../../conformance/hash/", import.meta.url));
  for (const file of [...new Bun.Glob("*.json").scanSync(hashRoot)].sort()) {
    const vectors = (await Bun.file(`${hashRoot}/${file}`).json()) as Record<string, unknown>[];
    for (const [index, vector] of vectors.entries()) {
      const where = `${file}[${index}]`;
      if ("package" in vector && "hash" in vector) {
        const vectorPkg = vector.package as WidgetPackage;
        const { hash: _, ...content } = vectorPkg;
        const { format, manifest: m, code, template, scenarios } = content;
        const body = template === undefined ? { code } : { template };
        const raw = { format, manifest: m, scenarios, ...body };
        checkBoth(raw, where);
        expect(packageHash(content), where).toBe(`sha256-${sha256(utf8(canonicalJson(raw)))}`);
        continue;
      }
      const value = decodeVectorValue(vector.value);
      if ("rejected" in vector) {
        let canonErr: unknown;
        try {
          sha256(utf8(canonicalJson(value)));
        } catch (err) {
          canonErr = err;
        }
        expect(canonErr, where).toBeInstanceOf(TypeError);
        expect(() => digest(value), where).toThrow((canonErr as TypeError).message);
      } else {
        checkBoth(value, where);
      }
    }
  }

  // 2. Every corpus document in conformance/corpus/
  const corpusRoot = fileURLToPath(new URL("../../conformance/corpus/", import.meta.url));
  const corpusFiles = [...new Bun.Glob("**/*.json").scanSync(corpusRoot)].sort();
  expect(corpusFiles.length).toBeGreaterThan(0);
  for (const file of corpusFiles) {
    const doc: unknown = await Bun.file(`${corpusRoot}/${file}`).json();
    checkBoth(doc, `corpus/${file}`);
  }

  // 3. Generated values: deep nesting (> 32 levels), astral characters, lone surrogates, -0, large integers, empty containers
  let deepArray: unknown = ["leaf", -0, {}, []];
  let deepObject: unknown = { leaf: -0, emptyArr: [], emptyObj: {} };
  for (let i = 0; i < 80; i++) {
    deepArray = [deepArray, i];
    deepObject = { [`k${i}`]: deepObject, n: i };
  }
  const nullProto = Object.assign(Object.create(null) as Record<string, unknown>, { z: 1, a: -0 });
  const shared = { astral: "😀𝄞", empty: [{}, []] };
  for (const value of [
    [],
    {},
    [[]],
    { "": {}, a: [] },
    nullProto,
    -0,
    [-0, 0, { a: -0, b: 0 }],
    9007199254740991,
    -9007199254740991,
    9007199254740992,
    -9007199254740992,
    1e21,
    1e-7,
    5e-324,
    1.7976931348623157e308,
    '😀𝄞é€\0\b\f\n\r\t"\\/\u001f',
    { "😀": "𝄞", "\ufffd": "é", "\r": "\n", "2": 2, "10": 10 },
    `${"a".repeat(599)}😀${"b".repeat(600)}€${'\n"\\'.repeat(300)}`,
    deepArray,
    deepObject,
    { first: shared, second: [shared, shared] },
  ]) {
    checkBoth(value);
  }

  for (const badSurrogate of ["\ud800", "\udc00", { "\ud800": 1 }, ["a\udbffb"], { a: [{ b: "\udc00" }] }]) {
    expect(() => canonicalJson(badSurrogate)).toThrow(new TypeError("Expected Unicode without lone surrogates"));
    expect(() => digest(badSurrogate)).toThrow(new TypeError("Expected Unicode without lone surrogates"));
  }

  // Seeded random generated JSON values
  let seed = 0x243f6a88;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const gen = (depth: number): unknown => {
    const kind = depth >= 6 ? next() % 5 : next() % 7;
    if (kind === 0) return null;
    if (kind === 1) return (next() & 1) === 0;
    if (kind === 2) {
      const sub = next() % 5;
      if (sub === 0) return -0;
      if (sub === 1) return next() % 1000;
      if (sub === 2) return (next() - 0x80000000) * 65536;
      if (sub === 3) return Number.MAX_SAFE_INTEGER - (next() % 100);
      return (next() % 10000) / 37;
    }
    if (kind === 3 || kind === 4) {
      const alphabet = ["a", "z", "0", '"', "\\", "\n", "\t", "\u0007", "é", "€", "😀", "𝄞", ""];
      const len = next() % 24;
      let s = "";
      for (let i = 0; i < len; i++) s += alphabet[next() % alphabet.length];
      return s;
    }
    if (kind === 5) {
      const len = next() % 6;
      return Array.from({ length: len }, () => gen(depth + 1));
    }
    const len = next() % 6;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < len; i++) {
      const key = `${["k", "2", "10", "😀", "\r", "é"][next() % 6]}${next() % 8}`;
      obj[key] = gen(depth + 1);
    }
    return obj;
  };
  for (let i = 0; i < 200; i++) checkBoth(gen(0), `random[${i}]`);
});

test("non_json_value_still_throws_type_error", () => {
  const cycle: unknown[] = [];
  cycle.push(cycle);
  const deepCycle: Record<string, unknown> = { a: { b: {} } };
  (deepCycle.a as Record<string, unknown>).b = deepCycle;
  const notJson = new TypeError("Expected a JSON value");

  for (const bad of [
    () => {},
    1n,
    cycle,
    deepCycle,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    undefined,
    Symbol("x"),
    new Date(),
    Array(1),
    { level1: { level2: [{ level3: () => {} }] } },
    { level1: { level2: [{ level3: 1n }] } },
    { level1: { level2: [{ level3: cycle }] } },
    { level1: { level2: [{ level3: Number.NaN }] } },
    ["\ud800", { nested: Number.NaN }],
    [{ nested: () => {} }, "\udc00"],
  ]) {
    expect(() => digest(bad)).toThrow(notJson);
    expect(() => canonicalJson(bad)).toThrow(notJson);
    expect(() =>
      renderKey({
        hash: "sha256-abc",
        catalogId: manifest.catalogId,
        params: bad,
        state: {},
        data: {},
        context: {},
      }),
    ).toThrow(notJson);
    expect(() =>
      packageHash({
        ...pkg,
        scenarios: [{ name: "default", params: bad as never, context: {}, data: {} }],
      }),
    ).toThrow(notJson);
  }
});
