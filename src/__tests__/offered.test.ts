import { expect, spyOn, test } from "bun:test";
import {
  applyPatch,
  bool,
  checkOffered,
  compileValidator,
  type Intent,
  type IntentOrigin,
  obj,
  str,
  type UiTree,
} from "../index.ts";
import { complete } from "../validate/complete.ts";
import * as numeric from "./fixtures/numeric-events.ts";
import * as form from "./fixtures/object-events.ts";
import { surfaceProps, withRoot } from "./fixtures/react-surface.tsx";

test("complete_returns_a_frozen_copy_without_structured_clone", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "structuredClone");
  Reflect.deleteProperty(globalThis, "structuredClone");
  try {
    const payload = JSON.parse('{"nested":[null,true,3,"text",{"__proto__":{"safe":true}}]}');
    const cases: [Intent, typeof payload | undefined, Intent][] = [
      [
        { type: "setState", key: "value", value: payload },
        undefined,
        { type: "setState", key: "value", value: payload },
      ],
      [{ type: "setState", key: "value" }, payload, { type: "setState", key: "value", value: payload }],
      [
        { type: "action", name: "submit", args: { fixed: payload }, bind: "value" },
        payload,
        { type: "action", name: "submit", args: { fixed: payload, value: payload } },
      ],
      [
        { type: "action", name: "submit", args: { fixed: payload }, bindAll: true },
        { value: payload },
        { type: "action", name: "submit", args: { fixed: payload, value: payload } },
      ],
    ];
    function assertCopy(copy: unknown, source: unknown): void {
      expect(copy).toEqual(source);
      if (source === null || typeof source !== "object") return;
      expect(copy).not.toBe(source);
      expect(Object.isFrozen(copy)).toBe(true);
      expect(Object.isFrozen(source)).toBe(false);
      for (const key of Object.keys(source))
        assertCopy((copy as Record<string, unknown>)[key], (source as Record<string, unknown>)[key]);
    }
    for (const [offered, value, expected] of cases) assertCopy(complete(offered, value), expected);
    expect(checkOffered(bound, origin(bound), intent, surfaceProps.validator).ok).toBe(true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "structuredClone", descriptor);
  }
});

const origin = (tree: UiTree, event = "onCommit"): IntentOrigin => ({
  surfaceId: tree.surfaceId,
  revision: tree.revision,
  nodeId: tree.root.id,
  event,
});
const bound = withRoot({
  id: "root",
  kind: "textField",
  props: { label: "Reason" },
  events: {
    onCommit: { type: "action", name: "tasks.escalate", args: { id: "t1" }, bind: "reason" },
  },
});
const intent: Intent = { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "review" } };

test("check_offered_rejects_each_forgery", () => {
  for (const [source, candidate, kind, pointer] of [
    [{ ...origin(bound), surfaceId: "other" }, intent, "version-conflict", "/origin/surfaceId"],
    [{ ...origin(bound), revision: 0 }, intent, "version-conflict", "/origin/revision"],
    [{ ...origin(bound), nodeId: "root/missing" }, intent, "not-found", "/origin/nodeId"],
    [{ ...origin(bound), event: "toString" }, intent, "undeclared-event", "/origin/event"],
    [origin(bound), { ...intent, args: { id: "changed", reason: "review" } }, "invalid-prop", "/args/id"],
    [origin(bound), { ...intent, args: { id: "t1", reason: "" } }, "invalid-prop", "/args/reason"],
    [origin(bound), { ...intent, bind: "reason" }, "invalid-prop", "/bind"],
    [origin(bound), { ...intent, name: "not.declared" }, "invalid-prop", "/name"],
    [origin(bound), { type: "setState", key: "reason", value: "review" }, "invalid-prop", "/type"],
    [origin(bound), { ...intent, args: { id: "t1", reason: "review", extra: true } }, "invalid-prop", "/args/extra"],
  ] as const) {
    const result = checkOffered(bound, source, candidate, surfaceProps.validator);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ kind, pointer });
  }
  expect(checkOffered(bound, origin(bound), intent, surfaceProps.validator)).toEqual({ ok: true, value: undefined });
});

