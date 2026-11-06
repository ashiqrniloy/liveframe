import { literal } from "../schema.ts";

const annotations = {
  description: { type: "string" },
  deprecated: { type: "boolean" },
  nullable: { type: "boolean" },
} as const;
const bound = { type: "integer", minimum: 0 } as const;
const schemaRef = { $ref: "#/$defs/schema" } as const;
/** The `url` keyword (spec §5). Widget schemas keep it: it is a closed check, not a regular expression. */
const urlRule = {
  type: "object",
  properties: {
    schemes: {
      type: "array",
      items: { type: "string", maxLength: 32, pattern: "^[a-z][a-z0-9+.-]*$" },
      minItems: 1,
      maxItems: 16,
      uniqueItems: true,
    },
    relative: { type: "boolean" },
  },
  required: ["schemes"],
  additionalProperties: false,
} as const;

function form(type: string, properties: Record<string, unknown>, required: readonly string[]) {
  return {
    type: "object",
    properties: { type: literal(type), ...annotations, ...properties },
    required: ["type", ...required],
    additionalProperties: false,
  };
}

export const objectSchema = form(
  "object",
  {
    properties: { type: "object", additionalProperties: schemaRef },
    required: { type: "array", items: { type: "string" }, uniqueItems: true },
    additionalProperties: literal(false),
  },
  ["properties", "required", "additionalProperties"],
);

/** Manifest params, state and context may not use pattern (spec §5), so its schema omits it. */
export function languageForms(pattern: boolean) {
  return {
    schema: {
      oneOf: [
        form(
          "string",
          {
            maxLength: bound,
            minLength: bound,
            ...(pattern ? { pattern: { type: "string", maxLength: 256, format: "regex" } } : {}),
            url: urlRule,
            enum: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
          },
          ["maxLength"],
        ),
        form("number", { minimum: { type: "number" }, maximum: { type: "number" } }, []),
        form("integer", { minimum: { type: "number" }, maximum: { type: "number" } }, []),
        form("boolean", {}, []),
        form("array", { items: schemaRef, maxItems: bound, minItems: bound }, ["items", "maxItems"]),
        objectSchema,
        {
          type: "object",
          properties: {
            ...annotations,
            discriminator: { type: "string" },
            mapping: {
              type: "object",
              minProperties: 1,
              maxProperties: 64,
              propertyNames: { maxLength: 64 },
              additionalProperties: {
                ...objectSchema,
                properties: { ...objectSchema.properties, nullable: literal(false) },
              },
            },
          },
          required: ["discriminator", "mapping"],
          additionalProperties: false,
        },
      ],
    },
  };
}

export const schemaLanguage = { $ref: "#/$defs/schema", $defs: languageForms(true) } as const;

export const jsonSchema = {
  anyOf: [
    { type: "null" },
    { type: "boolean" },
    { type: "number" },
    { type: "string" },
    { type: "array", items: { $ref: "#/$defs/json" } },
    { type: "object", additionalProperties: { $ref: "#/$defs/json" } },
  ],
} as const;
