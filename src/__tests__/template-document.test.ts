import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { validateCapabilities, validateCatalog, validateManifest } from "../index.ts";
import { validateTemplate } from "../template/index.ts";
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import capabilitiesDocument from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const catalog = validateCatalog(catalogDocument);
const capabilities = validateCapabilities(capabilitiesDocument);
if (!catalog.ok || !capabilities.ok) throw new Error("Invalid proof documents");
const installed = validateManifest(proofWidgets[0]?.manifest, {
  catalog: catalog.value,
  capabilities: capabilities.value,
});
if (!installed.ok) throw new Error(JSON.stringify(installed.errors));
const context = { catalog: catalog.value, capabilities: capabilities.value, manifest: installed.value };

type Doc = Record<string, unknown>;
const p = (path: string) => ({ $path: path });
const empty = { type: "object", properties: {}, required: [], additionalProperties: false };
const template = (root: Doc, components?: Doc): Doc => ({
  format: "liveframe-template/1",
  ...(components ? { components } : {}),
  root,
});
const stack = (...children: Doc[]): Doc => ({ kind: "stack", children });
const label = (value: unknown): Doc => ({ kind: "button", props: { label: value } });

/** `kind pointer` for each error, in the order reported. */
function problems(doc: unknown): string[] {
  const result = validateTemplate(doc, context);
  return result.ok ? [] : result.errors.map((error) => `${error.kind} ${error.pointer}`);
}

test("agent_home_template_validates", () => {
  expect(problems(agentHomeTemplate)).toEqual([]);
  const result = validateTemplate(agentHomeTemplate, context);
  expect(result.ok && result.value).toBe(agentHomeTemplate);
});

test("install_validation_of_agent_home_within_budget", () => {
  for (let i = 0; i < 20; i++) validateTemplate(agentHomeTemplate, context);
  const start = performance.now();
  for (let i = 0; i < 100; i++) validateTemplate(agentHomeTemplate, context);
  const perCall = (performance.now() - start) / 100;
  console.log(`template install validation: ${perCall.toFixed(2)} ms (agent-home port, budget 5 ms)`);
  expect(perCall).toBeLessThan(5);
});

test("template_unknown_path_unknown_name", () => {
  expect(problems(template(stack({ kind: "text", props: { text: p("data.nope") } })))).toEqual([
    "unknown-name /root/children/0/props/text/$path",
  ]);
  expect(problems(template(stack({ kind: "text", props: { text: p("globals.x") } })))).toEqual([
    "unknown-name /root/children/0/props/text/$path",
  ]);
  expect(problems(template(stack({ kind: "text", props: { text: p("state.nope") } })))).toEqual([
    "unknown-name /root/children/0/props/text/$path",
  ]);
});

test("prototype_segments_rejected_in_paths", () => {
  for (const path of ["state.__proto__", "state.constructor", "data.groups.0.prototype"])
    expect(problems(template(stack({ kind: "text", props: { text: p(path) } })))).toEqual([
      "invalid-document /root/children/0/props/text/$path",
    ]);
});

test("document_structure_is_checked_first", () => {
  expect(problems(null)).toEqual(["invalid-document "]);
  expect(problems({ ...template(stack()), extra: 1 })).toEqual(["invalid-document /extra"]);
  expect(problems({ ...template(stack()), format: "liveframe-template/2" })).toEqual(["invalid-document /format"]);
  expect(problems({ format: "liveframe-template/1" })).toEqual(["invalid-document /root"]);
  expect(problems(template({ kind: "stack", children: [{ kind: "text", props: {}, nope: 1 }] }))).toEqual([
    "invalid-document /root/children/0/nope",
  ]);
  const cyclic: Doc = template(stack());
  (cyclic.root as Doc).children = [cyclic.root];
  expect(problems(cyclic)).toEqual(["invalid-document /root/children/0"]);
  expect(problems(template(stack({ kind: "text", props: { text: Number.NaN } })))).toEqual([
    "invalid-document /root/children/0/props/text",
  ]);
});

