import type { WidgetPackage } from "../formats/package.ts";

const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const notJson = "Expected a JSON value";
const notUnicode = "Expected Unicode without lone surrogates";

/** Marks where a container's members end, so it stops being an ancestor (cycle detection). */
class Exit {
  constructor(readonly container: object) {}
}

/** Canonical text of a scalar, or `undefined` for a container; throws for anything that is not JSON. */
function scalar(value: unknown, flags: { surrogate: boolean }): string | undefined {
  if (typeof value === "string") {
    // A lone surrogate is reported after the walk, so a non-JSON value still wins, as when the value was validated first.
    if (loneSurrogate.test(value)) flags.surrogate = true;
    return JSON.stringify(value);
  }
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value === "object") return undefined;
  throw new TypeError(notJson);
}

/** Pushes one container's members in reverse, so the stack emits them in order; scalars become text here. */
function pushMembers(item: object, pending: (string | object)[], flags: { surrogate: boolean }): void {
  const array = Array.isArray(item);
  const keys = array ? undefined : Object.keys(item).sort();
  const length = array ? item.length : (keys as string[]).length;
  for (let i = length - 1; i >= 0; i--) {
    let prefix = i > 0 ? "," : "";
    let child: unknown;
    if (keys) {
      const key = keys[i] as string;
      if (loneSurrogate.test(key)) flags.surrogate = true;
      prefix += `${JSON.stringify(key)}:`;
      child = (item as Record<string, unknown>)[key];
    } else child = (item as unknown[])[i];
    const text = scalar(child, flags);
    if (text !== undefined) pending.push(prefix + text);
    else {
      pending.push(child as object);
      if (prefix) pending.push(prefix);
    }
  }
}

/**
 * RFC 8785: sort raw UTF-16 keys, retaining array order and ECMAScript primitives.
 * One iterative walk both checks that the value is JSON (no cycles, non-finite numbers, foreign
 * objects) and writes the canonical text, so a hash pays for a single traversal.
 * Byte-exact serialisation, not validation: it throws on the first non-JSON value, while the
 * validator collects bounded errors and render only asks whether a value is JSON.
 */
export function canonicalJson(value: unknown): string {
  const flags = { surrogate: false };
  const root = scalar(value, flags);
  if (root !== undefined) {
    if (flags.surrogate) throw new TypeError(notUnicode);
    return root;
  }
  const ancestors = new Set<object>();
  const pending: (string | object)[] = [value as object];
  let output = "";
  while (pending.length) {
    const entry = pending.pop() as string | object;
    if (typeof entry === "string") {
      output += entry;
      continue;
    }
    if (entry instanceof Exit) {
      ancestors.delete(entry.container);
      continue;
    }
    const array = Array.isArray(entry);
    const prototype = array ? undefined : Object.getPrototypeOf(entry);
    if (ancestors.has(entry) || (!array && prototype !== Object.prototype && prototype !== null))
      throw new TypeError(notJson);
    ancestors.add(entry);
    output += array ? "[" : "{";
    pending.push(new Exit(entry), array ? "]" : "}");
    pushMembers(entry, pending, flags);
  }
  if (flags.surrogate) throw new TypeError(notUnicode);
  return output;
}

/** Encodes `text` from unit `i` on into `bytes` at `written`; returns the end. Lone surrogates throw. */
function encodeRest(text: string, bytes: Uint8Array, i: number, written: number): number {
  for (; i < text.length; i++) {
    let point = text.charCodeAt(i);
    if (point >= 0xd800 && point <= 0xdfff) {
      const low = point <= 0xdbff && i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (low < 0xdc00 || low > 0xdfff) throw new TypeError(notUnicode);
      point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
      i++;
    }
    if (point < 0x80) bytes[written++] = point;
    else {
      if (point < 0x800) bytes[written++] = 0xc0 | (point >>> 6);
      else {
        if (point < 0x10000) bytes[written++] = 0xe0 | (point >>> 12);
        else {
          bytes[written++] = 0xf0 | (point >>> 18);
          bytes[written++] = 0x80 | ((point >>> 12) & 63);
        }
        bytes[written++] = 0x80 | ((point >>> 6) & 63);
      }
      bytes[written++] = 0x80 | (point & 63);
    }
  }
  return written;
}

