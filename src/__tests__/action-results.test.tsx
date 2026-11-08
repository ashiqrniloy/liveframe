/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { pack, type Scenario } from "@arnilo/liveframe/pack";
import {
  type ActionStatus,
  action,
  primitive,
  render,
  type WidgetInputs,
  type WidgetProps,
} from "@arnilo/liveframe/sdk";
import { checkOffered, compileValidator, type LiveframeError, type UiTree, validateCapabilities } from "../index.ts";
import { renderKey } from "../pack/hash.ts";
import { renderTemplate, type Template, validateTemplate } from "../template/index.ts";
import { complete } from "../validate/complete.ts";
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDocument from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const fixture = proofWidgets[0];
if (!fixture) throw new Error("Missing agent-home fixture");
const manifest = fixture.manifest as Parameters<typeof compileValidator>[0]["manifest"];

/** `tasks.claim` returns who owns the task afterwards; the other actions declare no result. */
const capabilities = {
  ...capabilitiesDocument,
  actions: {
    ...capabilitiesDocument.actions,
    "tasks.claim": {
      ...capabilitiesDocument.actions["tasks.claim"],
      result: {
        type: "object",
        properties: { owner: { type: "string", maxLength: 64 } },
        required: ["owner"],
        additionalProperties: false,
      },
    },
  },
};
const validator = compileValidator({ catalog: catalogDocument, capabilities, manifest });
const scenario = fixture.scenarios[0] as WidgetInputs;
const options = { validator, surfaceId: "home", revision: 1 };

const Text = primitive<{ readonly text: string }>("text");
const echo = (props: WidgetProps) => <Text text={JSON.stringify(props.actions)} />;
const shown = (actions?: unknown): string => {
  const result = render(echo, { ...scenario, ...(actions === undefined ? {} : { actions }) } as WidgetInputs, options);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value.root.props.text as string;
};
const failures = (actions: unknown): readonly LiveframeError[] => {
  const result = render(echo, { ...scenario, actions } as WidgetInputs, options);
  return result.ok ? [] : result.errors;
};

