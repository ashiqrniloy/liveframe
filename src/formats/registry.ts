import { designSystemSchema } from "./design-system.ts";
import { literal } from "../schema.ts";
import { catalogSchema } from "./catalog.ts";

import { capabilitiesSchema } from "./capabilities.ts";
import { manifestSchema } from "./manifest.ts";
import { themeSchema } from "./theme.ts";
import { treeSchema } from "./tree.ts";

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

const objectSchema = form(
  "object",
  {
    properties: { type: "object", additionalProperties: schemaRef },
    required: { type: "array", items: { type: "string" }, uniqueItems: true },
    additionalProperties: literal(false),
  },
  ["properties", "required", "additionalProperties"],
);

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
        objectSchema,
      ],
    },
  },
} as const;

/** Add each format here; publishing and drift checks both read this registry. */
export const formats = {
  "ui-tree": treeSchema,
  "design-system": designSystemSchema,
  theme: themeSchema,
  "schema-language": schemaLanguage,
  capabilities: { ...capabilitiesSchema, $defs: { ...schemaLanguage.$defs, objectSchema } },
  manifest: { ...manifestSchema, $defs: { ...schemaLanguage.$defs, objectSchema, ...manifestSchema.$defs } },
  catalog: {
    ...catalogSchema,
    $defs: { ...catalogSchema.$defs, ...schemaLanguage.$defs, objectSchema },
  },
} as const;

export function schemaDocument(name: keyof typeof formats) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://liveframe.dev/schemas/${name}.json`,
    ...formats[name],
  };
}
