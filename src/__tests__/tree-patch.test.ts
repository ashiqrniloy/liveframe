import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schemaDocument } from "../formats/registry.ts";
import {
  applyPatch,
  type PatchOp,
  type Result,
  type TreePatch,
  type UiNode,
  type UiTree,
  validateTreePatch,
} from "../index.ts";

const node = (id: string): UiNode => ({ id, kind: "text", props: { text: id } });
const base: UiTree = {
  format: "liveframe/1",
  catalogId: "test@1",
  surfaceId: "s",
  revision: 1,
  root: { id: "root", kind: "stack", props: {}, children: [node("root/a"), node("root/b")] },
};
const patch = (ops: readonly PatchOp[] = []): TreePatch => ({
  format: "liveframe/tree-patch/1",
  catalogId: base.catalogId,
  surfaceId: base.surfaceId,
  base: 1,
  revision: 3,
  ops,
});
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
function error(doc: unknown, kind: string, pointer: string, tree = base) {
  const result = applyPatch(tree, doc);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors[0]).toMatchObject({ kind, pointer });
}

test("apply_patch_applies_each_op_and_shares_untouched_subtrees", () => {
  const result = value(applyPatch(base, patch([{ op: "set", id: "root/a", kind: "text", props: { text: "new" } }])));
  expect(result.root.children?.[0]?.props).toEqual({ text: "new" });
  expect(result.root.children?.[1]).toBe(base.root.children?.[1]);
  expect(result.root).not.toBe(base.root);
  expect(result.revision).toBe(3);
  const ordered = value(
    applyPatch(
      base,
      patch([
        { op: "insert", parent: "root", index: 1, node: { ...node("root/c"), children: [node("root/c/d")] } },
        { op: "set", id: "root/c/d", kind: "text", props: { text: "inserted" } },
        { op: "move", id: "root/c", index: 0 },
        { op: "remove", id: "root/a" },
      ]),
    ),
  );
  expect(ordered.root.children?.map((n) => n.id)).toEqual(["root/c", "root/b"]);
  expect(ordered.root.children?.[0]?.children?.[0]?.props.text).toBe("inserted");
});

test("apply_patch_obeys_order_and_ownership", () => {
  const source = { ...base, root: { ...base.root, variant: "old", style: { gap: "space.1" }, events: {} } };
  const doc = patch([{ op: "set", id: "root", kind: "stack", props: {} }]);
  const before = JSON.stringify([source, doc]);
  const result = value(applyPatch(source, doc));
  expect(result.root).toEqual(base.root);
  expect(result.root.children).toBe(source.root.children);
  expect(JSON.stringify([source, doc])).toBe(before);
  for (const object of [source, source.root, doc, doc.ops, result.root]) expect(Object.isFrozen(object)).toBe(false);
  expect(value(applyPatch(base, patch())).root).toBe(base.root);
  const empty = value(
    applyPatch(
      base,
      patch([
        { op: "remove", id: "root/a" },
        { op: "remove", id: "root/b" },
      ]),
    ),
  );
  expect(Object.hasOwn(empty.root, "children")).toBe(false);
  expect(value(applyPatch(base, patch([{ op: "move", id: "root/a", index: 0 }]))).root).toBe(base.root);
  error(
    patch([
      { op: "remove", id: "root/a" },
      { op: "set", id: "root/a", kind: "text", props: {} },
    ]),
    "not-found",
    "/ops/1/id",
  );
  for (const op of [
    { op: "remove", id: "root" },
    { op: "move", id: "root", index: 0 },
  ] as const)
    error(patch([op]), "invalid-document", "/ops/0/id");
  for (const index of [-1, 1.5, 3, Number.MAX_SAFE_INTEGER + 1]) {
    error(patch([{ op: "insert", parent: "root", index, node: node("root/c") }]), "invalid-document", "/ops/0/index");
    error(patch([{ op: "move", id: "root/a", index }]), "invalid-document", "/ops/0/index");
  }
  expect(
    value(applyPatch(base, patch([{ op: "move", id: "root/a", index: 1 }]))).root.children?.map((n) => n.id),
  ).toEqual(["root/b", "root/a"]);
  error(
    patch([{ op: "insert", parent: "root/missing", index: 0, node: node("root/c") }]),
    "not-found",
    "/ops/0/parent",
  );
});

