import { templateSchema } from "../template/schema.ts";
import { capabilitiesSchema } from "./capabilities.ts";
import { catalogSchema } from "./catalog.ts";
import { designSystemSchema } from "./design-system.ts";
import { schemaLanguage } from "./language.ts";
import { manifestSchema } from "./manifest.ts";
import { widgetPackageSchema } from "./package.ts";
import { placementSchema, styleRecordSchema } from "./records.ts";
import { themeSchema } from "./theme.ts";
import { treeSchema } from "./tree.ts";
import { treePatchSchema } from "./tree-patch.ts";

/** One place builds every published id. A URN names the format and its version, not a domain or a package version. */
const schemaId = (format: string) => `urn:liveframe:${format}:1`;

/** Add each format here; publishing and drift checks both read this registry. */
export const formats = {
  "ui-tree": treeSchema,
  "tree-patch": treePatchSchema,
  "design-system": designSystemSchema,
  theme: themeSchema,
  "schema-language": schemaLanguage,
  capabilities: capabilitiesSchema,
  manifest: manifestSchema,
  template: templateSchema,
  "widget-package": widgetPackageSchema,
  placement: placementSchema,
  "style-record": styleRecordSchema,
  catalog: catalogSchema,
} as const;

export function schemaDocument(name: keyof typeof formats) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaId(name),
    ...formats[name],
  };
}
