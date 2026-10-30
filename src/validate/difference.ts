import { at } from "../formats/capabilities.ts";

export function difference(expected: unknown, actual: unknown, path = ""): string | undefined {
  if (expected === actual) return;
  if (
    expected === null ||
    actual === null ||
    typeof expected !== "object" ||
    typeof actual !== "object" ||
    Array.isArray(expected) !== Array.isArray(actual)
  )
    return path;
  for (const key of Object.keys(expected)) {
    const pointer = at(path, key);
    if (!Object.hasOwn(actual, key)) return pointer;
    const mismatch = difference(
      (expected as Record<string, unknown>)[key],
      (actual as Record<string, unknown>)[key],
      pointer,
    );
    if (mismatch !== undefined) return mismatch;
  }
  for (const key of Object.keys(actual)) if (!Object.hasOwn(expected, key)) return at(path, key);
}
