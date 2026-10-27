import { designSystemSchema } from "./design-system.ts";
import { literal } from "../schema.ts";
import { catalogSchema } from "./catalog.ts";

import { capabilitiesSchema } from "./capabilities.ts";
import { manifestSchema } from "./manifest.ts";
import { themeSchema } from "./theme.ts";
import { treeSchema } from "./tree.ts";

import { widgetPackageSchema } from "./package.ts";
import { placementSchema, styleRecordSchema } from "./records.ts";

const annotations = {
  description: { type: "string" },
  deprecated: { type: "boolean" },
  nullable: { type: "boolean" },
} as const;
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

/** Manifest params, state and context may not use pattern (spec §5), so its schema omits it. */
function languageForms(pattern: boolean) {
  return {
    schema: {
      oneOf: [
        form(
          "string",
          {
            maxLength: bound,
            minLength: bound,
            ...(pattern ? { pattern: { type: "string", maxLength: 256, format: "regex" } } : {}),
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

const schemaLanguage = { $ref: "#/$defs/schema", $defs: languageForms(true) } as const;

/** One place builds every published id. A URN names the format and its version, not a domain or a package version. */
const schemaId = (format: string) => `urn:liveframe:${format}:1`;

/** Add each format here; publishing and drift checks both read this registry. */
export const formats = {
  "ui-tree": treeSchema,
  "design-system": designSystemSchema,
  theme: themeSchema,
  "schema-language": schemaLanguage,
  capabilities: { ...capabilitiesSchema, $defs: { ...schemaLanguage.$defs, objectSchema } },
  manifest: { ...manifestSchema, $defs: { ...languageForms(false), objectSchema, ...manifestSchema.$defs } },
  "widget-package": {
    ...widgetPackageSchema,
    // A `$ref` by id, so a consumer that adds both published schemas resolves it without a network.
    properties: { ...widgetPackageSchema.properties, manifest: { $ref: schemaId("manifest") } },
  },
  placement: placementSchema,
  "style-record": styleRecordSchema,
  catalog: {
    ...catalogSchema,
    $defs: { ...catalogSchema.$defs, ...schemaLanguage.$defs, objectSchema },
  },
} as const;

export function schemaDocument(name: keyof typeof formats) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaId(name),
    ...formats[name],
  };
}
