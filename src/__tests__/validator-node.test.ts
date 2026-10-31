import { describe, expect, test } from "bun:test";
import {
  bool,
  compileValidator,
  type LiveframeError,
  LiveframeFailure,
  obj,
  styleProps,
  validateCatalog,
} from "../index.ts";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import tree from "./fixtures/proof/agent-home.tree.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };

const options = {
  catalog: {
    ...catalog,
    definitions: [
      ...catalog.definitions,
      {
        kind: "probe",
        description: "Validator test",
        variants: ["default"],
        defaultVariant: "default",
        slots: ["root"],
        styleProps,
        props: { type: "object", properties: {}, required: [], additionalProperties: false },
        children: "none",
        events: {
          onPress: { carries: "none", description: "press" },
          onCommit: { carries: "string", description: "commit" },
          onToggle: { carries: "boolean", description: "toggle" },
        },
        a11y: { role: "button" },
      },
    ],
  },
  capabilities,
  manifest,
};
const validator = compileValidator(options);
function check(patch: Record<string, unknown> = {}) {
  const errors: LiveframeError[] = [];
  const valid = validator.checkNode({ id: "root/probe", kind: "probe", props: {}, ...patch }, "/root/children/0", {
    errors,
    maxErrors: 20,
  });
  expect(valid).toBe(errors.length === 0);
  for (const error of errors) {
    expect(error.nodeId).toBe("root/probe");
    expect(error.expected?.length).toBeGreaterThan(0);
  }
  return errors;
}
function fails(patch: Record<string, unknown>, kind: LiveframeError["kind"], suffix: string) {
  expect(check(patch)).toContainEqual(expect.objectContaining({ kind, pointer: `/root/children/0${suffix}` }));
}
function event(intent: unknown, name = "onPress") {
  return { events: { [name]: intent } };
}

function failure(run: () => unknown): LiveframeFailure {
  try {
    run();
  } catch (error) {
    if (error instanceof LiveframeFailure) return error;
    throw error;
  }
  throw new Error("Expected a LiveframeFailure");
}

