import type { LiveframeError } from "../errors.ts";
import { at } from "../formats/capabilities.ts";
import type { SchemaCheck, SchemaSink } from "./schema.ts";

export function reject(
  sink: SchemaSink,
  pointer: string,
  expected: string,
  kind: LiveframeError["kind"] = "invalid-prop",
): false {
  if (sink.errors.length < sink.maxErrors)
    sink.errors.push({ kind, pointer, expected, message: `Expected ${expected}` });
  return false;
}

/** Child checks use relative pointers so successful checks never construct paths. */
export function field(check: SchemaCheck, value: unknown, sink: SchemaSink, key: string | number): boolean {
  const start = sink.errors.length;
  const valid = check(value, "", sink);
  if (!valid) {
    const prefix = at("", key);
    for (let i = start; i < sink.errors.length; i++) {
      const error = sink.errors[i];
      if (error) sink.errors[i] = { ...error, pointer: prefix + error.pointer };
    }
  }
  return valid;
}

export function closed(value: Record<string, unknown>, allowed: ReadonlySet<string>, sink: SchemaSink): boolean {
  let valid = true;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    if (!allowed.has(key)) valid = reject(sink, at("", key), `one of the fields: ${[...allowed].join(", ")}`);
    if (!valid && sink.errors.length >= sink.maxErrors) break;
  }
  return valid;
}