test("document_size_is_bounded", () => {
  const big = template(stack({ kind: "text", props: { text: "x".repeat(2_000_000) } }));
  expect(problems(big)).toEqual(["limit-exceeded "]);
});

test("node_needs_a_kind_or_a_use_but_not_both", () => {
  expect(problems(template(stack({ props: {} })))).toEqual(["invalid-document /root/children/0"]);
  expect(problems(template(stack({ kind: "text", $use: "A" }), { A: { params: empty, root: label("x") } }))).toEqual([
    "invalid-document /root/children/0",
  ]);
});

test("binding_type_mismatch_invalid_prop", () => {
  expect(problems(template(stack(label(p("params.canAct")))))).toEqual(["invalid-prop /root/children/0/props/label"]);
  // A number does not bind to a string prop, and an integer prop rejects a computed number.
  expect(problems(template(stack({ kind: "text", props: { text: { $add: [1, 2] } } })))).toEqual([
    "invalid-prop /root/children/0/props/text",
  ]);
  expect(problems(template(stack({ kind: "heading", props: { text: "x", level: { $div: [4, 2] } } })))).toEqual([
    "invalid-prop /root/children/0/props/level",
  ]);
  // An enum prop accepts a conditional between its values and rejects an arbitrary string.
  const semantics = (value: unknown) => template(stack({ kind: "box", props: { semantics: value } }));
  expect(problems(semantics({ $cond: [p("params.canAct"), "section", "aside"] }))).toEqual([]);
  expect(problems(semantics(p("state.selected")))).toEqual(["invalid-prop /root/children/0/props/semantics"]);
});

test("literals_are_checked_with_the_real_schema_at_install", () => {
  expect(problems(template(stack(label("x".repeat(81)))))).toEqual(["invalid-prop /root/children/0/props/label"]);
  expect(problems(template(stack(label("x".repeat(80)))))).toEqual([]);
  expect(problems(template(stack({ kind: "heading", props: { text: "x", level: 7 } })))).toEqual([
    "invalid-prop /root/children/0/props/level",
  ]);
});

test("optional_values_need_a_guard_for_a_required_prop", () => {
  const next = p("data.groups.0.pages.0.nextCursor");
  const text = (guard?: unknown) =>
    problems(template(stack({ ...(guard ? { $if: guard } : {}), kind: "text", props: { text: next } })));
  expect(text()).toEqual(["invalid-prop /root/children/0/props/text"]);
  expect(text({ $has: next })).toEqual([]);
  // The guard may not use a name the `$each` binds later: `$if` runs before `$each`.
  const each = problems(
    template(
      stack({
        $if: { $has: p("g.id") },
        $each: { in: p("data.groups"), as: "g", key: p("g.id") },
        kind: "text",
        props: { text: p("g.id") },
      }),
    ),
  );
  expect(each[0]).toBe("unknown-name /root/children/0/$if/$has/$path");
});

