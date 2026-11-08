import type { Result } from "../errors.ts";
import { bool, int, obj, str } from "../schema.ts";
import { documentChecks } from "./capabilities.ts";
import { checkFormat } from "./check.ts";
import { validateJson } from "./json.ts";
import { treeSchema, type UiNode } from "./tree.ts";

export type PatchOp =
  | ({ readonly op: "set" } & Omit<UiNode, "children">)
  | { readonly op: "insert"; readonly parent: string; readonly index: number; readonly node: UiNode }
  | { readonly op: "remove"; readonly id: string }
  | { readonly op: "move"; readonly id: string; readonly index: number };
export type TreePatch = {
  readonly format: "liveframe/tree-patch/1";
  readonly catalogId: string;
  readonly surfaceId: string;
  readonly base: number;
  readonly revision: number;
  readonly ops: readonly PatchOp[];
};
const natural = int({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const tag = (value: string) => str({ maxLength: value.length, enum: [value] });
const fields = obj({
  format: tag("liveframe/tree-patch/1"),
  catalogId: treeSchema.properties.catalogId,
  surfaceId: treeSchema.properties.surfaceId,
  base: natural,
  revision: natural,
  ops: bool(),
});
// Patch transport checks JSON shape; applyPatch validates style domains against the installation.
const nodeProperties = {
  ...treeSchema.$defs.node.properties,
  style: { type: "object", additionalProperties: { $ref: "#/$defs/json" } },
} as const;
const { children: _children, ...ownFields } = nodeProperties;
const id = str({ ...ownFields.id, maxLength: Number.MAX_SAFE_INTEGER });
const setFields = obj(
  { op: tag("set"), id, kind: ownFields.kind, props: bool() },
  { variant: ownFields.variant, style: bool(), events: bool(), when: bool(), bind: bool() },
);
const insertFields = obj({ op: tag("insert"), parent: id, index: natural, node: bool() });
const removeFields = obj({ op: tag("remove"), id });
const moveFields = obj({ op: tag("move"), id, index: natural });

export const treePatchSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    ops: {
      type: "array",
      items: {
        oneOf: [
          { ...setFields, properties: { op: tag("set"), ...ownFields } },
          { ...insertFields, properties: { ...insertFields.properties, node: { $ref: "#/$defs/node" } } },
          removeFields,
          moveFields,
        ],
      },
    },
  },
  $defs: { ...treeSchema.$defs, node: { ...treeSchema.$defs.node, properties: nodeProperties } },
} as const;

/** Structural checks only; validate the complete applied tree before accepting it. */
export function validateTreePatch(doc: unknown): Result<TreePatch> {
  const json = validateJson(doc);
  if (!json.ok) return json;
  const c = documentChecks();
  c.collect(checkFormat(treePatchSchema, doc), "");
  if (!c.errors.length) {
    const patch = doc as TreePatch;
    if (patch.revision <= patch.base) c.reject("/revision", "Expected revision greater than base");
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as TreePatch };
}
