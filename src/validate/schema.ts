import type { LiveframeError } from "../errors.ts";
import { codePointsWithin, type LanguageSchema } from "../schema.ts";

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

type ObjectCheck = {
  readonly properties: Map<string, SchemaCheck>;
  readonly required: readonly { readonly key: string; readonly expected: string }[];
  readonly expected: string;
  readonly objectExpected: string;
};

/** Compiles an install-validated language schema; checks allocate only on failure. */
/** A missing required property, reported at its own pointer. */
function missing(sink: SchemaSink, at: string, key: string, expected: string): false {
  const start = sink.errors.length;
  const failed = reject("", sink, expected);
  prefixErrors(sink, start, at, key);
  return failed;
}

/** One declared property: its own check, or "not declared"; failures are re-based on the key. */
function checkProperty(
  check: SchemaCheck | undefined,
  value: unknown,
  at: string,
  key: string,
  sink: SchemaSink,
  expected: string,
): boolean {
  const start = sink.errors.length;
  const passed = check ? check(value, "", sink) : reject("", sink, expected);
  if (passed) return true;
  prefixErrors(sink, start, at, key);
  return false;
}

/** The object case of `compileSchema`: required properties first, then every declared property. */
function objectCheck(spec: ObjectCheck): SchemaCheck {
  return (value, at, sink) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      return reject(at, sink, spec.objectExpected);
    let valid = true;
    for (const { key, expected } of spec.required) {
      if (!valid && sink.errors.length >= sink.maxErrors) return false;
      if (!Object.hasOwn(value, key)) valid = missing(sink, at, key, expected);
    }
    for (const key in value) {
      if (!valid && sink.errors.length >= sink.maxErrors) return false;
      if (!Object.hasOwn(value, key)) continue;
      const check = spec.properties.get(key);
      if (!checkProperty(check, (value as Record<string, unknown>)[key], at, key, sink, spec.expected)) valid = false;
    }
    return valid;
  };
}

export function compileSchema(schema: LanguageSchema): SchemaCheck {
  const check = compileForm(schema);
  return schema.nullable === true ? (value, at, sink) => value === null || check(value, at, sink) : check;
}

function compileForm(schema: LanguageSchema): SchemaCheck {
  switch (schema.type) {
    case "string": {
      const { maxLength, minLength } = schema;
      const choices = schema.enum ? new Set(schema.enum) : undefined;
      const pattern = schema.pattern ? new RegExp(schema.pattern, "u") : undefined;
      const lengthExpected =
        minLength === undefined
          ? `string of at most ${maxLength} characters`
          : `a string of ${minLength}–${maxLength} characters`;
      const enumExpected = `one of: ${schema.enum?.join(", ")}`;
      const patternExpected = `a string matching ${schema.pattern}`;
      const typeExpected = `${lengthExpected}${choices ? `; ${enumExpected}` : ""}${pattern ? `; ${patternExpected}` : ""}`;
      return (value, at, sink) => {
        if (typeof value !== "string") return reject(at, sink, typeExpected);
        let valid = true;
        if (!codePointsWithin(value, maxLength, minLength)) valid = reject(at, sink, lengthExpected);
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
      const { maxItems, minItems = 0 } = schema;
      const item = compileSchema(schema.items);
      const expected =
        schema.minItems === undefined
          ? `an array of at most ${maxItems} items`
          : `an array of ${minItems}–${maxItems} items`;
      return (value, at, sink) => {
        if (!Array.isArray(value)) return reject(at, sink, expected);
        let valid = (value.length >= minItems && value.length <= maxItems) || reject(at, sink, expected);
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
      return objectCheck({
        properties: new Map(Object.entries(schema.properties).map(([key, child]) => [key, compileSchema(child)])),
        required: schema.required.map((key) => ({
          key,
          expected: `the required property ${JSON.stringify(key)}`,
        })),
        expected: `a declared property (one of: ${Object.keys(schema.properties).join(", ") || "none"})`,
        objectExpected: `an object with declared properties: ${Object.keys(schema.properties).join(", ") || "none"}`,
      });
    }
  }
}