test("element_props_variants_style_and_events_are_checked", () => {
  const one = (node: Doc) => problems(template(stack(node)));
  expect(one({ kind: "text", props: { text: "x", nope: 1 } })).toEqual(["invalid-prop /root/children/0/props/nope"]);
  expect(one({ kind: "text", props: {} })).toEqual(["invalid-prop /root/children/0/props/text"]);
  expect(one({ kind: "button", variant: "huge", props: { label: "x" } })).toEqual([
    "invalid-prop /root/children/0/variant",
  ]);
  expect(one({ kind: "button", variant: "primary", props: { label: "x" } })).toEqual([]);
  expect(one({ kind: "stack", style: { gap: "space.99" } })).toEqual(["invalid-prop /root/children/0/style/gap"]);
  expect(one({ kind: "stack", style: { gap: "space.2" } })).toEqual([]);
  // A style prop the kind does not declare is a prop, which the kind does not declare either.
  expect(one({ kind: "button", props: { label: "x" }, style: { gap: "space.2" } })).toEqual([
    "invalid-prop /root/children/0/style/gap",
  ]);
  expect(
    one({
      kind: "button",
      props: { label: "x" },
      events: { onTap: { type: "setState", key: "filter", value: "all" } },
    }),
  ).toEqual(["undeclared-event /root/children/0/events/onTap"]);
  // A name may live in one section only, and reserved names belong to the node.
  expect(one({ kind: "stack", props: { gap: "space.2" }, style: { gap: "space.2" } })).toEqual([
    "invalid-prop /root/children/0/style/gap",
  ]);
  expect(one({ kind: "stack", props: { key: "a" } })).toEqual(["invalid-prop /root/children/0/props/key"]);
});

test("kinds_come_from_the_catalog", () => {
  expect(problems(template(stack({ kind: "carousel" })))).toEqual(["unknown-component /root/children/0/kind"]);
  expect(problems(template({ kind: "carousel" }))).toEqual(["unknown-component /root/kind"]);
});

test("children_follow_the_kind_rules_where_statically_known", () => {
  const menu = (...children: Doc[]) => template(stack({ kind: "menu", props: { label: "Actions" }, children }));
  const item: Doc = { kind: "menuItem", props: { label: "Open" } };
  expect(problems(menu(item))).toEqual([]);
  expect(problems(menu({ kind: "text", props: { text: "x" } }))).toEqual([
    "invalid-children /root/children/0/children/0/kind",
  ]);
  expect(problems(template(stack({ kind: "menu", props: { label: "Actions" } })))).toEqual([
    "invalid-children /root/children/0/children",
  ]);
  expect(
    problems(
      template(stack({ kind: "text", props: { text: "x" }, children: [{ kind: "text", props: { text: "y" } }] })),
    ),
  ).toEqual(["invalid-children /root/children/0/children"]);
  // A component is placed by its root's kind, and a fragment is transparent.
  const row = { params: empty, root: { kind: "text", props: { text: "x" } } };
  expect(
    problems(template(stack({ kind: "menu", props: { label: "A" }, children: [{ $use: "Row" }] }), { Row: row })),
  ).toEqual(["invalid-children /root/children/0/children/0/$use"]);
  expect(
    problems(
      template(stack({ kind: "menu", props: { label: "A" }, children: [{ kind: "fragment", children: [item] }] })),
    ),
  ).toEqual([]);
  expect(
    problems(
      template(
        stack({
          kind: "menu",
          props: { label: "A" },
          children: [{ kind: "fragment", children: [{ kind: "text", props: { text: "x" } }] }],
        }),
      ),
    ),
  ).toEqual(["invalid-children /root/children/0/children/0/children/0/kind"]);
});

test("fragments_carry_only_a_key_and_children", () => {
  expect(problems(template(stack({ kind: "fragment", props: {}, children: [] })))).toEqual([
    "invalid-prop /root/children/0/props",
  ]);
  expect(problems(template({ kind: "fragment", children: [] }))).toEqual(["invalid-document /root"]);
});

test("each_requires_key", () => {
  const each = (spec: Doc, node: Doc = {}) =>
    template(stack({ $each: spec, kind: "text", props: { text: p("g.id") }, ...node }));
  expect(problems(each({ in: p("data.groups"), as: "g" }))).toEqual(["missing-key /root/children/0/$each/key"]);
  expect(problems(each({ in: p("data.groups"), as: "g", key: p("g.id") }))).toEqual([]);
  expect(problems(each({ in: p("data.groups"), as: "g", key: p("g.id") }, { key: "k" }))).toEqual([
    "invalid-document /root/children/0/key",
  ]);
  expect(problems(each({ in: p("data.groups"), as: "g", key: p("g.id") }, { $anchor: "a" }))).toEqual([
    "invalid-document /root/children/0/$anchor",
  ]);
});

