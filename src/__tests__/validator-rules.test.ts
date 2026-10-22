import { describe, expect, test } from "bun:test";
import { compileValidator, type LiveframeError, type ValidateTreeOptions } from "../index.ts";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import proof from "./fixtures/proof/agent-home.tree.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };

// Exact bullets make additions AND edits to §10 require an explicit coverage review.
const rules = {
  kind: "every `kind` exists in the catalog",
  props: "props match their schemas, and strings and arrays are bounded",
  structure:
    "children match the definition, and style props are declared and in range; a dimension that names a design value (`space.*`, `radius.*`, `size.*`, a breakpoint) fails when the app did not declare that name",
  variant: "variants exist",
  intent:
    "event names are declared, `setState` keys exist in the state schema and their values match it, action names are in the manifest, action args match the action's schema in the app's capabilities, and a `bind` names an argument whose type matches the event's `carries`",
  id: "ids are unique and key-derived",
  limits:
    "limits hold: node count (default 5,000), depth (default 64), and tree size in bytes (default 1 MiB), all configurable. Tree size is the UTF-8 length of the tree's `JSON.stringify` output, counted during the walk without serialising. String bounds count code points. The runner adds a time limit (§7.5)",
} as const;

const validator = compileValidator({ catalog, capabilities, manifest });
const limited = compileValidator({ catalog, capabilities, manifest: { ...manifest, actions: [] } });
const node = (kind = "stack", props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: "root",
  kind,
  props,
  ...extra,
});
const tree = (root = node()) => ({ ...proof, root });
const event = (intent: unknown, kind = "button", name = "onPress") =>
  tree(node(kind, { label: "Test" }, { events: { [name]: intent } }));
const action = { type: "action", name: "tasks.escalate", args: { id: "task" }, bind: "reason" };
const child = (id = "root/child", kind = "stack") => node(kind, {}, { id });

type Row = {
  rule: keyof typeof rules;
  name: string;
  /** Normative source, including the §8–§9 intent clauses exercised by this row. */
  source: string;
  input: unknown;
  kind: LiveframeError["kind"];
  nodeId: string;
  pointer: string;
  expected: readonly string[];
  options?: ValidateTreeOptions;
  validator?: typeof validator;
};