describe("action results", () => {
  test("actions_input_defaults_to_empty", () => {
    expect(shown()).toBe("{}");
    expect(shown({})).toBe("{}");
    expect(shown({ "tasks.claim": { status: "pending" } })).toBe('{"tasks.claim":{"status":"pending"}}');
  });

  test("actions_value_must_match_result_schema", () => {
    expect(failures({ "tasks.claim": { status: "ok", value: { owner: "ana" } } })).toEqual([]);
    expect(failures({ "tasks.claim": { status: "ok", value: { owner: 3 } } })).toContainEqual(
      expect.objectContaining({ kind: "invalid-prop", pointer: "/actions/tasks.claim/value/owner" }),
    );
    expect(failures({ "tasks.claim": { status: "ok" } })).toEqual([]);
    // `value` belongs to ok only, and only an action with a result schema may carry one.
    expect(failures({ "tasks.claim": { status: "failed", value: { owner: "ana" } } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/tasks.claim/value" }),
    );
    expect(failures({ "queue.retry": { status: "ok", value: 1 } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/queue.retry/value" }),
    );
  });

  test("a_row_key_names_its_action_and_types_its_value", () => {
    expect(failures({ "claim:t1": { status: "ok", action: "tasks.claim", value: { owner: "ana" } } })).toEqual([]);
    expect(failures({ "claim:t1": { status: "ok", action: "tasks.claim", value: { owner: 1 } } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/claim:t1/value/owner" }),
    );
    // Without `action` a row key cannot be typed, an unknown action is refused, and a name-keyed entry may not rename itself.
    expect(failures({ "claim:t1": { status: "pending" } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/claim:t1/action" }),
    );
    expect(failures({ "claim:t1": { status: "pending", action: "tasks.nope" } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/claim:t1/action" }),
    );
    expect(failures({ "tasks.claim": { status: "pending", action: "queue.retry" } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/tasks.claim/action" }),
    );
  });

  test("actions_input_is_bounded_and_closed", () => {
    expect(failures({ "tasks.claim": { status: "done" } }).length).toBeGreaterThan(0);
    expect(failures({ "tasks.claim": { status: "failed", reason: "x".repeat(501) } })).toContainEqual(
      expect.objectContaining({ pointer: "/actions/tasks.claim/reason" }),
    );
    expect(failures({ "tasks.claim": { status: "pending", at: "x".repeat(65) } }).length).toBeGreaterThan(0);
    expect(failures({ "tasks.claim": { status: "pending", extra: true } }).length).toBeGreaterThan(0);
    expect(failures({ [`k${"x".repeat(128)}`]: { status: "pending", action: "tasks.claim" } }).length).toBeGreaterThan(
      0,
    );
    const many = Object.fromEntries(
      Array.from({ length: 65 }, (_, i) => [`row:${i}`, { status: "pending", action: "tasks.claim" }]),
    );
    expect(failures(many)).toContainEqual(expect.objectContaining({ pointer: "/actions" }));
    expect(failures("pending")).toContainEqual(expect.objectContaining({ pointer: "/actions" }));
  });

  test("result_key_survives_completion_and_checkOffered", () => {
    const offered = { type: "action", name: "tasks.claim", args: { id: "t1" }, resultKey: "claim:t1" } as const;
    const tree: UiTree = {
      format: "liveframe/1",
      catalogId: (catalogDocument as { catalogId: string }).catalogId,
      surfaceId: "home",
      revision: 1,
      root: { id: "root", kind: "button", props: { label: "Claim" }, events: { onPress: offered } },
    };
    const origin = { surfaceId: "home", revision: 1, nodeId: "root", event: "onPress" };
    expect(complete(offered)).toEqual(offered);
    expect(checkOffered(tree, origin, complete(offered), validator).ok).toBe(true);
    const { resultKey: _, ...without } = offered;
    expect(checkOffered(tree, origin, without, validator).ok).toBe(false);
    expect(checkOffered(tree, origin, { ...offered, resultKey: "claim:t2" }, validator).ok).toBe(false);
    // The tree validator accepts the field and bounds it.
    expect(validator.validateTree(tree).ok).toBe(true);
    const bad = { ...tree, root: { ...tree.root, events: { onPress: { ...offered, resultKey: "" } } } };
    expect(validator.validateTree(bad).ok).toBe(false);
  });

  test("action_accepts_a_result_key", () => {
    expect(action("tasks.claim", { id: "t1" }, { resultKey: "claim:t1" })).toEqual({
      type: "action",
      name: "tasks.claim",
      args: { id: "t1" },
      resultKey: "claim:t1",
    });
    expect(action("tasks.claim", { id: "t1" })).not.toHaveProperty("resultKey");
    expect(() => action("tasks.claim", {}, { resultKey: "" })).toThrow();
    expect(action("tasks.claim", { id: "t1" }, { bind: "id", resultKey: "k" })).toMatchObject({ bind: "id" });
  });

  test("capabilities_result_is_a_checked_schema", () => {
    expect(validateCapabilities(capabilities).ok).toBe(true);
    const broken = {
      ...capabilities,
      actions: {
        ...capabilities.actions,
        "tasks.claim": { ...capabilities.actions["tasks.claim"], result: { type: "object" } },
      },
    };
    expect(validateCapabilities(broken).ok).toBe(false);
  });

  test("renderKey_changes_with_actions", () => {
    const inputs = { hash: "sha256-abc", catalogId: "proof.ui@1", params: {}, state: {}, data: {}, context: {} };
    const none = renderKey(inputs);
    expect(renderKey({ ...inputs, actions: {} })).toBe(none);
    const pending = renderKey({ ...inputs, actions: { "tasks.claim": { status: "pending" } } });
    expect(pending).not.toBe(none);
    expect(renderKey({ ...inputs, actions: { "tasks.claim": { status: "failed" } } })).not.toBe(pending);
    expect(renderKey({ ...inputs, actions: { "tasks.claim": { reason: "x", status: "pending" } } })).not.toBe(pending);
  });

  test("proof_pending_and_failed_claim_scenarios_render", () => {
    const labels = (name: string): string[] => {
      const found = fixture.scenarios.find((entry) => entry.name === name);
      if (!found) throw new Error(`Missing scenario ${name}`);
      const result = render((props) => fixture.widget(props), found, options);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      const out: string[] = [];
      const walk = (node: UiTree["root"]) => {
        if (typeof node.props.label === "string") out.push(node.props.label);
        if (typeof node.props.text === "string") out.push(node.props.text);
        for (const child of node.children ?? []) walk(child);
      };
      walk(result.value.root);
      return out;
    };
    expect(labels("ready")).toContain("Claim");
    expect(labels("claim-pending")).toContain("Claiming…");
    expect(labels("claim-pending")).not.toContain("Claim");
    expect(labels("claim-failed")).toContain("Could not claim: Already claimed by another reviewer");
  });

  test("scenario_actions_are_checked_by_pack", () => {
    const scenarios = fixture.scenarios as readonly Scenario[];
    const input = {
      files: { "entry.ts": "export default () => null;" },
      entry: "entry.ts",
      manifest: fixture.manifest,
    };
    const options = { catalog: catalogDocument, capabilities };
    const good = pack({ ...input, scenarios }, options as never);
    expect(good.ok).toBe(true);
    const first = scenarios[0] as Scenario;
    const bad = pack(
      { ...input, scenarios: [{ ...first, actions: { "tasks.claim": { status: "ok", value: { owner: 1 } } } }] },
      options as never,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(bad.errors).toContainEqual(
        expect.objectContaining({ pointer: "/scenarios/0/actions/tasks.claim/value/owner" }),
      );
  });
});

describe("action results in templates", () => {
  const template: Template = {
    format: "liveframe-template/1",
    root: {
      kind: "button",
      props: {
        label: {
          $cond: [
            { $eq: [{ $get: [{ $get: [{ $path: "actions" }, "tasks.claim"] }, "status"] }, "pending"] },
            "Claiming…",
            "Claim",
          ],
        },
      },
      events: {
        onPress: {
          type: "action",
          name: "tasks.claim",
          args: { id: { $path: "state.selected" } },
          resultKey: { $concat: ["claim:", { $path: "state.selected" }] },
        },
      },
    },
  };

  test("template_result_key_is_an_expression_and_actions_is_typed", () => {
    const checked = validateTemplate(template, {
      catalog: catalogDocument as never,
      capabilities: capabilities as never,
      manifest: manifest as never,
    });
    if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
    const idle = renderTemplate(template, scenario, options);
    if (!idle.ok) throw new Error(JSON.stringify(idle.errors));
    expect(idle.value.root.props.label).toBe("Claim");
    expect(idle.value.root.events?.onPress).toMatchObject({ resultKey: "claim:task-0" });
    const pending = renderTemplate(
      template,
      { ...scenario, actions: { "tasks.claim": { status: "pending" } } } as WidgetInputs,
      options,
    );
    if (!pending.ok) throw new Error(JSON.stringify(pending.errors));
    expect(pending.value.root.props.label).toBe("Claiming…");
  });

  test("template_actions_input_is_checked", () => {
    const bad = renderTemplate(
      template,
      { ...scenario, actions: { "tasks.claim": { status: "nope" } } } as never,
      options,
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.pointer).toBe("/actions/tasks.claim/status");
    const wrongType = {
      ...template,
      root: {
        ...template.root,
        events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t" }, resultKey: 3 } },
      },
    } as unknown as Template;
    expect(
      validateTemplate(wrongType, {
        catalog: catalogDocument as never,
        capabilities: capabilities as never,
        manifest: manifest as never,
      }).ok,
    ).toBe(false);
  });
});

// Type level: the fifth generic types a widget's `actions`, `value` included.
type Claim = Readonly<{ "tasks.claim": ActionStatus<{ readonly owner: string }> }>;
test("typed_actions_in_widget_props", () => {
  const widget = ({ actions }: WidgetProps<object, object, object, object, Claim>) => {
    const owner: string | undefined = actions["tasks.claim"]?.value?.owner;
    // @ts-expect-error: a name the type does not list
    actions["tasks.other"];
    return <Text text={owner ?? "nobody"} />;
  };
  const inputs: WidgetInputs<object, object, object, object, Claim> = { params: {}, state: {}, data: {}, context: {} };
  expect(typeof widget).toBe("function");
  expect(inputs.actions).toBeUndefined();
});