test("each_binds_item_and_index_and_checks_the_source", () => {
  const each = (spec: Doc, text: unknown = p("g.id")) =>
    problems(template(stack({ $each: { key: p("g.id"), ...spec }, kind: "text", props: { text } })));
  expect(each({ in: p("data.groups"), as: "g", index: "i" }, { $text: p("i") })).toEqual([]);
  expect(each({ in: p("data.status"), as: "g" })).toEqual(["invalid-prop /root/children/0/$each/in"]);
  expect(each({ in: p("data.groups"), as: "state", key: "k" }, "x")).toEqual([
    "invalid-document /root/children/0/$each/as",
  ]);
  expect(each({ in: p("data.groups"), as: "g", index: "g" })).toEqual([
    "invalid-document /root/children/0/$each/index",
  ]);
  // The key must be a string or number.
  expect(each({ in: p("data.groups"), as: "g", key: p("g.label") })).toEqual([]);
  expect(each({ in: p("data.groups"), as: "g", key: { $gt: [1, 0] } })).toEqual([
    "invalid-prop /root/children/0/$each/key",
  ]);
  expect(each({ in: p("data.groups"), as: "g", key: "" })).toEqual(["invalid-prop /root/children/0/$each/key"]);
});

test("keys_are_strings_or_numbers", () => {
  const keyed = (key: unknown) => problems(template(stack({ kind: "text", key, props: { text: "x" } })));
  expect(keyed("a")).toEqual([]);
  expect(keyed(3)).toEqual([]);
  expect(keyed(p("state.selected"))).toEqual([]);
  expect(keyed(true)).toEqual(["invalid-prop /root/children/0/key"]);
  expect(keyed("")).toEqual(["invalid-prop /root/children/0/key"]);
  expect(keyed("x".repeat(129))).toEqual(["invalid-prop /root/children/0/key"]);
});

test("directive_order_let_then_if_then_each", () => {
  const node = (extra: Doc) => problems(template(stack({ kind: "text", props: { text: p("n") }, ...extra })));
  // `$let` sees the widget roots; `$if` sees `$let`; the body sees `$each`.
  expect(
    problems(
      template(
        stack({
          $let: [{ as: "n", value: p("state.selected") }],
          $if: { $gt: [{ $len: p("n") }, 0] },
          kind: "text",
          props: { text: p("n") },
        }),
      ),
    ),
  ).toEqual([]);
  // `$let` cannot see `$each` names.
  expect(
    problems(
      template(
        stack({
          $let: [{ as: "n", value: p("g.id") }],
          $each: { in: p("data.groups"), as: "g", key: p("g.id") },
          kind: "text",
          props: { text: p("n") },
        }),
      ),
    ),
  ).toEqual(["unknown-name /root/children/0/$let/0/value/$path"]);
  expect(node({ $if: p("state.selected") })).toEqual([
    "invalid-prop /root/children/0/$if",
    "unknown-name /root/children/0/props/text/$path",
  ]);
});

test("if_requires_a_boolean_and_narrows_with_has", () => {
  const cond = (test: unknown) =>
    problems(template(stack({ $if: test, kind: "text", props: { text: p("data.groups.0.pages.0.nextCursor") } })));
  expect(cond(p("params.canAct"))).toEqual(["invalid-prop /root/children/0/props/text"]);
  expect(cond("yes")).toEqual(["invalid-prop /root/children/0/$if", "invalid-prop /root/children/0/props/text"]);
  expect(cond({ $has: p("data.groups.0.pages.0.nextCursor") })).toEqual([]);
  expect(cond({ $and: [{ $has: p("data.groups.0.pages.0.nextCursor") }, p("params.canAct")] })).toEqual([]);
  expect(cond({ $or: [{ $has: p("data.groups.0.pages.0.nextCursor") }, p("params.canAct")] })).toEqual([
    "invalid-prop /root/children/0/props/text",
  ]);
});