const rows: readonly Row[] = [
  {
    rule: "kind",
    name: "unknown primitive",
    source: "docs/spec.md:484",
    input: tree(node("missing")),
    kind: "unknown-component",
    nodeId: "root",
    pointer: "/root/kind",
    expected: ["catalog kind:", "stack", "button"],
  },
  {
    rule: "props",
    name: "wrong prop type",
    source: "docs/spec.md:485",
    input: tree(node("button", { label: 1 })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/label",
    expected: ["string", "80"],
  },
  {
    rule: "props",
    name: "missing required prop",
    source: "docs/spec.md:485",
    input: tree(node("button")),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/label",
    expected: ['"label"', "required"],
  },
  {
    rule: "props",
    name: "unknown prop",
    source: "docs/spec.md:485",
    input: tree(node("button", { label: "Test", extra: true })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/extra",
    expected: ["one of:", "label", "disabled"],
  },
  {
    rule: "props",
    name: "string code-point bound",
    source: "docs/spec.md:485,490",
    input: tree(node("button", { label: "😀".repeat(81) })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/label",
    expected: ["80", "characters"],
  },
  {
    rule: "props",
    name: "array bound",
    source: "docs/spec.md:485",
    input: tree(
      node("select", { label: "Test", options: Array.from({ length: 101 }, () => ({ label: "Test", value: "test" })) }),
    ),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/options",
    expected: ["100", "items"],
  },
  {
    rule: "props",
    name: "nested array item schema",
    source: "docs/spec.md:485",
    input: tree(node("select", { label: "Test", options: [{ label: "Test", value: 1 }] })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/options/0/value",
    expected: ["string", "128"],
  },
  {
    rule: "props",
    name: "array type includes its bound",
    source: "docs/spec.md:485",
    input: tree(node("select", { label: "Test", options: "invalid" })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/options",
    expected: ["array", "100", "items"],
  },
  {
    rule: "props",
    name: "object type includes its fields",
    source: "docs/spec.md:485",
    input: tree(node("button", {}, { props: [] })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props",
    expected: ["object", "label", "disabled"],
  },
  {
    rule: "props",
    name: "integer range",
    source: "docs/spec.md:485",
    input: tree(node("heading", { text: "Test", level: 7 })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/level",
    expected: ["<= 6"],
  },
  {
    rule: "props",
    name: "string pattern",
    source: "docs/spec.md:485",
    input: tree(node("icon", { name: "bad icon" })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/props/name",
    expected: ["matching", "^[a-zA-Z0-9]"],
  },
  {
    rule: "structure",
    name: "children forbidden",
    source: "docs/spec.md:486",
    input: tree(node("text", { text: "Test" }, { children: [child()] })),
    kind: "invalid-children",
    nodeId: "root",
    pointer: "/root/children",
    expected: ["no children"],
  },
  {
    rule: "structure",
    name: "child kind restricted",
    source: "docs/spec.md:486",
    input: tree(node("menu", { label: "Test" }, { children: [child()] })),
    kind: "invalid-children",
    nodeId: "root/child",
    pointer: "/root/children/0/kind",
    expected: ["menuItem"],
  },
  {
    rule: "structure",
    name: "minimum children",
    source: "docs/spec.md:486",
    input: tree(node("menu", { label: "Test" })),
    kind: "invalid-children",
    nodeId: "root",
    pointer: "/root/children",
    expected: ["at least 1", "menuItem"],
  },
  {
    rule: "structure",
    name: "maximum children",
    source: "docs/spec.md:486",
    input: tree(
      node(
        "menu",
        { label: "Test" },
        {
          children: Array.from({ length: 101 }, (_, i) =>
            node("menuItem", { label: "Test" }, { id: `root/item:${i}` }),
          ),
        },
      ),
    ),
    kind: "invalid-children",
    nodeId: "root",
    pointer: "/root/children",
    expected: ["between 1 and 100", "menuItem"],
  },
  {
    rule: "structure",
    name: "undeclared style prop",
    source: "docs/spec.md:486",
    input: tree(node("button", { label: "Test" }, { style: { gap: "space.1" } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/gap",
    expected: ["width", "grow", "align"],
  },
  {
    rule: "structure",
    name: "numeric style bound",
    source: "docs/spec.md:486",
    input: tree(node("stack", {}, { style: { grow: 101 } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/grow",
    expected: ["0 to 100"],
  },
  {
    rule: "structure",
    name: "undeclared space",
    source: "docs/spec.md:486",
    input: tree(node("stack", {}, { style: { gap: "space.missing" } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/gap",
    expected: ["one of:", "space.0"],
  },
  {
    rule: "structure",
    name: "undeclared size",
    source: "docs/spec.md:486",
    input: tree(node("stack", {}, { style: { width: "size.missing" } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/width",
    expected: ["size.rail", "0 to 100"],
  },
  {
    rule: "structure",
    name: "undeclared radius",
    source: "docs/spec.md:486",
    input: tree(node("box", {}, { style: { radius: "radius.missing" } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/radius",
    expected: ["one of:", "full"],
  },
  {
    rule: "structure",
    name: "undeclared breakpoint",
    source: "docs/spec.md:486",
    input: tree(node("stack", {}, { style: { gap: { base: "space.0", "bp.missing": "space.0" } } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/gap/bp.missing",
    expected: ["base first", "bp.md"],
  },
  {
    rule: "structure",
    name: "responsive base required",
    source: "docs/spec.md:486",
    input: tree(node("stack", {}, { style: { gap: { "bp.md": "space.0" } } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/gap",
    expected: ["base first", "bp.md"],
  },
  {
    rule: "structure",
    name: "colour outside role (law 3)",
    source: "docs/spec.md:486",
    input: tree(node("box", {}, { style: { surface: "#ff0000" } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/surface",
    expected: ["one of:", "surface.base"],
  },
  {
    rule: "structure",
    name: "raw CSS (law 3)",
    source: "docs/spec.md:486",
    input: tree(node("stack", {}, { style: { width: "calc(100% - 1px)" } })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/style/width",
    expected: ["declared space or size", "0 to 100"],
  },
  {
    rule: "variant",
    name: "undeclared variant",
    source: "docs/spec.md:487",
    input: tree(node("button", { label: "Test" }, { variant: "loud" })),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/variant",
    expected: ["one of: default, primary, danger, ghost"],
  },
  {
    rule: "intent",
    name: "undeclared event",
    source: "docs/spec.md:488",
    input: event({ type: "setState", key: "filter", value: "all" }, "button", "onMissing"),
    kind: "undeclared-event",
    nodeId: "root",
    pointer: "/root/events/onMissing",
    expected: ["onPress"],
  },
  {
    rule: "intent",
    name: "one intent per event",
    source: "docs/spec.md:441,488",
    input: event([{ type: "setState", key: "filter", value: "all" }]),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress",
    expected: ["one setState or action intent"],
  },
  {
    rule: "intent",
    name: "intent type",
    source: "docs/spec.md:468,488",
    input: event({ type: "script" }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/type",
    expected: ["setState or action"],
  },
  {
    rule: "intent",
    name: "state key",
    source: "docs/spec.md:469,488",
    input: event({ type: "setState", key: "missing", value: "all" }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/key",
    expected: ["filter", "reason"],
  },
  {
    rule: "intent",
    name: "state value",
    source: "docs/spec.md:469,488",
    input: event({ type: "setState", key: "filter", value: "missing" }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/value",
    expected: ["one of: all, decisions, tasks, alerts"],
  },
  {
    rule: "intent",
    name: "absent state value needs carrying event",
    source: "docs/spec.md:469,488",
    input: event({ type: "setState", key: "filter" }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/value",
    expected: ["explicit string", "event carrying string"],
  },
  {
    rule: "intent",
    name: "state carry type mismatch",
    source: "docs/spec.md:442,469,488",
    input: event({ type: "setState", key: "filter" }, "checkbox", "onChange"),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onChange/value",
    expected: ["explicit string", "event carrying string"],
  },
  {
    rule: "intent",
    name: "undeclared action (law 4)",
    source: "docs/spec.md:443,488",
    input: event({ type: "action", name: "missing", args: {} }),
    kind: "undeclared-action",
    nodeId: "root",
    pointer: "/root/events/onPress/name",
    expected: ["action in the manifest:", "tasks.claim"],
  },
  {
    rule: "intent",
    name: "capability alone grants no authority (law 4)",
    source: "docs/spec.md:443,488",
    input: event({ type: "action", name: "tasks.claim", args: { id: "task" } }),
    validator: limited,
    kind: "undeclared-action",
    nodeId: "root",
    pointer: "/root/events/onPress/name",
    expected: ["manifest: none"],
  },
  {
    rule: "intent",
    name: "args outside capability schema (law 4)",
    source: "docs/spec.md:443,488",
    input: event({ type: "action", name: "tasks.claim", args: { id: 1 } }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/args/id",
    expected: ["string", "128"],
  },
  {
    rule: "intent",
    name: "missing action arg",
    source: "docs/spec.md:443,488",
    input: event({ type: "action", name: "tasks.claim", args: {} }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/args/id",
    expected: ['"id"', "required"],
  },
  {
    rule: "intent",
    name: "extra action arg",
    source: "docs/spec.md:443,488",
    input: event({ type: "action", name: "tasks.claim", args: { id: "task", extra: true } }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/args/extra",
    expected: ["one of: id"],
  },
  {
    rule: "intent",
    name: "bind argument exists",
    source: "docs/spec.md:442,470,488",
    input: event({ ...action, bind: "missing" }, "textField", "onCommit"),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onCommit/bind",
    expected: ["one of: id, reason", "string"],
  },
  {
    rule: "intent",
    name: "bind matches carries",
    source: "docs/spec.md:442,470,488",
    input: event(action, "checkbox", "onChange"),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onChange/bind",
    expected: ["boolean", "no compatible arguments", "omit bind"],
  },
  {
    rule: "intent",
    name: "bind needs carrying event",
    source: "docs/spec.md:442,470,488",
    input: event(action),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/bind",
    expected: ["omit bind", "carries none"],
  },
  {
    rule: "intent",
    name: "bound arg omitted from args",
    source: "docs/spec.md:442,470,488",
    input: event({ ...action, args: { id: "task", reason: "why" } }, "textField", "onCommit"),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onCommit/args/reason",
    expected: ["bound argument omitted"],
  },
  {
    rule: "intent",
    name: "unbound required args remain required",
    source: "docs/spec.md:442,470,488",
    input: event({ ...action, args: {} }, "textField", "onCommit"),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onCommit/args/id",
    expected: ['"id"', "required"],
  },
  {
    rule: "intent",
    name: "intent fields closed",
    source: "docs/spec.md:469,488",
    input: event({ type: "setState", key: "filter", value: "all", script: "run" }),
    kind: "invalid-prop",
    nodeId: "root",
    pointer: "/root/events/onPress/script",
    expected: ["fields: type, key, value"],
  },
  {
    rule: "id",
    name: "duplicate id",
    source: "docs/spec.md:489",
    input: tree(node("stack", {}, { children: [child(), child()] })),
    kind: "duplicate-key",
    nodeId: "root/child",
    pointer: "/root/children/1/id",
    expected: ["unique key-path id"],
  },
  {
    rule: "id",
    name: "root id",
    source: "docs/spec.md:489",
    input: tree(node("stack", {}, { id: "other" })),
    kind: "invalid-prop",
    nodeId: "other",
    pointer: "/root/id",
    expected: ["root as the root id"],
  },
  {
    rule: "id",
    name: "child id outside parent",
    source: "docs/spec.md:489",
    input: tree(node("stack", {}, { children: [child("other/child")] })),
    kind: "invalid-prop",
    nodeId: "other/child",
    pointer: "/root/children/0/id",
    expected: ["key path under root"],
  },
  {
    rule: "id",
    name: "empty key segment",
    source: "docs/spec.md:489",
    input: tree(node("stack", {}, { children: [child("root//child")] })),
    kind: "invalid-prop",
    nodeId: "root//child",
    pointer: "/root/children/0/id",
    expected: ["encoded key path under root"],
  },
  {
    rule: "limits",
    name: "node count",
    source: "docs/spec.md:490",
    input: tree(node("stack", {}, { children: [child()] })),
    options: { limits: { nodes: 1 } },
    kind: "limit-exceeded",
    nodeId: "root",
    pointer: "/root/children/0",
    expected: ["at most 1 nodes"],
  },
  {
    rule: "limits",
    name: "depth",
    source: "docs/spec.md:490",
    input: tree(node("stack", {}, { children: [child()] })),
    options: { limits: { depth: 1 } },
    kind: "limit-exceeded",
    nodeId: "root",
    pointer: "/root/children/0",
    expected: ["at most 1 node levels", "root is level 1"],
  },
  {
    rule: "limits",
    name: "UTF-8 JSON bytes",
    source: "docs/spec.md:490",
    input: tree(),
    options: { limits: { bytes: 1 } },
    kind: "limit-exceeded",
    nodeId: "root",
    pointer: "",
    expected: ["at most 1 UTF-8 JSON bytes"],
  },
];

function errors(row: Row): readonly LiveframeError[] {
  const result = (row.validator ?? validator).validateTree(row.input, row.options);
  expect(result.ok, row.name).toBe(false);
  if (result.ok) throw new Error(`Accepted invalid row: ${row.name}`);
  return result.errors;
}

describe("spec §10 failing-case matrix", () => {
  test("every_spec_rule_has_a_row", async () => {
    const spec = await Bun.file(new URL("../../docs/spec.md", import.meta.url)).text();
    const section = spec.split("## 10. Validation\n")[1]?.split("## 11.")[0];
    expect(section).toBeDefined();
    const bullets = [...(section ?? "").matchAll(/^- (.+)$/gm)].map((match) => match[1]);
    expect(bullets).toEqual(Object.values(rules));
    expect(Object.keys(rules).sort()).toEqual([...new Set(rows.map((row) => row.rule))].sort());
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length);
    for (const row of rows) expect(row.source).toMatch(/^docs\/spec\.md:\d+(,\d+)*$/);
  });

  test("each_row_fails_as_specified", () => {
    for (const row of rows) {
      expect(errors(row), `${row.name} (${row.source})`).toContainEqual(
        expect.objectContaining({ kind: row.kind, nodeId: row.nodeId, pointer: row.pointer }),
      );
    }
  });

  test("expected_text_is_actionable", () => {
    for (const row of rows) {
      const found = errors(row);
      for (const error of found) {
        expect(error.expected?.trim(), row.name).toBeTruthy();
        expect(error.expected, row.name).not.toMatch(
          /^(?:valid|invalid|a required property|a string|an array|an object|a value|a schema|something)(?: input| value)?$/i,
        );
        expect(error.nodeId, row.name).toBeTruthy();
        expect(error.pointer, row.name).toMatch(/^(?:\/(?:[^~]|~[01])*)*$/);
      }
      const target = found.find(
        (error) => error.kind === row.kind && error.nodeId === row.nodeId && error.pointer === row.pointer,
      );
      for (const text of row.expected) expect(target?.expected, row.name).toContain(text);
    }
  });
});