/** UTF-8 without host APIs; invalid Unicode is rejected rather than replaced. */
export function utf8(text: string): Uint8Array {
  const ascii = new Uint8Array(text.length);
  let i = 0;
  for (; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x80) break;
    ascii[i] = code;
  }
  if (i === text.length) return ascii;
  // First non-ASCII unit: grow to the worst case for the rest (3 bytes per unit) and finish there.
  const wide = new Uint8Array(i + (text.length - i) * 3);
  wide.set(ascii.subarray(0, i));
  return wide.subarray(0, encodeRest(text, wide, i, i));
}

// FIPS 180-4 §4.2.2, §5.3.3 and §6.2: constants, initial state and compression.
// Int32Arrays and `| 0` keep every intermediate a 32-bit integer; `>>> 0` appears only when printing.
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);
// Shared scratch: sha256 is synchronous and never re-entered, so one schedule and one state serve every call.
const w = new Int32Array(64);
const state = new Int32Array(8);

/** Compresses the 64-byte block of `src` at `offset` into `state`. */
function compress(src: Uint8Array, offset: number): void {
  for (let i = 0, at = offset; i < 16; i++, at += 4)
    w[i] =
      ((src[at] as number) << 24) |
      ((src[at + 1] as number) << 16) |
      ((src[at + 2] as number) << 8) |
      (src[at + 3] as number);
  for (let i = 16; i < 64; i++) {
    const x = w[i - 15] as number;
    const y = w[i - 2] as number;
    w[i] =
      (w[i - 16] as number) +
      (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) +
      (w[i - 7] as number) +
      (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10));
  }
  let a = state[0] as number;
  let b = state[1] as number;
  let c = state[2] as number;
  let d = state[3] as number;
  let e = state[4] as number;
  let f = state[5] as number;
  let g = state[6] as number;
  let h = state[7] as number;
  for (let i = 0; i < 64; i++) {
    const t1 =
      (h +
        (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) +
        (g ^ (e & (f ^ g))) +
        (K[i] as number) +
        (w[i] as number)) |
      0;
    const t2 =
      ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) | (c & (a | b)))) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  state[0] = (state[0] as number) + a;
  state[1] = (state[1] as number) + b;
  state[2] = (state[2] as number) + c;
  state[3] = (state[3] as number) + d;
  state[4] = (state[4] as number) + e;
  state[5] = (state[5] as number) + f;
  state[6] = (state[6] as number) + g;
  state[7] = (state[7] as number) + h;
}

export function sha256(bytes: Uint8Array): string {
  state.set([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const full = bytes.length - (bytes.length % 64);
  for (let offset = 0; offset < full; offset += 64) compress(bytes, offset);
  // The unaligned tail plus the 0x80 marker and the 64-bit length fill one or two final blocks.
  const rest = bytes.length - full;
  const tail = new Uint8Array(rest < 56 ? 64 : 128);
  tail.set(bytes.subarray(full));
  tail[rest] = 0x80;
  const high = Math.floor(bytes.length / 0x20000000);
  const low = (bytes.length * 8) >>> 0;
  for (let i = 0; i < 4; i++) {
    tail[tail.length - 8 + i] = high >>> (24 - 8 * i);
    tail[tail.length - 4 + i] = low >>> (24 - 8 * i);
  }
  for (let offset = 0; offset < tail.length; offset += 64) compress(tail, offset);
  return Array.from(state, (value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

/**
 * The re-run cache key of one render (spec §8): SHA-256 over the package hash, the catalog id and
 * the render's inputs in canonical JSON, so equal inputs in any key order give the same key. A host
 * that finds the key unchanged may skip the re-run and the transfer.
 */
export function renderKey({
  hash,
  catalogId,
  params,
  state,
  data,
  context,
}: {
  readonly hash: string;
  readonly catalogId: string;
  readonly params: unknown;
  readonly state: unknown;
  readonly data: unknown;
  readonly context: unknown;
}): string {
  return sha256(utf8(canonicalJson({ hash, catalogId, params, state, data, context })));
}

export function packageHash({ format, manifest, code, scenarios }: Omit<WidgetPackage, "hash">): string {
  return `sha256-${sha256(utf8(canonicalJson({ format, manifest, code, scenarios })))}`;
}