test("the_widget_root_must_render_one_element", () => {
  expect(problems(template({ ...stack(), $if: p("params.canAct") }))).toEqual(["invalid-document /root/$if"]);
  expect(problems(template({ ...stack(), $each: { in: p("data.groups"), as: "g", key: p("g.id") } }))).toEqual([
    "invalid-document /root/$each",
  ]);
});

test("names_may_not_shadow", () => {
  const bind = (...names: string[]) => problems(template({ $let: names.map((as) => ({ as, value: 1 })), ...stack() }));
  expect(bind("n", "m")).toEqual([]);
  expect(bind("params")).toEqual(["invalid-document /root/$let/0/as"]);
  expect(bind("n", "n")).toEqual(["invalid-document /root/$let/1/as"]);
  expect(bind("N")).toEqual(["invalid-document /root/$let/0/as"]);
  expect(bind("constructor")).toEqual(["invalid-document /root/$let/0/as"]);
});

test("let_bindings_are_bounded", () => {
  const names = Array.from({ length: 33 }, (_, i) => `n${String.fromCharCode(97 + (i % 26))}${i}`);
  expect(problems(template({ $let: names.map((as) => ({ as, value: 1 })), ...stack() }))).toEqual([
    "limit-exceeded /root/$let",
  ]);
  expect(problems(template({ $let: names.slice(0, 32).map((as) => ({ as, value: 1 })), ...stack() }))).toEqual([]);
});

test("use_with_must_match_params", () => {
  const params = {
    type: "object",
    properties: {
      title: { type: "string", maxLength: 80 },
      count: { type: "integer", minimum: 0 },
      note: { type: "string", maxLength: 10 },
    },
    required: ["title", "count"],
    additionalProperties: false,
  };
  const Row = { params, root: { kind: "text", props: { text: p("title") } } };
  const use = (withValues: Doc | undefined, node: Doc = {}) =>
    problems(template(stack({ $use: "Row", ...(withValues ? { with: withValues } : {}), ...node }), { Row }));
  expect(use({ title: "a", count: 1 })).toEqual([]);
  // Lengths are checked when rendered, as for any bound string.
  expect(use({ title: "a", count: 1, note: p("state.reason") })).toEqual([]);
  expect(use({ title: "a" })).toEqual(["invalid-prop /root/children/0/with"]);
  expect(use(undefined)).toEqual(["invalid-prop /root/children/0/with", "invalid-prop /root/children/0/with"]);
  expect(use({ title: "a", count: 1, extra: 1 })).toEqual(["unknown-name /root/children/0/with/extra"]);
  expect(use({ title: p("params.canAct"), count: 1 })).toEqual(["invalid-prop /root/children/0/with/title"]);
  expect(use({ title: "a", count: { $div: [1, 2] } })).toEqual(["invalid-prop /root/children/0/with/count"]);
  expect(problems(template(stack({ $use: "Nope" })))).toEqual(["unknown-name /root/children/0/$use"]);
});

test("use_nodes_carry_no_element_fields", () => {
  const Row = { params: empty, root: { kind: "text", props: { text: "x" } } };
  for (const field of ["props", "style", "events", "children", "variant", "$anchor"]) {
    const value = field === "$anchor" || field === "variant" ? "x" : field === "children" ? [] : {};
    const result = problems(template(stack({ $use: "Row", [field]: value }), { Row }));
    expect(result, field).toEqual([`invalid-document /root/children/0/${field}`]);
  }
  expect(problems(template(stack({ kind: "text", props: { text: "x" }, with: {} })))).toEqual([
    "invalid-document /root/children/0/with",
  ]);
});

