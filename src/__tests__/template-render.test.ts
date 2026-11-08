import { expect, test } from "bun:test";
import { render, type WidgetInputs } from "@arnilo/liveframe/sdk";
import {
  compileValidator,
  type UiNode,
  type UiTree,
  validateCapabilities,
  validateCatalog,
  validateManifest,
} from "../index.ts";
import { canonicalJson } from "../pack/hash.ts";
import { renderTemplate, type Template, type TemplateNode, validateTemplate } from "../template/index.ts";
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import { coreQueueTemplate } from "./fixtures/templates/core-queue.ts";
import { gitStatusTemplate } from "./fixtures/templates/git-status.ts";
import capabilitiesDocument from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { rootLabel, sanitizeText } from "./fixtures/widgets/git-status/labels.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

const catalog = validateCatalog(catalogDocument);
const capabilities = validateCapabilities(capabilitiesDocument);
if (!catalog.ok || !capabilities.ok) throw new Error("Invalid proof documents");

const templates: Record<string, Template> = {
  "agent-home": agentHomeTemplate,
  "core-queue": coreQueueTemplate,
  "git-status": gitStatusTemplate,
};
const options = (validator: ReturnType<typeof compileValidator>) => ({ validator, surfaceId: "proof", revision: 0 });
const fixture = (name: string) => {
  const found = proofWidgets.find((widget) => widget.name === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
};

/** Label sanitising needs regular expressions, so a source does it (design T22); the template gets clean labels. */
function cleaned(inputs: WidgetInputs): WidgetInputs {
  const data = inputs.data as { statuses: Record<string, unknown>[] };
  return {
    ...inputs,
    data: {
      statuses: data.statuses.map((entry) => {
        const snapshot = entry.snapshot as { head?: Record<string, string> } | undefined;
        const head = snapshot?.head;
        return {
          ...entry,
          workspaceRoot: rootLabel(entry.workspaceRoot),
          ...(snapshot && head
            ? {
                snapshot: {
                  ...snapshot,
                  head: {
                    ...head,
                    ...(head.name === undefined ? {} : { name: sanitizeText(head.name, "main") }),
                    ...(head.shortSha === undefined ? {} : { shortSha: sanitizeText(head.shortSha, "HEAD") }),
                  },
                },
              }
            : {}),
        };
      }),
    },
  };
}

for (const name of Object.keys(templates)) {
  const widget = fixture(name);
  const validator = compileValidator({
    catalog: catalogDocument,
    capabilities: capabilitiesDocument,
    manifest: widget.manifest,
  });
  const template = templates[name] as Template;

  test(`template_ports_validate: ${name}`, () => {
    const installed = validateManifest(widget.manifest, { catalog: catalog.value, capabilities: capabilities.value });
    if (!installed.ok) throw new Error(JSON.stringify(installed.errors));
    const result = validateTemplate(template, {
      catalog: catalog.value,
      capabilities: capabilities.value,
      manifest: installed.value,
    });
    expect(result.ok).toBe(true);
  });

  for (const scenario of widget.scenarios) {
    test(`template_parity_with_tsx_proof_widgets: ${name}/${scenario.name}`, () => {
      const expected = render(widget.widget, scenario, options(validator));
      if (!expected.ok) throw new Error(JSON.stringify(expected.errors));
      const inputs = name === "git-status" ? cleaned(scenario) : scenario;
      expect(renderTemplate(template, inputs, options(validator))).toEqual(expected);
    });
  }
}

test("template_parity_holds_for_every_focus_filter_and_escalation", () => {
  const widget = fixture("agent-home");
  const validator = compileValidator({
    catalog: catalogDocument,
    capabilities: capabilitiesDocument,
    manifest: widget.manifest,
  });
  const base = widget.scenarios.find((scenario) => scenario.name === "host-ready") as (typeof widget.scenarios)[number];
  const data = base.data as { groups: { pages: { rows: { id: string }[] }[] }[] };
  const ids = data.groups.flatMap((group) => group.pages.flatMap((page) => page.rows.map((row) => row.id)));
  const cursors = { decisions: "d-2", tasks: "t-3", alerts: "a-2" };
  const states = [
    ...ids.map((selected) => ({ selected })),
    ...ids.flatMap((selected) => ["", "Needs help"].map((reason) => ({ selected, escalating: selected, reason }))),
    ...["decisions", "tasks", "alerts"].map((filter) => ({ filter })),
    { cursors },
    { cursors, filter: "alerts", selected: "no-such-row" },
  ];
  for (const change of states) {
    const inputs = { ...base, state: { ...(base.state as object), ...change } };
    const expected = render(widget.widget, inputs, options(validator));
    if (!expected.ok) throw new Error(JSON.stringify(expected.errors));
    expect(renderTemplate(agentHomeTemplate, inputs, options(validator))).toEqual(expected);
  }
});

// ---- small templates over the agent-home manifest ----

const widget = fixture("agent-home");
const validator = compileValidator({
  catalog: catalogDocument,
  capabilities: capabilitiesDocument,
  manifest: widget.manifest,
});
const scenario = widget.scenarios.find((entry) => entry.name === "host-ready") as (typeof widget.scenarios)[number];
const p = (path: string) => ({ $path: path });
const doc = (root: TemplateNode, components?: Template["components"]): Template => ({
  format: "liveframe-template/1",
  ...(components ? { components } : {}),
  root,
});
const stack = (...children: TemplateNode[]): TemplateNode => ({ kind: "stack", children });
const text = (value: unknown, key?: string): TemplateNode =>
  ({ kind: "text", ...(key ? { key } : {}), props: { text: value } }) as TemplateNode;
const run = (template: Template, inputs: WidgetInputs = scenario, extra = {}) =>
  renderTemplate(template, inputs, { ...options(validator), ...extra });
const ok = (result: ReturnType<typeof run>): UiTree => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
};
const ids = (node: UiNode): string[] => [node.id, ...(node.children ?? []).flatMap(ids)];

