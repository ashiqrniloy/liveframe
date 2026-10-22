import { literal } from "../schema.ts";

const annotations = { description: { type: "string" }, deprecated: { type: "boolean" } } as const;
const bound = { type: "integer", minimum: 0 } as const;
const schemaRef = { $ref: "#/$defs/schema" } as const;

function form(type: string, properties: Record<string, unknown>, required: readonly string[]) {
  return {
    type: "object",
    properties: { type: literal(type), ...annotations, ...properties },
    required: ["type", ...required],
    additionalProperties: false,
  };
}

const schemaLanguage = {
  $ref: "#/$defs/schema",
  $defs: {
    schema: {
      oneOf: [
        form(
          "string",
          {
            maxLength: bound,
            pattern: { type: "string", maxLength: 256, format: "regex" },
            enum: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
          },
          ["maxLength"],
        ),
        form("number", { minimum: { type: "number" }, maximum: { type: "number" } }, []),
        form("integer", { minimum: { type: "number" }, maximum: { type: "number" } }, []),
        form("boolean", {}, []),
        form("array", { items: schemaRef, maxItems: bound }, ["items", "maxItems"]),
        form(
          "object",
          {
            properties: { type: "object", additionalProperties: schemaRef },
            required: { type: "array", items: { type: "string" }, uniqueItems: true },
            additionalProperties: literal(false),
          },
          ["properties", "required", "additionalProperties"],
        ),
      ],
    },
  },
} as const;

/** Add each format here; publishing and drift checks both read this registry. */
export const formats = { "schema-language": schemaLanguage } as const;

export function schemaDocument(name: keyof typeof formats) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://liveframe.dev/schemas/${name}.json`,
    ...formats[name],
  };
}