describe("compiled node validator", () => {
  test("node_rejects_undeclared_parts", () => {
    fails({ kind: "missing" }, "unknown-component", "/kind");
    fails({ extra: true }, "invalid-prop", "/extra");
    fails({ variant: "missing" }, "invalid-prop", "/variant");
    fails({ props: { extra: true } }, "invalid-prop", "/props/extra");
    fails(event({}, "onMissing"), "undeclared-event", "/events/onMissing");
    fails({ style: { colour: "red" } }, "invalid-prop", "/style/colour");
    fails({ children: {} }, "invalid-children", "/children");
    fails(event({ type: "other" }), "invalid-prop", "/events/onPress/type");
  });
  test("style_values_follow_vocabulary", () => {
    for (const value of [
      "13px",
      "space.9",
      { base: "space.1", "bp.unknown": "space.1" },
      { "bp.md": "space.1" },
      { base: { base: "space.1" } },
      { "bp.md": "space.1", base: "space.1" },
    ])
      expect(check({ style: { gap: value } }).length).toBeGreaterThan(0);
    fails({ style: { tone: "missing" } }, "invalid-prop", "/style/tone");
    for (const style of [
      { gap: "space.1" },
      { gap: { base: "space.1", "bp.md": "space.2" } },
      { width: "50%", columns: ["1fr", "size.rail"], grow: 1 },
      { radius: "full" },
    ])
      expect(check({ style })).toEqual([]);
    for (const style of [
      { columns: ["fill"] },
      { columns: ["fit"] },
      { grow: Infinity },
      { width: "101%" },
      { surface: "text.primary" },
      { fill: "surface.base" },
    ])
      expect(check({ style }).length).toBeGreaterThan(0);
  });
  test("action_args_match_capability", () => {
    for (const [args, suffix] of [
      [{}, "id"],
      [{ id: 1 }, "id"],
      [{ id: "task", extra: true }, "extra"],
    ] as const)
      fails(event({ type: "action", name: "tasks.claim", args }), "invalid-prop", `/events/onPress/args/${suffix}`);
    expect(check(event({ type: "action", name: "tasks.claim", args: { id: "task" } }))).toEqual([]);
    fails(event({ type: "action", name: "missing", args: {} }), "undeclared-action", "/events/onPress/name");
  });
  test("bind_rules", () => {
    const action = { type: "action", name: "tasks.escalate", args: { id: "task" }, bind: "reason" };
    expect(check(event(action, "onCommit"))).toEqual([]);
    fails(event({ ...action, bind: "missing" }, "onCommit"), "invalid-prop", "/events/onCommit/bind");
    fails(
      event({ ...action, args: { id: "task", reason: "why" } }, "onCommit"),
      "invalid-prop",
      "/events/onCommit/args/reason",
    );
    fails(event(action), "invalid-prop", "/events/onPress/bind");
    fails(event(action, "onToggle"), "invalid-prop", "/events/onToggle/bind");
    fails(event({ ...action, args: {} }, "onCommit"), "invalid-prop", "/events/onCommit/args/id");
  });
  test("set_state_value_matches_schema", () => {
    fails(event({ type: "setState", key: "filter", value: "missing" }), "invalid-prop", "/events/onPress/value");
    fails(event({ type: "setState", key: "filter" }), "invalid-prop", "/events/onPress/value");
    fails(event({ type: "setState", key: "missing", value: "all" }), "invalid-prop", "/events/onPress/key");
    expect(check(event({ type: "setState", key: "filter", value: "all" }))).toEqual([]);
    expect(check(event({ type: "setState", key: "filter" }, "onCommit"))).toEqual([]);
  });
  test("install_documents_are_validated_before_compilation", () => {
    for (const key of ["catalog", "capabilities", "manifest"] as const)
      expect(() => compileValidator({ ...options, [key]: {} })).toThrow();
    expect(
      failure(() => compileValidator({ ...options, manifest: { ...manifest, catalogId: "other.ui@1" } })).errors,
    ).toEqual([expect.objectContaining({ kind: "catalog-mismatch", pointer: "/catalogId" })]);
  });
  test("malformed_nodes_and_bounded_sinks", () => {
    for (const node of [null, [], {}, { kind: "probe" }]) {
      const errors: LiveframeError[] = [];
      expect(validator.checkNode(node, "/root", { errors, maxErrors: 1 })).toBe(false);
      expect(errors).toHaveLength(1);
    }
    expect(
      validator.checkNode({ id: "root", kind: "probe", props: { extra: true } }, "", { errors: [], maxErrors: 0 }),
    ).toBe(false);
    fails(
      event({ type: "action", name: "tasks.claim", args: {}, extra: true }),
      "invalid-prop",
      "/events/onPress/extra",
    );
    fails({ style: null }, "invalid-prop", "/style");
    fails({ events: [] }, "invalid-prop", "/events");
    fails({ "extra~/": true }, "invalid-prop", "/extra~0~1");
  });
  test("install_failures_preserve_part_a_errors", () => {
    const invalid = { ...catalog, vocabulary: { ...catalog.vocabulary, space: ["13px"] } };
    const result = validateCatalog(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(failure(() => compileValidator({ ...options, catalog: invalid })).errors).toEqual(result.errors);
    const limited = compileValidator({ ...options, manifest: { ...manifest, actions: [] } });
    const errors: LiveframeError[] = [];
    expect(
      limited.checkNode(
        {
          id: "root",
          kind: "probe",
          props: {},
          ...event({ type: "action", name: "tasks.claim", args: { id: "task" } }),
        },
        "/root",
        { errors, maxErrors: 20 },
      ),
    ).toBe(false);
    expect(errors[0]?.kind).toBe("undeclared-action");
  });
  test("style_table_covers_every_fixed_prop_and_bounds", () => {
    const accepted: Record<string, unknown> = {};
    for (const prop of styleProps) {
      if (prop.startsWith("padding") || prop.startsWith("margin") || prop.startsWith("inset") || prop === "gap")
        accepted[prop] = "space.0";
    }
    Object.assign(accepted, {
      direction: "vertical",
      align: "baseline",
      justify: "between",
      wrap: "nowrap",
      width: "fit",
      height: "fill",
      minWidth: "0ch",
      maxWidth: "12fr",
      minHeight: "size.rail",
      maxHeight: "50%",
      grow: 0,
      shrink: 100,
      basis: 1,
      columns: ["space.1", "size.rail", "1fr"],
      rows: ["0fr"],
      area: ["header header", "main ."],
      surface: catalog.vocabulary.surfaceRoles[0],
      fill: catalog.vocabulary.fillableRoles[0],
      radius: catalog.vocabulary.radius[0],
      position: "sticky",
      deferOffscreen: "size.rail",
      textAlign: "end",
      textStyle: catalog.vocabulary.typographyRoles[0],
      tone: Object.keys(catalog.vocabulary.tones)[0],
    });
    expect(Object.keys(accepted).sort()).toEqual([...styleProps].sort());
    expect(check({ style: accepted })).toEqual([]);
    for (const [key, value] of Object.entries(accepted)) {
      fails({ style: { [key]: { base: { base: value } } } }, "invalid-prop", `/style/${key}/base`);
    }
    for (const style of [
      { columns: [] },
      { rows: Array(13).fill("1fr") },
      { area: ["a; color: red"] },
      { area: ["a".repeat(257)] },
      { shrink: -1 },
      { basis: 101 },
      { width: "13fr" },
      { width: "NaN%" },
      { gap: "space.missing" },
      { radius: "radius.missing" },
      { textStyle: "missing" },
      { deferOffscreen: "90px" },
      { deferOffscreen: "size.missing" },
      { deferOffscreen: true },
      { deferOffscreen: "fill" },
    ])
      expect(check({ style }).length).toBeGreaterThan(0);
  });
  test("boolean_and_optional_bound_values", () => {
    const boolOptions = {
      ...options,
      capabilities: {
        ...capabilities,
        actions: { ...capabilities.actions, toggle: { description: "toggle", args: obj({}, { enabled: bool() }) } },
      },
      manifest: {
        ...manifest,
        actions: [...manifest.actions, "toggle"],
        state: obj({ enabled: bool() }),
        initialState: { enabled: false },
      },
    };
    const validator = compileValidator(boolOptions);
    for (const intent of [
      { type: "setState", key: "enabled" },
      { type: "setState", key: "enabled", value: false },
      { type: "action", name: "toggle", bind: "enabled", args: {} },
    ]) {
      const errors: LiveframeError[] = [];
      expect(
        validator.checkNode({ id: "root", kind: "probe", props: {}, ...event(intent, "onToggle") }, "/root", {
          errors,
          maxErrors: 20,
        }),
      ).toBe(true);
      expect(errors).toEqual([]);
    }
  });
  test("prototype_names_are_not_declarations", () => {
    fails({ kind: "toString" }, "unknown-component", "/kind");
    fails(event({ type: "action", name: "constructor", args: {} }), "undeclared-action", "/events/onPress/name");
    fails(event({ type: "setState", key: "toString", value: true }), "invalid-prop", "/events/onPress/key");
    fails({ style: { toString: "space.1" } }, "invalid-prop", "/style/toString");
    fails({ events: { toString: {} } }, "undeclared-event", "/events/toString");
  });
  test("proof_compiles_under_20ms", () => {
    compileValidator({ catalog, capabilities, manifest });
    const start = performance.now();
    const proof = compileValidator({ catalog, capabilities, manifest });
    const elapsed = performance.now() - start;
    console.info(`Proof validator compilation: ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(20);
    const errors: LiveframeError[] = [];
    expect(proof.checkNode(tree.root, "/root", { errors, maxErrors: 20 })).toBe(true);
    expect(errors).toEqual([]);
  });
});