test("apply_patch_rejects_stale_base_and_is_all_or_nothing", () => {
  error({ ...patch(), surfaceId: "other" }, "stale-patch", "/surfaceId");
  error({ ...patch(), base: 0 }, "stale-patch", "/base");
  error({ ...patch(), catalogId: "other@1" }, "invalid-document", "/catalogId");
  const before = JSON.stringify(base);
  error(
    patch([
      { op: "remove", id: "root/a" },
      { op: "remove", id: "root/missing" },
    ]),
    "not-found",
    "/ops/1/id",
  );
  expect(JSON.stringify(base)).toBe(before);
  error(
    patch([
      { op: "insert", parent: "root", index: 0, node: node("root/a") },
      { op: "remove", id: "root/a" },
    ]),
    "duplicate-key",
    "/ops/1/id",
  );
  error(
    patch([
      { op: "insert", parent: "root", index: 0, node: node("root/a") },
      { op: "set", id: "root", kind: "stack", props: {} },
      { op: "remove", id: "root/a" },
    ]),
    "duplicate-key",
    "/ops/2/id",
  );
});

test("tree_patch_schema_matches_validator", () => {
  const validate = new Ajv2020({ strict: true }).compile(schemaDocument("tree-patch"));
  const good = patch([
    {
      op: "set",
      id: "root",
      kind: "text",
      props: {},
      events: { onPress: { type: "action", name: "tasks.open", args: {}, bindAll: true } },
    },
    { op: "insert", parent: "root", index: 0, node: node("root/c") },
    { op: "remove", id: "root/a" },
    { op: "move", id: "root/b", index: 0 },
  ]);
  const docs: unknown[] = [
    patch(),
    good,
    null,
    {},
    { ...patch(), extra: true },
    { ...patch(), format: "other" },
    { ...patch(), revision: -1 },
    { ...patch(), base: 1.5 },
    { ...patch(), revision: Number.MAX_SAFE_INTEGER + 1 },
    patch([{ op: "set", id: "root", kind: "text", props: {}, children: [] } as unknown as PatchOp]),
  ];
  for (const ops of [
    [{ op: "wat" }],
    [{ op: "remove", id: "bad/path" }],
    [{ op: "insert", parent: "root", index: 0, node: { ...node("root/c"), props: [] } }],
    [
      {
        op: "set",
        id: "root",
        kind: "text",
        props: {},
        events: { e: { type: "action", name: "x", args: {}, bind: "x", bindAll: true } },
      },
    ],
  ])
    docs.push({ ...patch(), ops });
  for (const doc of docs) expect(validateTreePatch(doc).ok, JSON.stringify(doc)).toBe(validate(doc));
  for (const revision of [0, 1]) {
    const doc = { ...patch(), revision };
    expect(validate(doc)).toBe(true);
    expect(validateTreePatch(doc).ok).toBe(false);
  }
  for (const props of [{ x: undefined }, { x: Infinity }, { x: () => 1 }, { x: new Date() }])
    expect(validateTreePatch({ ...patch(), ops: [{ op: "set", id: "root", kind: "text", props }] }).ok).toBe(false);
  const cycle: unknown[] = [];
  cycle.push(cycle);
  expect(validateTreePatch({ ...patch(), ops: cycle }).ok).toBe(false);
});

test("tree_patch_corpus_schema_shape_parity", async () => {
  const validate = new Ajv2020({ strict: true }).compile(schemaDocument("tree-patch"));
  const root = new URL("../../conformance/corpus/tree-patch/docs/", import.meta.url);
  for (const path of new Bun.Glob("*.json").scanSync(root.pathname)) {
    const doc = await Bun.file(new URL(path, root)).json();
    const structural = validateTreePatch(doc);
    if (doc.revision <= doc.base) {
      expect(validate(doc)).toBe(true);
      expect(structural.ok).toBe(false);
    } else expect(structural.ok).toBe(validate(doc));
  }
});

test("apply_patch_updates_indexes_after_descendant_removal_and_reinsertion", () => {
  const subtree: UiNode = { ...node("root/c"), children: [node("root/c/d")] };
  const result = value(
    applyPatch(
      base,
      patch([
        { op: "insert", parent: "root", index: 2, node: subtree },
        { op: "set", id: "root/c/d", kind: "text", props: { text: "changed" } },
        { op: "remove", id: "root/c" },
        { op: "insert", parent: "root", index: 0, node: subtree },
        { op: "set", id: "root/c/d", kind: "text", props: { text: "again" } },
      ]),
    ),
  );
  expect(result.root.children?.[0]?.children?.[0]?.props.text).toBe("again");
  error(
    patch([
      { op: "insert", parent: "root", index: 0, node: subtree },
      { op: "remove", id: "root/c" },
      { op: "remove", id: "root/c/d" },
    ]),
    "not-found",
    "/ops/2/id",
  );
  expect(value(applyPatch(base, patch())).root).toBe(base.root);
  const explicit: UiTree = { ...base, root: { ...node("root"), children: [] } };
  expect(value(applyPatch(explicit, patch([{ op: "set", id: "root", kind: "text", props: {} }]))).root.children).toBe(
    explicit.root.children,
  );
});