test("components_are_hermetic", () => {
  const body = (text: unknown) =>
    template(stack({ $use: "C" }), { C: { params: empty, root: { kind: "text", props: { text } } } });
  expect(problems(body(p("state.title")))).toEqual(["unknown-name /components/C/root/props/text/$path"]);
  expect(problems(body(p("params.canAct")))).toEqual(["unknown-name /components/C/root/props/text/$path"]);
  // Its own params may carry the names of the widget roots, because it sees no roots.
  const named = {
    type: "object",
    properties: { state: { type: "string", maxLength: 10 }, params: { type: "string", maxLength: 10 } },
    required: ["state", "params"],
    additionalProperties: false,
  };
  expect(
    problems(
      template(stack({ $use: "C", with: { state: "a", params: "b" } }), {
        C: { params: named, root: { kind: "text", props: { text: { $concat: [p("state"), p("params")] } } } },
      }),
    ),
  ).toEqual([]);
  const bad = {
    ...empty,
    properties: { Bad: { type: "string", maxLength: 1 } },
    required: [],
  };
  expect(problems(template(stack(), { C: { params: bad, root: label("x") } }))).toEqual([
    "invalid-document /components/C/params/properties/Bad",
  ]);
});

test("component_roots_emit_one_node", () => {
  const each = { $each: { in: [1, 2], as: "n", key: p("n") }, kind: "text", props: { text: "x" } };
  expect(problems(template(stack({ $use: "C" }), { C: { params: empty, root: each } }))).toEqual([
    "invalid-document /components/C/root/$each",
  ]);
  const optional = { $if: false, kind: "text", props: { text: "x" } };
  expect(problems(template(stack({ $use: "C" }), { C: { params: empty, root: optional } }))).toEqual([]);
});

test("template_cyclic_use_rejected", () => {
  const params = empty;
  const direct = { A: { params, root: stack({ $use: "A" }) } };
  expect(problems(template(stack({ $use: "A" }), direct))).toEqual([
    "invalid-document /components/A/root/children/0/$use",
  ]);
  const mutual = { A: { params, root: stack({ $use: "B" }) }, B: { params, root: stack({ $use: "A" }) } };
  expect(problems(template(stack({ $use: "A" }), mutual))).toEqual([
    "invalid-document /components/B/root/children/0/$use",
  ]);
  // A cycle among components the widget never uses is still a cycle.
  expect(problems(template(stack(), mutual))).toEqual(["invalid-document /components/B/root/children/0/$use"]);
});

test("use_depth_is_bounded", () => {
  const chain = (length: number) => {
    const components: Doc = {};
    for (let i = 0; i < length; i++)
      components[`C${String.fromCharCode(65 + (i % 26))}${i}`] = {
        params: empty,
        root: i + 1 < length ? stack({ $use: `C${String.fromCharCode(65 + ((i + 1) % 26))}${i + 1}` }) : stack(),
      };
    return template(stack({ $use: "CA0" }), components);
  };
  expect(problems(chain(16))).toEqual([]);
  expect(problems(chain(17))).toHaveLength(1);
  expect(problems(chain(17))[0]).toStartWith("limit-exceeded ");
});

test("components_are_bounded", () => {
  const components: Doc = {};
  for (let i = 0; i < 65; i++) components[`C${i}`] = { params: empty, root: label("x") };
  expect(problems(template(stack(), components))).toEqual(["limit-exceeded /components"]);
  delete components.C64;
  expect(problems(template(stack(), components))).toEqual([]);
});

test("template_undeclared_action_rejected", () => {
  const press = (intent: Doc) =>
    problems(template(stack({ kind: "button", props: { label: "Go" }, events: { onPress: intent } })));
  expect(press({ type: "action", name: "tasks.delete", args: {} })).toEqual([
    "undeclared-action /root/children/0/events/onPress/name",
  ]);
  // Declared in the capabilities but not in this manifest.
  expect(press({ type: "action", name: "agent.send", args: { text: "x" } })).toEqual([
    "undeclared-action /root/children/0/events/onPress/name",
  ]);
  expect(press({ type: "action", name: "tasks.claim", args: { id: p("state.selected") } })).toEqual([]);
});

