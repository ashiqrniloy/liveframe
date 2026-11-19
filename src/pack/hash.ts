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
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
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
// Shared scratch: sha256 and digest are synchronous and never re-entered.
const w = new Int32Array(64);
const state = new Int32Array(8);
const buf = new Uint8Array(8192);
let pos = 0;
let total = 0;
let surrogate = false;

// Lookup tables for single-pass JSON string escaping + UTF-8 encoding.
const SAFE = new Uint8Array(65536);
for (let c = 0x20; c < 0x80; c++) {
  if (c !== 0x22 && c !== 0x5c) SAFE[c] = c;
}
const HEX = new Uint8Array([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102]);
const ESC = new Uint8Array(128);
ESC[8] = 98;
ESC[9] = 116;
ESC[10] = 110;
ESC[12] = 102;
ESC[13] = 114;
ESC[0x22] = 0x22;
ESC[0x5c] = 0x5c;

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

/** Pads the final `< 64`-byte remainder with `0x80` and the 64-bit bit-length, then formats `state` as hex. */
function finishSha256(remainder: Uint8Array, rest: number, byteLen: number): string {
  const tail = new Uint8Array(rest < 56 ? 64 : 128);
  tail.set(remainder);
  tail[rest] = 0x80;
  const high = Math.floor(byteLen / 0x20000000);
  const low = (byteLen * 8) >>> 0;
  for (let i = 0; i < 4; i++) {
    tail[tail.length - 8 + i] = high >>> (24 - 8 * i);
    tail[tail.length - 4 + i] = low >>> (24 - 8 * i);
  }
  for (let offset = 0; offset < tail.length; offset += 64) compress(tail, offset);
  return Array.from(state, (value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

export function sha256(bytes: Uint8Array): string {
  state.set(H0);
  const full = bytes.length - (bytes.length % 64);
  for (let offset = 0; offset < full; offset += 64) compress(bytes, offset);
  const rest = bytes.length - full;
  return finishSha256(bytes.subarray(full), rest, bytes.length);
}

function flush(): void {
  const full = pos & ~63;
  for (let off = 0; off < full; off += 64) compress(buf, off);
  total += full;
  const rem = pos & 63;
  if (rem > 0 && full > 0) buf.copyWithin(0, full, pos);
  pos = rem;
}

function writeSpecialUnit(str: string, i: number, len: number): number {
  const c = str.charCodeAt(i);
  if (c < 0x80) {
    buf[pos++] = 0x5c;
    const esc = ESC[c] as number;
    if (esc) buf[pos++] = esc;
    else {
      buf[pos++] = 117;
      buf[pos++] = 48;
      buf[pos++] = 48;
      buf[pos++] = HEX[c >>> 4] as number;
      buf[pos++] = HEX[c & 15] as number;
    }
    return i + 1;
  }
  if (c < 0x800) {
    buf[pos++] = 0xc0 | (c >>> 6);
    buf[pos++] = 0x80 | (c & 63);
    return i + 1;
  }
  if (c < 0xd800 || c > 0xdfff) {
    buf[pos++] = 0xe0 | (c >>> 12);
    buf[pos++] = 0x80 | ((c >>> 6) & 63);
    buf[pos++] = 0x80 | (c & 63);
    return i + 1;
  }
  // Record a lone surrogate and report it after the walk so a non-JSON value elsewhere still wins.
  const low = c <= 0xdbff && i + 1 < len ? str.charCodeAt(i + 1) : 0;
  if (low < 0xdc00 || low > 0xdfff) {
    surrogate = true;
    return i + 1;
  }
  const pt = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00);
  buf[pos++] = 0xf0 | (pt >>> 18);
  buf[pos++] = 0x80 | ((pt >>> 12) & 63);
  buf[pos++] = 0x80 | ((pt >>> 6) & 63);
  buf[pos++] = 0x80 | (pt & 63);
  return i + 2;
}

function writeLongString(str: string, len: number): void {
  let i = 0;
  while (i < len) {
    if (pos > 4096) flush();
    const end = Math.min(i + 600, len);
    let p = pos;
    while (i < end) {
      const b = SAFE[str.charCodeAt(i)] as number;
      if (b !== 0) {
        buf[p++] = b;
        i++;
      } else {
        pos = p;
        i = writeSpecialUnit(str, i, len);
        p = pos;
      }
    }
    pos = p;
  }
  if (pos > 8000) flush();
  buf[pos++] = 0x22;
}

function writeString(str: string): void {
  const len = str.length;
  if (pos > 4096) flush();
  buf[pos++] = 0x22;
  if (len > 600) {
    writeLongString(str, len);
    return;
  }
  let p = pos;
  for (let i = 0; i < len; ) {
    const b = SAFE[str.charCodeAt(i)] as number;
    if (b !== 0) {
      buf[p++] = b;
      i++;
    } else {
      pos = p;
      i = writeSpecialUnit(str, i, len);
      p = pos;
    }
  }
  buf[p++] = 0x22;
  pos = p;
}

function writeNumber(value: number): void {
  if (!Number.isFinite(value)) throw new TypeError(notJson);
  if ((value | 0) === value && value >= 0 && value < 10) {
    buf[pos++] = 48 + value;
    return;
  }
  const s = String(value);
  for (let i = 0; i < s.length; i++) buf[pos++] = s.charCodeAt(i);
}

function writeScalar(value: unknown): boolean {
  if (typeof value === "string") {
    writeString(value);
    return true;
  }
  if (pos > 8000) flush();
  if (typeof value === "number") {
    writeNumber(value);
    return true;
  }
  if (typeof value === "boolean") {
    if (value) {
      buf[pos++] = 116;
      buf[pos++] = 114;
      buf[pos++] = 117;
      buf[pos++] = 101;
    } else {
      buf[pos++] = 102;
      buf[pos++] = 97;
      buf[pos++] = 108;
      buf[pos++] = 115;
      buf[pos++] = 101;
    }
    return true;
  }
  if (value === null) {
    buf[pos++] = 110;
    buf[pos++] = 117;
    buf[pos++] = 108;
    buf[pos++] = 108;
    return true;
  }
  if (typeof value === "object") return false;
  throw new TypeError(notJson);
}

const stackItems: object[] = [];
const stackKeys: (string[] | undefined)[] = [];
const stackIdx: number[] = [];
let ancestorSet: Set<object> | undefined;

function checkCycle(entry: object, depth: number): void {
  if (depth === 32 && !ancestorSet) {
    ancestorSet = new Set<object>();
    for (let i = 0; i < 32; i++) ancestorSet.add(stackItems[i] as object);
  }
  if (ancestorSet) {
    if (ancestorSet.has(entry)) throw new TypeError(notJson);
    ancestorSet.add(entry);
    return;
  }
  for (let i = 0; i < depth; i++) if (stackItems[i] === entry) throw new TypeError(notJson);
}

function enter(entry: object, depth: number): string[] | undefined {
  const array = Array.isArray(entry);
  const proto = array ? undefined : Object.getPrototypeOf(entry);
  if (!array && proto !== Object.prototype && proto !== null) throw new TypeError(notJson);
  checkCycle(entry, depth);
  if (pos > 8000) flush();
  buf[pos++] = array ? 0x5b : 0x7b;
  return array ? undefined : Object.keys(entry).sort();
}

function stepContainer(depth: number): number {
  const item = stackItems[depth] as object;
  const keys = stackKeys[depth];
  const len = keys ? keys.length : (item as unknown[]).length;
  let idx = stackIdx[depth] as number;
  while (idx < len) {
    if (idx > 0) buf[pos++] = 0x2c;
    let child: unknown;
    if (keys) {
      const key = keys[idx] as string;
      writeString(key);
      buf[pos++] = 0x3a;
      child = (item as Record<string, unknown>)[key];
    } else {
      child = (item as unknown[])[idx];
    }
    idx++;
    if (!writeScalar(child)) {
      stackIdx[depth] = idx;
      const next = depth + 1;
      const childObj = child as object;
      stackItems[next] = childObj;
      stackKeys[next] = enter(childObj, next);
      stackIdx[next] = 0;
      return next;
    }
  }
  if (pos > 8000) flush();
  buf[pos++] = keys ? 0x7d : 0x5d;
  if (ancestorSet) ancestorSet.delete(item);
  return depth - 1;
}

/**
 * Streams the canonical JSON UTF-8 bytes of `value` straight into the SHA-256 block function,
 * returning `sha256(utf8(canonicalJson(value)))` without allocating the full canonical string or byte buffer.
 */
export function digest(value: unknown): string {
  state.set(H0);
  pos = 0;
  total = 0;
  surrogate = false;
  if (!writeScalar(value)) {
    try {
      stackItems[0] = value as object;
      stackKeys[0] = enter(value as object, 0);
      stackIdx[0] = 0;
      let depth = 0;
      while (depth >= 0) depth = stepContainer(depth);
    } finally {
      stackItems.length = 0;
      stackKeys.length = 0;
      ancestorSet = undefined;
    }
  }
  if (surrogate) throw new TypeError(notUnicode);
  flush();
  return finishSha256(buf.subarray(0, pos), pos, total + pos);
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
  actions = {},
}: {
  readonly hash: string;
  readonly catalogId: string;
  readonly params: unknown;
  readonly state: unknown;
  readonly data: unknown;
  readonly context: unknown;
  /** The host's action statuses; absent hashes as `{}`, so a host that reports none still gets one key per input set. */
  readonly actions?: unknown;
}): string {
  return digest({ hash, catalogId, params, state, data, context, actions });
}

/** The hash covers whichever of `code` and `template` the package holds, so a code package's hash is unchanged. */
export function packageHash(pkg: Omit<WidgetPackage, "hash">): string {
  const { format, manifest, scenarios } = pkg;
  const body = pkg.template === undefined ? { code: pkg.code } : { template: pkg.template };
  return `sha256-${digest({ format, manifest, scenarios, ...body })}`;
}
