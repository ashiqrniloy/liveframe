import type { Result } from "../errors.ts";
import { bool, checkValue, type Infer, obj, str } from "../schema.ts";
import { documentChecks, isRecord, shell } from "./capabilities.ts";
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
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a placement object");
  else {
    c.collect(checkValue(placementFields, shell(doc, ["params"])), "");
    if (Object.hasOwn(doc, "params")) c.collect(validateJson(doc.params), "/params");
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Placement };
}

/** The body is JSON here; theme/design-system installation applies its own semantic checks. */
export function validateStyleRecord(doc: unknown): Result<StyleRecord> {
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a style record object");
  else {
    c.collect(checkValue(styleFields, shell(doc, ["body"])), "");
    if (Object.hasOwn(doc, "body")) c.collect(validateJson(doc.body), "/body");
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as StyleRecord };
}

/** State has no record envelope; the placement id is its storage key. */
export function validateState(doc: unknown): Result<Json> {
  return validateJson(doc);
}
