import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { packageHash } from "@arnilo/liveframe/pack";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import { canonicalJson, sha256, utf8 } from "../pack/hash.ts";

const hashRoot = fileURLToPath(new URL("../../conformance/hash/", import.meta.url));
const files = (await readdir(hashRoot)).filter((file) => file.endsWith(".json")).sort();

type ValueVector =
  | { readonly value: unknown; readonly canonical: string; readonly sha256: string }
  | { readonly value: unknown; readonly rejected: "lone-surrogate" | "non-finite-number" };
type PackageVector = { readonly package: WidgetPackage; readonly hash: string };
type HashVector = ValueVector | PackageVector;

/** The one place an entry's shape is decided: an unknown shape fails the test instead of being skipped. */
function isPackageVector(vector: HashVector, where: string): vector is PackageVector {
  if (record(vector) && "package" in vector && "hash" in vector) return true;
  if (record(vector) && "value" in vector && ("canonical" in vector || "rejected" in vector)) return false;
  throw new Error(`${where}: unknown vector shape`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Decode the vector-only escape for values JSON cannot carry literally. */
function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (!record(value)) return value;
  if (Object.hasOwn(value, "$liveframe")) {
    if (value.$liveframe === "number" && typeof value.value === "string") {
      if (value.value === "NaN") return Number.NaN;
      if (value.value === "Infinity") return Number.POSITIVE_INFINITY;
      if (value.value === "-Infinity") return Number.NEGATIVE_INFINITY;
    }
    if (value.$liveframe === "string" && Array.isArray(value.codeUnits)) {
      const units = value.codeUnits.map((unit) => {
        if (typeof unit !== "string" || !/^[0-9A-F]{4}$/.test(unit)) throw new Error(`bad code unit: ${String(unit)}`);
        return Number.parseInt(unit, 16);
      });
      return String.fromCharCode(...units);
    }
    throw new Error("invalid $liveframe escape");
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
}

async function read(file: string): Promise<HashVector[]> {
  const value: unknown = await Bun.file(join(hashRoot, file)).json();
  if (!Array.isArray(value)) throw new Error(`${file} must hold an array`);
  return value as HashVector[];
}

test("hash_vectors_match", async () => {
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    for (const [index, vector] of (await read(file)).entries()) {
      if (isPackageVector(vector, `${file}[${index}]`)) continue;
      const value = decode(vector.value);
      if ("rejected" in vector) {
        expect(() => canonicalJson(value), `${file}[${index}]`).toThrow(TypeError);
        continue;
      }
      const canonical = canonicalJson(value);
      expect(canonical, `${file}[${index}]`).toBe(vector.canonical);
      expect(vector.sha256, `${file}[${index}]`).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(utf8(canonical)), `${file}[${index}]`).toBe(vector.sha256);
    }
  }
});

test("hash_vectors_include_rfc8785_appendix_b", async () => {
  const vectors = await read("rfc8785-appendix-b.json");
  const canonicals = vectors.map((vector) => ("canonical" in vector ? vector.canonical : ""));
  expect(canonicals).toEqual([
    "0",
    "0",
    "5e-324",
    "-5e-324",
    "1.7976931348623157e+308",
    "-1.7976931348623157e+308",
    "9007199254740992",
    "-9007199254740992",
    "295147905179352830000",
    "9.999999999999997e+22",
    "1e+23",
    "1.0000000000000001e+23",
    "999999999999999700000",
    "999999999999999900000",
    "1e+21",
    "9.999999999999997e-7",
    "0.000001",
    "333333333.3333332",
    "333333333.33333325",
    "333333333.3333333",
    "333333333.3333334",
    "333333333.33333343",
    "-0.0000033333333333333333",
    "1424953923781206.2",
  ]);
  expect(Object.is(decode(vectors[1] && "value" in vectors[1] ? vectors[1].value : undefined), -0)).toBe(true);
});

test("rejected_inputs_rejected", async () => {
  const vectors = await read("rejected.json");
  expect(vectors.length).toBeGreaterThan(0);
  for (const [index, vector] of vectors.entries()) {
    expect(isPackageVector(vector, `rejected.json[${index}]`), `rejected.json[${index}]`).toBe(false);
    expect("rejected" in vector, `rejected.json[${index}]`).toBe(true);
    expect(
      () => canonicalJson(decode("value" in vector ? vector.value : undefined)),
      `rejected.json[${index}]`,
    ).toThrow(TypeError);
  }
});

test("package_hash_vectors_through_public_exports", async () => {
  const vectors = await read("packages.json");
  expect(vectors.length).toBeGreaterThanOrEqual(2);
  for (const [index, vector] of vectors.entries()) {
    const where = `packages.json[${index}]`;
    expect(isPackageVector(vector, where), where).toBe(true);
    const { package: pkg, hash } = vector as PackageVector;
    const { hash: _, ...content } = pkg;
    const { format, manifest, code, scenarios } = content;
    expect(hash, where).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(hash, where).toBe(pkg.hash);
    expect(`sha256-${sha256(utf8(canonicalJson({ format, manifest, code, scenarios })))}`, where).toBe(hash);
    expect(packageHash(content), where).toBe(hash);
  }
  expect(vectors.some((vector) => /\P{ASCII}/u.test((vector as PackageVector).package.code))).toBe(true);
});