test("action_arguments_are_checked_against_the_capability", () => {
  const press = (args: Doc, extra: Doc = {}, event = "button") =>
    problems(
      template(
        stack(
          event === "button"
            ? {
                kind: "button",
                props: { label: "Go" },
                events: { onPress: { type: "action", name: "tasks.escalate", args, ...extra } },
              }
            : {
                kind: "textField",
                props: { label: "Reason" },
                events: { onChange: { type: "action", name: "tasks.escalate", args, ...extra } },
              },
        ),
      ),
    );
  const at_ = "/root/children/0/events/onPress";
  expect(press({ id: "a", reason: "b" })).toEqual([]);
  expect(press({ id: "a" })).toEqual([`invalid-prop ${at_}/args/reason`]);
  expect(press({ id: "a", reason: "b", extra: 1 })).toEqual([`invalid-prop ${at_}/args/extra`]);
  expect(press({ id: p("params.canAct"), reason: "b" })).toEqual([`invalid-prop ${at_}/args/id`]);
  expect(press({ id: "a", reason: "x".repeat(501) })).toEqual([`invalid-prop ${at_}/args/reason`]);
  expect(press({ id: p("state.selected"), reason: p("state.reason") })).toEqual([]);
  // `bind` completes one argument from the event; the other must be supplied.
  const change = "/root/children/0/events/onChange";
  expect(press({ id: "a" }, { bind: "reason" }, "field")).toEqual([]);
  expect(press({ id: "a", reason: "b" }, { bind: "reason" }, "field")).toEqual([`invalid-prop ${change}/args/reason`]);
  expect(press({ id: "a" }, { bind: "nope" }, "field")).toEqual([`invalid-prop ${change}/bind`]);
  // A button carries nothing, so it can complete no argument.
  expect(press({ id: "a" }, { bind: "reason" })).toEqual([`invalid-prop ${at_}/bind`]);
  expect(press({ id: "a" }, { bindAll: true })).toEqual([`invalid-prop ${at_}/bindAll`]);
});

test("set_state_values_are_checked_against_the_state_schema", () => {
  const set = (intent: Doc, kind = "button") =>
    problems(
      template(
        stack(
          kind === "button"
            ? { kind: "button", props: { label: "Go" }, events: { onPress: { type: "setState", ...intent } } }
            : { kind: "textField", props: { label: "Q" }, events: { onChange: { type: "setState", ...intent } } },
        ),
      ),
    );
  const at_ = "/root/children/0/events/onPress";
  expect(set({ key: "filter", value: "tasks" })).toEqual([]);
  expect(set({ key: "filter", value: "other" })).toEqual([`invalid-prop ${at_}/value`]);
  expect(set({ key: "filter", value: p("state.selected") })).toEqual([`invalid-prop ${at_}/value`]);
  expect(set({ key: "selected", value: p("state.selected") })).toEqual([]);
  expect(set({ key: "nope", value: "x" })).toEqual([`invalid-prop ${at_}/key`]);
  // Without a value the event supplies it, so it must carry the state's type.
  expect(set({ key: "reason" })).toEqual([`invalid-prop ${at_}/value`]);
  expect(set({ key: "reason" }, "field")).toEqual([]);
  expect(set({ key: "cursors", value: { $merge: [p("state.cursors"), { $fromEntries: [["tasks", "c1"]] }] } })).toEqual(
    [],
  );
  expect(set({ key: "cursors", value: { decisions: "a", tasks: "b", alerts: "c" } })).toEqual([]);
  expect(set({ key: "cursors", value: { decisions: "a" } })).toEqual([`invalid-prop ${at_}/value`]);
});

