import { validateJson } from "../formats/json.ts";
import type { WidgetPackage } from "../formats/package.ts";

const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
function jsonString(value: string): string {
  if (loneSurrogate.test(value)) throw new TypeError("Expected Unicode without lone surrogates");
  return JSON.stringify(value);
}

/** One container's members, pushed in reverse so the stack emits them in order. */
function pushMembers(
  item: object,
  keys: readonly string[],
  array: boolean,
  pending: (string | { value: unknown })[],
): void {
  for (let i = keys.length - 1; i >= 0; i--) {
    const key = keys[i] as string;
    if (i < keys.length - 1) pending.push(",");
    pending.push({ value: (item as Record<string, unknown>)[key] });
    if (!array) pending.push(`${jsonString(key)}:`);
  }
}

/**
 * RFC 8785: sort raw UTF-16 keys, retaining array order and ECMAScript primitives.
 * Byte-exact serialisation, not validation: its own walk because hashing needs the canonical text,
 * while the validator collects errors and render only asks whether a value is JSON.
 */
export function canonicalJson(value: unknown): string {
  if (!validateJson(value).ok) throw new TypeError("Expected a JSON value");
  const output: string[] = [];
  const pending: (string | { value: unknown })[] = [{ value }];
  while (pending.length) {
    const entry = pending.pop();
    if (typeof entry === "string") {
      output.push(entry);
      continue;
    }
    if (!entry) break;
    const item = entry.value;
    if (typeof item === "string") output.push(jsonString(item));
    else if (item === null || typeof item !== "object") output.push(JSON.stringify(item));
    else {
      const array = Array.isArray(item);
      const keys = array ? Array.from({ length: item.length }, (_, i) => String(i)) : Object.keys(item).sort();
      output.push(array ? "[" : "{");
      pending.push(array ? "]" : "}");
      pushMembers(item, keys, array, pending);
    }
  }
  return output.join("");
}

/** UTF-8 without host APIs; invalid Unicode is rejected rather than replaced. */
export function utf8(text: string): Uint8Array {
  if (loneSurrogate.test(text)) throw new TypeError("Expected Unicode without lone surrogates");
  const bytes = new Uint8Array(text.length * 3);
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    let point = text.charCodeAt(i);
    if (point >= 0xd800 && point <= 0xdbff) {
      point = 0x10000 + ((point - 0xd800) << 10) + (text.charCodeAt(++i) - 0xdc00);
    }
    if (point < 0x80) bytes[length++] = point;
    else {
      if (point < 0x800) bytes[length++] = 0xc0 | (point >>> 6);
      else {
        if (point < 0x10000) bytes[length++] = 0xe0 | (point >>> 12);
        else {
          bytes[length++] = 0xf0 | (point >>> 18);
          bytes[length++] = 0x80 | ((point >>> 12) & 63);
        }
        bytes[length++] = 0x80 | ((point >>> 6) & 63);
      }
      bytes[length++] = 0x80 | (point & 63);
    }
  }
  return bytes.subarray(0, length);
}

// FIPS 180-4 §4.2.2, §5.3.3 and §6.2: constants, initial state and compression.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);
const rotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
export function sha256(bytes: Uint8Array): string {
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(padded.length - 4, bytes.length * 8);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = view.getUint32(offset + i * 4);
      else {
        const x = w[i - 15] as number,
          y = w[i - 2] as number;
        w[i] =
          (w[i - 16] as number) +
          (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
          (w[i - 7] as number) +
          (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
      }
    }
    let a = hash[0] as number,
      b = hash[1] as number,
      c = hash[2] as number,
      d = hash[3] as number,
      e = hash[4] as number,
      f = hash[5] as number,
      g = hash[6] as number,
      h = hash[7] as number;
    for (let i = 0; i < 64; i++) {
      const t1 =
        h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + (K[i] as number) + (w[i] as number);
      const t2 = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] = (hash[0] as number) + a;
    hash[1] = (hash[1] as number) + b;
    hash[2] = (hash[2] as number) + c;
    hash[3] = (hash[3] as number) + d;
    hash[4] = (hash[4] as number) + e;
    hash[5] = (hash[5] as number) + f;
    hash[6] = (hash[6] as number) + g;
    hash[7] = (hash[7] as number) + h;
  }
  return Array.from(hash, (value) => value.toString(16).padStart(8, "0")).join("");
}

export function packageHash({ format, manifest, code, scenarios }: Omit<WidgetPackage, "hash">): string {
  return `sha256-${sha256(utf8(canonicalJson({ format, manifest, code, scenarios })))}`;
}
