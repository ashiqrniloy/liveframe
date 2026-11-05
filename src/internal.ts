// Small helpers shared across the library. Internal: no subpath exports this module.
import type { LiveframeError } from "./errors.ts";

/** Recognises a foreign plain object without reading its document fields. */
export function realmError(value: unknown, pointer = ""): LiveframeError | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return;
  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== null &&
    prototype !== Object.prototype &&
    Object.getPrototypeOf(prototype) === null &&
    Object.prototype.toString.call(value) === "[object Object]"
  )
    return {
      kind: "invalid-document",
      pointer,
      message:
        "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)",
    };
}

/**
 * `pointer` extended by one JSON Pointer reference token (RFC 6901 §3): `~` escapes before `/`, and
 * plain keys pass through. On the validators' hot path, so it does the work itself rather than calling
 * `pointerSegment`.
 */
export function at(pointer: string, key: string | number): string {
  const name = String(key);
  return `${pointer}/${name.includes("~") || name.includes("/") ? name.replaceAll("~", "~0").replaceAll("/", "~1") : name}`;
}

/** One escaped reference token, for the few places that build a pointer without a base. */
export function pointerSegment(key: string | number): string {
  return at("", key).slice(1);
}

/** The message of a thrown value, whatever was thrown. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A serial promise queue: each task starts after the previous one settles, and a failure does not break the chain. */
export function queue(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (work) => {
    const run = tail.then(work);
    tail = run.catch(() => {});
    return run;
  };
}

/** Whether `value` is a promise or another object with a callable `then`. */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * UTF-8 bytes of `text` as `TextEncoder` writes it: a lone surrogate counts as U+FFFD (3 bytes).
 * Counting stops once it passes `maximum`, so the result is exact only up to `maximum`.
 */
export function utf8Length(text: string, maximum = Infinity): number {
  let bytes = 0;
  for (let i = 0; i < text.length && bytes <= maximum; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Copies validated JSON and freezes every owned container. */
export function freezeCopy<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const copy = Array.isArray(value)
    ? value.map((entry) => freezeCopy(entry))
    : Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freezeCopy(entry)]));
  return Object.freeze(copy) as T;
}