test("events_are_intents_only", () => {
  const event = (value: unknown) =>
    problems(template(stack({ kind: "button", props: { label: "Go" }, events: { onPress: value } })));
  const errors = event({ type: "navigate" });
  expect(errors.length).toBeGreaterThan(0);
  for (const error of errors) expect(error).toStartWith("invalid-document /root/children/0/events/onPress/");
});

test("anchors_are_unique_and_references_resolve", () => {
  const note = (anchor: string): Doc => ({ kind: "text", $anchor: anchor, props: { text: "x" } });
  expect(problems(template(stack(note("a"), note("b"))))).toEqual([]);
  expect(problems(template(stack(note("a"), note("a"))))).toEqual(["duplicate-key /root/children/1/$anchor"]);
});

test("references_name_anchors_in_the_same_template", () => {
  const described = (anchor: string): Doc => ({
    kind: "text",
    props: { text: "Field", describedBy: { $ref: anchor } },
  });
  const note: Doc = { kind: "text", $anchor: "hint", props: { text: "Hint" } };
  // The proof catalog declares no `describedBy`, so the prop itself is the error; the corpus covers refProps.
  expect(problems(template(stack(described("hint"), note)))).toEqual([
    "invalid-prop /root/children/0/props/describedBy",
  ]);
});

test("bounds_on_template_nodes_and_nesting", () => {
  const texts = (count: number) => Array.from({ length: count }, () => ({ kind: "text", props: { text: "x" } }));
  expect(problems(template(stack(...texts(9_999))))).toEqual([]);
  expect(problems(template(stack(...texts(10_000))))).toEqual(["limit-exceeded /root/children/9999"]);
  let deep: Doc = { kind: "text", props: { text: "x" } };
  for (let i = 0; i < 128; i++) deep = stack(deep);
  expect(problems(template(deep))).toEqual([`limit-exceeded /root${"/children/0".repeat(128)}`]);
});

test("expression_nodes_are_counted_across_components_and_root", () => {
  const numbers = (count: number) => Array.from({ length: count }, (_, i) => i);
  const use = (count: number): Doc => ({ $let: [{ as: "big", value: numbers(count) }], ...stack() });
  expect(problems(template(use(19_990)))).toEqual([]);
  expect(problems(template(use(20_001)))[0]).toStartWith("limit-exceeded ");
  // The budget is one per template: two bodies of 12,000 nodes exceed it together.
  const component = { params: empty, root: use(12_000) };
  const both = template(use(12_000), { C: component });
  const errors = problems(both);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toStartWith("limit-exceeded ");
});

test("expression_errors_point_into_the_template", () => {
  expect(problems(template(stack({ kind: "text", props: { text: { $nope: 1 } } })))).toEqual([
    "invalid-document /root/children/0/props/text/$nope",
  ]);
  expect(problems(template(stack({ kind: "text", props: { text: { $concat: ["a", 1] } } })))).toEqual([
    "invalid-prop /root/children/0/props/text/$concat/1",
  ]);
});

test("errors_are_bounded_at_twenty", () => {
  const bad = Array.from({ length: 40 }, () => ({ kind: "text", props: { text: p("nope") } }));
  expect(problems(template(stack(...bad)))).toHaveLength(20);
});

test("template_subpath_host_api_free", () => {
  const directory = new URL("../template/", import.meta.url);
  const files = readdirSync(directory).filter((name) => name.endsWith(".ts"));
  expect(files).toContain("document.ts");
  for (const name of files) {
    const source = readFileSync(new URL(name, directory), "utf8");
    expect(source, name).not.toMatch(/from\s+["'](?:node|bun):/);
    expect(source, name).not.toMatch(/\b(?:eval|Function)\s*\(|\bglobalThis\b|\bimport\s*\(|\brequire\s*\(/);
    for (const [, specifier] of source.matchAll(/from\s+["']([^"']+)["']/g))
      expect(specifier, name).toMatch(/^\.\.?\//);
  }
});
