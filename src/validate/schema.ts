import type { LiveframeError } from "../errors.ts";
import type { LanguageSchema } from "../schema.ts";

export type SchemaSink = {
  readonly errors: LiveframeError[];
  readonly maxErrors: number;
  readonly nodeId?: string;
};

export type SchemaCheck = (value: unknown, at: string, sink: SchemaSink) => boolean;

function reject(at: string, sink: SchemaSink, expected: string): false {
  if (sink.errors.length < sink.maxErrors)
    sink.errors.push({
      kind: "invalid-prop",
      pointer: at,
      message: `Expected ${expected}`,
      expected,
      ...(sink.nodeId === undefined ? {} : { nodeId: sink.nodeId }),
    });
  return false;
}

function prefixErrors(sink: SchemaSink, start: number, at: string, key: string | number): void {
  const prefix = `${at}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
  for (let i = start; i < sink.errors.length; i++) {
    const error = sink.errors[i];
    if (error) sink.errors[i] = { ...error, pointer: prefix + error.pointer };
  }
}

function codePointsWithin(value: string, maximum: number): boolean {
  if (value.length <= maximum) return true;
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    if (++count > maximum) return false;
    const first = value.charCodeAt(i);
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(i + 1);
      if (second >= 0xdc00 && second <= 0xdfff) i++;
    }
  }
  return true;
}

/** Compiles an install-validated language schema; checks allocate only on failure. */
export function compileSchema(schema: LanguageSchema): SchemaCheck {
  switch (schema.type) {
    case "string": {
      const { maxLength } = schema;
      const choices = schema.enum ? new Set(schema.enum) : undefined;
      const pattern = schema.pattern ? new RegExp(schema.pattern, "u") : undefined;
      const lengthExpected = `string of at most ${maxLength} characters`;
      const enumExpected = `one of: ${schema.enum?.join(", ")}`;
      const patternExpected = `a string matching ${schema.pattern}`;
      return (value, at, sink) => {
        if (typeof value !== "string") return reject(at, sink, "a string");
        let valid = true;
        if (!codePointsWithin(value, maxLength)) valid = reject(at, sink, lengthExpected);
        if (choices && !choices.has(value)) valid = reject(at, sink, enumExpected);
        if (pattern && !pattern.test(value)) valid = reject(at, sink, patternExpected);
        return valid;
      };
    }
    case "number":
    case "integer": {
      const { minimum, maximum } = schema;
      const integer = schema.type === "integer";
      const typeExpected = `a finite ${schema.type}`;
      const minimumExpected = `a number >= ${minimum}`;
      const maximumExpected = `a number <= ${maximum}`;
      return (value, at, sink) => {
        if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isInteger(value)))
          return reject(at, sink, typeExpected);
        let valid = true;
        if (minimum !== undefined && value < minimum) valid = reject(at, sink, minimumExpected);
        if (maximum !== undefined && value > maximum) valid = reject(at, sink, maximumExpected);
        return valid;
      };
    }
    case "boolean":
      return (value, at, sink) => typeof value === "boolean" || reject(at, sink, "a boolean");
    case "array": {
      const { maxItems } = schema;
      const item = compileSchema(schema.items);
      const expected = `an array of at most ${maxItems} items`;
      return (value, at, sink) => {
        if (!Array.isArray(value)) return reject(at, sink, "an array");
        let valid = value.length <= maxItems || reject(at, sink, expected);
        for (let i = 0; i < value.length; i++) {
          if (!valid && sink.errors.length >= sink.maxErrors) return false;
          const start = sink.errors.length;
          if (!item(value[i], "", sink)) {
            valid = false;
            prefixErrors(sink, start, at, i);
          }
        }
        return valid;
      };
    }
    case "object": {
      const properties = new Map(Object.entries(schema.properties).map(([key, child]) => [key, compileSchema(child)]));
      const required = [...schema.required];
      const expected = `a declared property (one of: ${[...properties.keys()].join(", ") || "none"})`;
      return (value, at, sink) => {
        if (value === null || typeof value !== "object" || Array.isArray(value)) return reject(at, sink, "an object");
        let valid = true;
        for (const key of required) {
          if (!valid && sink.errors.length >= sink.maxErrors) return false;
          if (!Object.hasOwn(value, key)) {
            const start = sink.errors.length;
            valid = reject("", sink, "a required property");
            prefixErrors(sink, start, at, key);
          }
        }
        for (const key in value) {
          if (!valid && sink.errors.length >= sink.maxErrors) return false;
          if (!Object.hasOwn(value, key)) continue;
          const check = properties.get(key);
          const start = sink.errors.length;
          const passed = check ? check((value as Record<string, unknown>)[key], "", sink) : reject("", sink, expected);
          if (!passed) {
            valid = false;
            // Prefix only failures: successful nested checks never build paths.
            prefixErrors(sink, start, at, key);
          }
        }
        return valid;
      };
    }
  }
}
