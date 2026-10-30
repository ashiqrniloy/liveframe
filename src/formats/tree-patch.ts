import type { Result } from "../errors.ts";
import { bool, checkValue, int, obj, str } from "../schema.ts";
import { at, documentChecks, isRecord, shell } from "./capabilities.ts";
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
const { children: _children, ...ownFields } = treeSchema.$defs.node.properties;
const id = str({ ...ownFields.id, maxLength: Number.MAX_SAFE_INTEGER });
const setFields = obj(
  { op: tag("set"), id, kind: ownFields.kind, props: bool() },
  { variant: ownFields.variant, style: bool(), events: bool() },
);
const insertFields = obj({ op: tag("insert"), parent: id, index: natural, node: bool() });
const removeFields = obj({ op: tag("remove"), id });
const moveFields = obj({ op: tag("move"), id, index: natural });
const nodeFields = obj(
  { id, kind: ownFields.kind, props: bool() },
  { variant: ownFields.variant, style: bool(), events: bool(), children: bool() },
);
const opFields = { set: setFields, insert: insertFields, remove: removeFields, move: moveFields };
const stateFields = obj({ type: tag("setState"), key: str({ maxLength: 128, pattern: "^.+$" }) }, { value: bool() });
const actionFields = treeSchema.$defs.intent.oneOf[1];

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
  $defs: treeSchema.$defs,
} as const;

type Checks = ReturnType<typeof documentChecks>;
function check(c: Checks, schema: Parameters<typeof checkValue>[0], value: unknown, pointer: string) {
  c.collect(checkValue(schema, value), pointer);
}
const actionShape = obj(
  { type: tag("action"), name: actionFields.properties.name, args: bool() },
  { bind: actionFields.properties.bind, bindAll: bool() },
);
function checkIntent(c: Checks, intent: unknown, path: string) {
  if (!isRecord(intent)) {
    c.reject(path, "Expected an intent");
    return;
  }
  if (intent.type === "setState") check(c, stateFields, shell(intent, ["value"]), path);
  else if (intent.type === "action") {
    check(c, actionShape, shell(intent, ["args"]), path);
    if (!isRecord(intent.args)) c.reject(at(path, "args"), "Expected an object");
    if (Object.hasOwn(intent, "bindAll") && (intent.bindAll !== true || Object.hasOwn(intent, "bind")))
      c.reject(at(path, "bindAll"), "Expected true without bind");
  } else c.reject(at(path, "type"), "Unknown intent type");
}
function payload(c: Checks, value: Record<string, unknown>, pointer: string) {
  for (const key of ["props", "style", "events"]) {
    if ((key === "props" || Object.hasOwn(value, key)) && !isRecord(value[key]))
      c.reject(at(pointer, key), "Expected an object");
  }
  if (isRecord(value.events))
    for (const [key, intent] of Object.entries(value.events)) checkIntent(c, intent, at(at(pointer, "events"), key));
}
function insertedNodes(c: Checks, node: unknown, path: string) {
  const pending = [{ node, path }];
  while (pending.length && c.errors.length < 20) {
    const entry = pending.pop();
    if (!entry) break;
    if (!isRecord(entry.node)) {
      c.reject(entry.path, "Expected a node");
      continue;
    }
    check(c, nodeFields, shell(entry.node, ["props", "style", "events", "children"]), entry.path);
    payload(c, entry.node, entry.path);
    if (!Object.hasOwn(entry.node, "children")) continue;
    if (!Array.isArray(entry.node.children)) {
      c.reject(`${entry.path}/children`, "Expected an array");
      continue;
    }
    for (let j = entry.node.children.length - 1; j >= 0; j--)
      pending.push({ node: entry.node.children[j], path: `${entry.path}/children/${j}` });
  }
}
function operation(c: Checks, op: unknown, path: string) {
  if (!isRecord(op) || typeof op.op !== "string" || !Object.hasOwn(opFields, op.op)) {
    c.reject(path, "Unknown patch operation");
    return;
  }
  const nested = op.op === "set" ? ["props", "style", "events"] : op.op === "insert" ? ["node"] : [];
  check(c, opFields[op.op as keyof typeof opFields], shell(op, nested), path);
  if (op.op === "set") payload(c, op, path);
  if (op.op === "insert") insertedNodes(c, op.node, `${path}/node`);
}

/** Structural checks only; validate the complete applied tree before accepting it. */
export function validateTreePatch(doc: unknown): Result<TreePatch> {
  const json = validateJson(doc);
  if (!json.ok) return json;
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a tree patch");
  else {
    check(c, fields, shell(doc, ["ops"]), "");
    if (typeof doc.revision === "number" && typeof doc.base === "number" && doc.revision <= doc.base)
      c.reject("/revision", "Expected revision greater than base");
    if (!Array.isArray(doc.ops)) c.reject("/ops", "Expected an array");
    else
      for (const [i, op] of doc.ops.entries()) {
        if (c.errors.length >= 20) break;
        operation(c, op, `/ops/${i}`);
      }
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as TreePatch };
}