test("each_key_builds_key_path_ids", () => {
  const tree = ok(
    run(
      doc(
        stack({
          $each: { in: p("data.groups"), as: "group", key: p("group.id") },
          kind: "stack",
          children: [text(p("group.label"), "label")],
        }),
      ),
    ),
  );
  expect(ids(tree.root)).toEqual([
    "root",
    "root/decisions",
    "root/decisions/label",
    "root/tasks",
    "root/tasks/label",
    "root/alerts",
    "root/alerts/label",
  ]);
});

test("each_index_and_empty_arrays", () => {
  const rows = doc(
    stack(
      { $each: { in: { $lit: [] }, as: "x", key: p("x") }, ...text("never") },
      {
        $each: { in: p("data.groups"), as: "group", index: "at", key: p("at") },
        ...text({ $text: p("at") }),
      },
    ),
  );
  const tree = ok(run(rows));
  expect(tree.root.children?.map((child) => child.id)).toEqual(["root/0", "root/1", "root/2"]);
  expect(tree.root.children?.map((child) => child.props.text)).toEqual(["0", "1", "2"]);
});

test("use_leaves_no_node", () => {
  const component = {
    params: { type: "object", properties: {}, required: [], additionalProperties: false } as never,
    root: text("inside", "inner"),
  };
  const tree = ok(run(doc(stack({ $use: "Line", key: "line", with: {} }), { Line: component })));
  // The use-site key wins over the root's own key, and the component leaves no node of its own.
  expect(ids(tree.root)).toEqual(["root", "root/line"]);
  expect(tree.root.children?.[0]?.kind).toBe("text");
});

test("if_false_emits_nothing", () => {
  const tree = ok(
    run(doc(stack({ $if: { $eq: [p("state.filter"), "tasks"] }, ...text("hidden") }, text("shown", "shown")))),
  );
  expect(ids(tree.root)).toEqual(["root", "root/shown"]);
  const shown = ok(run(doc(stack({ $if: { $eq: [p("state.filter"), "all"] }, ...text("visible", "x") }))));
  expect(ids(shown.root)).toEqual(["root", "root/x"]);
});

test("let_binds_once_per_expansion_and_is_visible_to_children", () => {
  const tree = ok(
    run(
      doc({
        $let: [{ as: "label", value: { $concat: ["Filter: ", p("state.filter")] } }],
        kind: "stack",
        children: [text(p("label"))],
      }),
    ),
  );
  expect(tree.root.children?.[0]?.props.text).toBe("Filter: all");
});

test("omitted_optional_props_are_dropped_and_required_ones_reported", () => {
  const dropped = ok(run(doc(stack({ kind: "icon", key: "i", props: { name: "x", label: { $omit: null } } }))));
  expect(dropped.root.children?.[0]?.props).toEqual({ name: "x" });
  const missing = run(doc(stack({ kind: "icon", key: "i", props: { name: { $omit: null } } })));
  expect(missing.ok).toBe(false);
});

test("evaluation_error_points_into_template", () => {
  const result = run(
    doc(
      stack(text("fine", "a"), { kind: "text", key: "b", props: { text: { $text: { $div: [1, { $sub: [1, 1] }] } } } }),
    ),
  );
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors).toHaveLength(1);
  const error = result.errors[0];
  expect(error?.kind).toBe("invalid-prop");
  expect(error?.pointer).toBe("/root/children/1/props/text/$text/$div");
  expect(error?.nodeId).toBe("root");
});

test("errors_inside_children_carry_the_enclosing_node_id", () => {
  const result = run(
    doc(
      stack({
        kind: "stack",
        key: "outer",
        children: [{ kind: "text", key: "bad", props: { text: { $text: { $div: [1, 0] } } } }],
      }),
    ),
  );
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.nodeId).toBe("root/outer");
  expect(result.errors[0]?.pointer).toBe("/root/children/0/children/0/props/text/$text/$div");
});

