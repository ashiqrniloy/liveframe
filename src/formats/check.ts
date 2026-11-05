import type { LiveframeError, Result } from "../errors.ts";
import { compileFormatSchema, type FormatSchema } from "../validate/format-schema.ts";
import type { SchemaCheck } from "../validate/schema.ts";

const compiled = new WeakMap<object, Map<string, SchemaCheck>>();

/** Structure derives from the exact definition published as JSON Schema. Call after the realm check. */
export function checkFormat(
  schema: Exclude<FormatSchema, boolean>,
  value: unknown,
  fragment = "",
  references: Readonly<Record<string, FormatSchema>> = {},
): Result<unknown> {
  let entries = compiled.get(schema);
  if (!entries) {
    entries = new Map();
    compiled.set(schema, entries);
  }
  let check = entries.get(fragment);
  if (!check) {
    check = compileFormatSchema(fragment ? { $ref: `#${fragment}`, $defs: schema.$defs ?? {} } : schema, (id) => {
      const target = references[id];
      if (!target) throw new Error(`Unknown format id: ${id}`);
      return target;
    });
    entries.set(fragment, check);
  }
  const errors: LiveframeError[] = [];
  try {
    const valid = check(value, "", { errors, maxErrors: 20 });
    return valid
      ? { ok: true, value }
      : { ok: false, errors: errors.map((error) => ({ ...error, kind: "invalid-document" })) };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return {
      ok: false,
      errors: [
        { kind: "invalid-document", pointer: "", message: "Expected data within the runtime's nesting capacity" },
      ],
    };
  }
}
