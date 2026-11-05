import type { Result } from "../errors.ts";
import { bool, type Infer, obj, str } from "../schema.ts";
import { checkFormat } from "./check.ts";
import { validateJson } from "./json.ts";
import { type Json, treeSchema } from "./tree.ts";

const name = str({ maxLength: 128, pattern: "^.+$" });
const id = str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9.-]*$" });
const placementFields = obj({ id: name, slot: name, widget: obj({ id, version: name }), params: bool() });
export type Placement = Omit<Infer<typeof placementFields>, "params"> & { readonly params: Json };
const styleFields = obj({
  kind: str({ maxLength: 12, enum: ["theme", "designSystem"] }),
  id,
  version: name,
  body: bool(),
});
export type StyleRecord = Omit<Infer<typeof styleFields>, "body"> & { readonly body: Json };
const json = { $ref: "#/$defs/json" } as const;
export const placementSchema = {
  ...placementFields,
  properties: { ...placementFields.properties, params: json },
  $defs: { json: treeSchema.$defs.json },
} as const;
export const styleRecordSchema = {
  ...styleFields,
  properties: { ...styleFields.properties, body: json },
  $defs: { json: treeSchema.$defs.json },
} as const;

export function validatePlacement(doc: unknown): Result<Placement> {
  const json = validateJson(doc);
  if (!json.ok) return json;
  return checkFormat(placementSchema, doc) as Result<Placement>;
}

/** The body is JSON here; theme/design-system installation applies its own semantic checks. */
export function validateStyleRecord(doc: unknown): Result<StyleRecord> {
  const json = validateJson(doc);
  if (!json.ok) return json;
  return checkFormat(styleRecordSchema, doc) as Result<StyleRecord>;
}

/** State has no record envelope; placement id and host scope form its storage key. */
export function validateState(doc: unknown): Result<Json> {
  return validateJson(doc);
}