test("errors_are_collected_up_to_maxErrors_then_bounded", () => {
  const bad = (key: string): TemplateNode => ({ kind: "text", key, props: { text: { $text: { $div: [1, 0] } } } });
  const result = run(doc(stack(bad("a"), bad("b"), bad("c"), bad("d"))), scenario, { maxErrors: 2 });
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors.map((error) => error.kind)).toEqual(["invalid-prop", "invalid-prop", "limit-exceeded"]);
});

test("build_errors_point_into_the_template", () => {
  // Tabs hold tab nodes only; the single-pass build reports the offending child at its template pointer.
  const result = run(
    doc(stack({ kind: "tabs", key: "t", props: { label: "x", value: "all" }, children: [text("not a tab", "n")] })),
  );
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.kind).toBe("invalid-children");
  expect(result.errors[0]?.pointer.startsWith("/root/children/0/children/0")).toBe(true);
});

test("duplicate_keys_from_each_are_reported", () => {
  const result = run(
    doc(stack({ $each: { in: p("data.groups"), as: "group", key: { $lit: "same" } }, ...text(p("group.label")) })),
  );
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.kind).toBe("duplicate-key");
});

test("fuel_exhaustion_is_limit_exceeded", () => {
  const template = doc(
    stack({ $each: { in: p("data.groups"), as: "group", key: p("group.id") }, ...text(p("group.label")) }),
  );
  expect(run(template).ok).toBe(true);
  const result = run(template, scenario, { limits: { steps: 5 } });
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.kind).toBe("limit-exceeded");
  const same = run(template, scenario, { limits: { steps: 1_000_000, nodes: 2 } });
  expect(same.ok).toBe(false);
});

test("limits_steps_must_be_a_positive_integer", () => {
  for (const steps of [0, -1, 1.5, Number.NaN]) {
    const result = run(doc(stack()), scenario, { limits: { steps } });
    if (result.ok) throw new Error("expected a failure");
    expect(result.errors[0]?.expected).toBe("limits.steps to be a positive safe integer");
  }
});

test("a_template_that_does_not_fit_the_validator_is_refused_with_install_errors", () => {
  const result = run(doc(stack(text(p("data.nope")))));
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.kind).toBe("unknown-name");
  const malformed = run({ format: "liveframe-template/1", root: { kind: "stack", $use: "X" } } as never);
  expect(malformed.ok).toBe(false);
  expect(run(null as never).ok).toBe(false);
});

test("a_cyclic_component_graph_is_refused_before_it_can_recurse", () => {
  const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as never;
  const cyclic = doc(stack({ $use: "A", with: {} }), {
    A: { params: empty, root: { kind: "stack", children: [{ $use: "B", with: {} }] } },
    B: { params: empty, root: { kind: "stack", children: [{ $use: "A", with: {} }] } },
  });
  const result = run(cyclic);
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.kind).toBe("invalid-document");
});

test("a_frozen_template_compiles_once_and_an_unfrozen_one_each_call", () => {
  const live = doc(stack(text(p("state.filter"), "t")));
  const first = ok(run(live));
  ((live.root.children as TemplateNode[])[0] as { props: { text: unknown } }).props.text = "changed";
  expect(ok(run(live)).root.children?.[0]?.props.text).toBe("changed");
  expect(first.root.children?.[0]?.props.text).toBe("all");
  const frozen = Object.freeze(doc(stack(text(p("state.filter"), "t"))));
  expect(run(frozen)).toEqual(run(frozen));
});

test("template_render_deterministic", () => {
  for (const [name, template] of Object.entries(templates)) {
    const proof = fixture(name);
    const checker = compileValidator({
      catalog: catalogDocument,
      capabilities: capabilitiesDocument,
      manifest: proof.manifest,
    });
    for (const input of proof.scenarios) {
      const inputs = name === "git-status" ? cleaned(input) : input;
      const first = renderTemplate(template, inputs, options(checker));
      const second = renderTemplate(template, inputs, options(checker));
      if (!first.ok || !second.ok) throw new Error(JSON.stringify(first));
      expect(canonicalJson(first.value)).toBe(canonicalJson(second.value));
    }
  }
});

test("inputs_not_mutated", () => {
  const before = structuredClone(scenario);
  const inputs = structuredClone(scenario);
  ok(run(agentHomeTemplate, inputs));
  expect(inputs).toEqual(before);
  expect(Object.isFrozen(inputs.data)).toBe(false);
});

test("inputs_are_checked_against_the_manifest", () => {
  const bad = { ...scenario, state: { ...(scenario.state as object), filter: "nonsense" } };
  const result = run(agentHomeTemplate, bad);
  if (result.ok) throw new Error("expected a failure");
  expect(result.errors[0]?.pointer.startsWith("/state")).toBe(true);
});

test("a_template_cannot_reach_globals_or_prototypes", () => {
  for (const path of ["globalThis", "process.env", "state.constructor", "state.__proto__.x", "constructor"]) {
    const result = run(doc(stack(text(p(path)))));
    expect(result.ok).toBe(false);
  }
});
