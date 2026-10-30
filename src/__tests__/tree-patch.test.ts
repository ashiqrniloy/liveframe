import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { applyPatch, compileValidator, diffTrees } from "@arnilo/liveframe";
import { canonicalJson } from "@arnilo/liveframe/pack";
import { difference } from "../validate/difference.ts";
import { schemaDocument } from "../formats/registry.ts";
import { type PatchOp, type Result, type TreePatch, type UiNode, type UiTree, validateTreePatch } from "../index.ts";

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

test("diff_rejects_mismatched_surfaces_revisions_and_empty_children", () => {
  const next = { ...base, revision: 3 };
  for (const [prev, target] of [
    [base, { ...next, surfaceId: "other" }],
    [base, { ...next, catalogId: "other@1" }],
    [base, base],
    [next, base],
    [{ ...base, root: { ...base.root, children: [] } }, next],
    [base, { ...next, root: { ...next.root, children: [node("root/a"), { ...node("root/b"), children: [] }] } }],
  ] as const) {
    const result = diffTrees(prev, target);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.kind).toBe("invalid-document");
    const sent = result.ok ? result.value : target;
    expect(sent).toBe(target);
  }
});

test("diff_preserves_inputs_and_omitted_versus_present_own_fields", () => {
  const prev: UiTree = { ...base, root: { ...base.root, variant: "old", style: {}, events: {} } };
  const next: UiTree = { ...base, revision: 3, root: { ...base.root, props: { nested: { b: [1, 2], a: true } } } };
  const before = JSON.stringify([prev, next]);
  const result = value(diffTrees(prev, next));
  expect(result.ops).toHaveLength(1);
  expect(value(applyPatch(prev, result))).toEqual(next);
  expect(JSON.stringify([prev, next])).toBe(before);
  expect(Object.isFrozen(prev)).toBe(false);
  expect(value(diffTrees(base, { ...base, revision: 3 })).ops).toEqual([]);
});

type DiffVector = { name: string; prev: UiTree; next: UiTree; patch: TreePatch };
const vectors: DiffVector[] = await Bun.file(
  new URL(import.meta.resolve("@arnilo/liveframe/conformance/patch/diff.json")),
).json();

test("patch_vectors_through_public_exports_and_deterministic_edit_order", () => {
  expect(vectors).toHaveLength(9);
  for (const { name, prev, next, patch } of vectors) {
    const first = value(diffTrees(prev, next));
    expect(canonicalJson(first), name).toBe(canonicalJson(patch));
    expect(canonicalJson(value(diffTrees(prev, next))), name).toBe(canonicalJson(first));
    expect(value(applyPatch(prev, first)), name).toEqual(next);
    // JSON object insertion order must not affect either equality or emitted ops.
    const reverseKeys = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(reverseKeys);
      if (input && typeof input === "object")
        return Object.fromEntries(
          Object.entries(input)
            .reverse()
            .map(([key, val]) => [key, reverseKeys(val)]),
        );
      return input;
    };
    expect(canonicalJson(value(diffTrees(reverseKeys(prev) as UiTree, reverseKeys(next) as UiTree))), name).toBe(
      canonicalJson(patch),
    );
  }
});

test("diff_then_apply_round_trips_every_pair", async () => {
  const root = new URL("../../conformance/corpus/", import.meta.url);
  const read = (path: string) => Bun.file(new URL(path, root)).json();
  const validator = compileValidator({
    catalog: await read("common/proof-catalog.json"),
    capabilities: await read("common/capabilities.json"),
    manifest: await read("common/manifest.json"),
  });
  const trees: UiTree[] = [];
  for (const file of new Bun.Glob("ui-tree/docs/*.json").scanSync({ cwd: root.pathname })) {
    const checked = validator.validateTree(await read(file));
    if (checked.ok) trees.push(checked.value);
  }
  expect(trees.length).toBeGreaterThan(0);
  const original = trees[0];
  if (!original) throw new Error("Missing valid corpus tree");
  trees.push({ ...original, revision: original.revision + 1 });
  const explicit = { ...original, revision: original.revision + 2, root: { ...original.root, children: [] } };
  expect(validator.validateTree(explicit).ok).toBe(true);
  trees.push(explicit);
  let roundTrips = 0;
  let fallbacks = 0;
  const emptyChildren = (node: UiNode): boolean =>
    node.children?.length === 0 || (node.children ?? []).some(emptyChildren);
  for (const prev of trees)
    for (const next of trees) {
      if (prev.catalogId !== next.catalogId || prev.surfaceId !== next.surfaceId || prev.revision >= next.revision)
        continue;
      const result = diffTrees(prev, next);
      if (emptyChildren(prev.root) || emptyChildren(next.root)) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors[0]?.kind).toBe("invalid-document");
        expect(result.ok ? result.value : next).toBe(next);
        fallbacks++;
      } else {
        expect(value(applyPatch(prev, value(result)))).toEqual(next);
        roundTrips++;
      }
    }
  expect(roundTrips).toBeGreaterThan(0);
  expect(fallbacks).toBeGreaterThan(0);
});

test("diff_round_trips_mixed_sibling_edits", () => {
  const nodes = [node("root/a"), node("root/b"), node("root/c")];
  const orders = [[], [0], [1, 0], [2, 0, 1], [1, 2], [2, 1, 0]];
  for (const before of orders)
    for (const after of orders) {
      const tree = (order: number[], revision: number): UiTree => ({
        ...base,
        revision,
        root: {
          id: "root",
          kind: "stack",
          props: {},
          ...(order.length ? { children: order.map((i) => nodes[i] as UiNode) } : {}),
        },
      });
      const prev = tree(before, 1),
        next = tree(after, 3);
      expect(value(applyPatch(prev, value(diffTrees(prev, next))))).toEqual(next);
    }
});

test("shared_json_comparison_preserves_mismatch_pointers", () => {
  for (const [expected, actual, pointer] of [
    [{ a: 1, b: { x: 2 } }, { b: { x: 2 }, a: 1 }, undefined],
    [{ a: [1, 2] }, { a: [2, 1] }, "/a/0"],
    [{ "a/b": { "~x": 1 } }, { "a/b": {} }, "/a~1b/~0x"],
    [{ a: 1 }, { a: 1, extra: 2 }, "/extra"],
    [{ a: undefined }, {}, "/a"],
    [{ a: 1 }, { extra: 2 }, "/a"],
  ] as const)
    expect(difference(expected, actual)).toBe(pointer);
});
