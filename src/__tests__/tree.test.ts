import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import schema from "../../schemas/ui-tree.json" with { type: "json" };
import { type Intent, type Json, LIVEFRAME_FORMAT, type UiNode, type UiTree } from "../index.ts";

const validate = new Ajv2020({ strict: true }).compile(schema);
const tree: UiTree = {
  format: LIVEFRAME_FORMAT,
  catalogId: "acme.ui@1",
  surfaceId: "main",
  revision: 0,
  root: {
    id: "root",
    kind: "stack",
    props: {},
    children: [
      {
        id: "root/row:4812/claim%2Fnow",
        kind: "button",
        variant: "primary",
        props: { label: "Claim", nested: [null, true, 1, { text: "👍" }] },
        style: { gap: { base: "space.1", "bp.wide": "space.2" } },
        events: {
          onPress: { type: "action", name: "tasks.escalate", args: { id: "t-4812" }, bind: "reason" },
          onCommit: { type: "setState", key: "filter" },
          onChange: { type: "setState", key: "selected", value: null },
        },
      },
    ],
  },
};

test("tree_types_match_published_schema", () => {
  expect(LIVEFRAME_FORMAT).toBe("liveframe/1");
  expect(validate(tree)).toBe(true);
  expect(validate({ ...tree, root: { id: "root", kind: "text", props: {} } })).toBe(true);
  const args: Json = { nested: [false, null, 3, "value"] };
  expect(args).toBeDefined();
  // @ts-expect-error Functions cannot cross the wire.
  const invalidJson: Json = () => {};
  // @ts-expect-error Only actions can bind an event value.
  const invalidIntent: Intent = { type: "setState", key: "filter", bind: "reason" };
  // @ts-expect-error Props are required.
  const invalidNode: UiNode = { id: "root", kind: "text" };
  // @ts-expect-error Trees are readonly data.
  tree.revision = 0;
  void [invalidJson, invalidIntent, invalidNode];
});

test("tree_schema_rejects_unknown_fields", () => {
  for (const node of [
    { ...tree.root, extra: true },
    { ...tree.root, events: { onPress: { type: "unknown" } } },
    { ...tree.root, events: { onPress: { type: "setState", key: "filter", bind: "reason" } } },
    { ...tree.root, events: { onPress: [{ type: "setState", key: "filter" }] } },
    { ...tree.root, events: { onPress: { type: "action", name: "tasks.claim", args: {}, extra: true } } },
    { ...tree.root, children: [{ id: "root/child", kind: "text", props: {}, extra: true }] },
  ])
    expect(validate({ ...tree, root: node })).toBe(false);
  expect(validate({ ...tree, extra: true })).toBe(false);
});

test("tree_schema_checks_paths_envelopes_and_intent_shapes", () => {
  for (const id of ["other", "root/", "root//child", "root/raw space", "root/%2f", "root/%ZZ"])
    expect(validate({ ...tree, root: { ...tree.root, id } })).toBe(false);
  for (const patch of [{ format: "liveframe/2" }, { catalogId: "acme" }, { revision: -1 }, { revision: 0.5 }])
    expect(validate({ ...tree, ...patch })).toBe(false);
  for (const intent of [
    { type: "action", name: "tasks.claim" },
    { type: "action", name: "tasks.claim", args: [] },
    { type: "action", name: "tasks.claim", args: {}, bind: "" },
    { type: "action", name: "tasks.claim", args: {}, bind: "a".repeat(129) },
    { type: "action", name: "tasks.claim", args: {}, bind: { reason: "value" } },
    { type: "setState" },
  ])
    expect(validate({ ...tree, root: { ...tree.root, events: { onPress: intent } } })).toBe(false);
});