test("check_offered_checks_state_literals_and_schema", () => {
  for (const offered of [
    { type: "setState", key: "reason" },
    { type: "setState", key: "reason", value: "fixed" },
  ] as const) {
    const tree = withRoot({ ...bound.root, events: { onCommit: offered } });
    for (const candidate of [
      { type: "setState", key: "selected", value: "changed" },
      { type: "setState", key: "reason", value: 1 },
      ...(Object.hasOwn(offered, "value") ? [{ type: "setState", key: "reason", value: "changed" }] : []),
    ] as Intent[])
      expect(checkOffered(tree, origin(tree), candidate, surfaceProps.validator).ok).toBe(false);
  }
});

test("check_offered_checks_bind_all_event_keys_and_both_schemas", () => {
  const tree = form.formTree();
  const source = origin(tree, "onSubmit");
  const good: Intent = { type: "action", name: "form.submit", args: { id: "row", reason: "review", confirm: true } };
  expect(checkOffered(tree, source, good, form.validator).ok).toBe(true);
  for (const args of [
    { id: "changed", reason: "review", confirm: true },
    { id: "row", reason: "review", confirm: true, extra: 1 },
    { id: "row", reason: "x".repeat(101), confirm: true },
    { id: "row", reason: "review", confirm: "yes" },
  ])
    expect(checkOffered(tree, source, { ...good, args }, form.validator).ok).toBe(false);
  const numericTree = numeric.numericTree("onInteger", {
    type: "action",
    name: "numbers.commit",
    args: {},
    bind: "value",
  });
  for (const value of [0, 11, 1.5, NaN, Infinity])
    expect(
      checkOffered(
        numericTree,
        origin(numericTree, "onInteger"),
        { type: "action", name: "numbers.commit", args: { value } },
        numeric.validator,
      ).ok,
    ).toBe(false);
});

test("check_offered_fails_closed_for_malformed_transport_data", () => {
  for (const source of [null, {}, { ...origin(bound), revision: "1" }])
    expect(checkOffered(bound, source as IntentOrigin, intent, surfaceProps.validator).ok).toBe(false);
  for (const candidate of [null, {}, { ...intent, args: null }])
    expect(checkOffered(bound, origin(bound), candidate as Intent, surfaceProps.validator).ok).toBe(false);
});

test("check_offered_caches_validation_and_accepts_json_transport", () => {
  const tree = JSON.parse(JSON.stringify(bound)) as UiTree;
  const validate = spyOn(surfaceProps.validator, "validateTree");
  try {
    for (let i = 0; i < 3; i++) expect(checkOffered(tree, origin(tree), intent, surfaceProps.validator).ok).toBe(true);
    expect(validate).toHaveBeenCalledTimes(1);
  } finally {
    validate.mockRestore();
  }
  expect(checkOffered(tree, origin(tree), intent, {} as typeof surfaceProps.validator)).toMatchObject({
    ok: false,
    errors: [{ kind: "invalid-prop", pointer: "/validator" }],
  });
});

test("bind_all_cannot_fill_an_unoffered_optional_action_argument", () => {
  const validator = compileValidator({
    ...form,
    capabilities: {
      ...form.capabilities,
      actions: {
        ...form.capabilities.actions,
        "form.submit": {
          description: "Submit.",
          args: obj(
            { id: str({ maxLength: 80 }), reason: str({ maxLength: 100 }), confirm: bool() },
            { audit: bool() },
          ),
        },
      },
    },
  });
  const tree = form.formTree();
  const result = checkOffered(
    tree,
    origin(tree, "onSubmit"),
    {
      type: "action",
      name: "form.submit",
      args: { id: "row", reason: "review", confirm: true, audit: true },
    },
    validator,
  );
  expect(result).toMatchObject({ ok: false, errors: [{ kind: "invalid-prop", pointer: "/args/audit" }] });
});

test("check_offered_follows_patched_revision", () => {
  const result = applyPatch(bound, {
    format: "liveframe/tree-patch/1",
    catalogId: bound.catalogId,
    surfaceId: bound.surfaceId,
    base: bound.revision,
    revision: bound.revision + 1,
    ops: [],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(checkOffered(result.value, origin(result.value), intent, surfaceProps.validator).ok).toBe(true);
  const stale = checkOffered(result.value, origin(bound), intent, surfaceProps.validator);
  expect(stale.ok).toBe(false);
  if (!stale.ok) expect(stale.errors[0]?.kind).toBe("version-conflict");
});
