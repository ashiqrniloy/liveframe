import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Browser } from "playwright";
import { ConformanceFailure } from "../conformance/index.ts";
import { type DomSuiteOptions, domRendererBrowserSuite } from "../conformance/dom/index.ts";
import { launchBrowser } from "./fixtures/browser.ts";
import { examples, fixtures, overlayFixtures, textFixtures } from "./fixtures/conformance-browser.tsx";
import { browserHost } from "./fixtures/conformance-browser-host.ts";
import { domImplementations, domPageOptions } from "./fixtures/conformance-dom.ts";

let server: Awaited<ReturnType<typeof browserHost>>;
let browser: Browser;
beforeAll(async () => {
  server = await browserHost(new URL("./fixtures/conformance-dom-client.ts", import.meta.url).pathname);
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

const { fallback: _fallback, ...shared } = domPageOptions;
const [current] = examples;
if (!current) throw new Error("Missing example");
/** Text, a hint and a field that references it: what the slot, reference and binding cases inspect. */
const refs = {
  ...current,
  surfaceId: "refs",
  root: {
    ...current.root,
    children: [
      { id: "root/first", kind: "text", props: { text: "First" }, style: { padding: "space.2" } },
      { id: "root/second", kind: "text", props: { text: "Second" }, style: { padding: "space.2" } },
      { id: "root/hint", kind: "hint", props: { text: "Hint" } },
      { id: "root/field", kind: "textField", props: { label: "Field", describedBy: "root/hint" } },
    ],
  },
};
const allFixtures: DomSuiteOptions["fixtures"] = {
  ...fixtures,
  overlayKinds: ["dialog"],
  overlays: overlayFixtures,
  textInputKinds: ["textField"],
  textInputs: textFixtures,
};
const suite = (mode = "", implementations = domImplementations()) =>
  domRendererBrowserSuite({
    ...shared,
    implementations,
    examples: [current, refs],
    fixtures: allFixtures,
    page: () => browser.newPage(),
    url: `${server.url.href}?mutant=${mode}`,
  });
const stateRule = "every_styled_state_is_reachable";

test("dom_suite_runs_the_shared_cases", () => {
  expect(suite().map((c) => c.name)).toEqual([
    "registry_check_passes",
    "every_example_renders_on_the_server_under_every_design_system",
    "every_node_carries_its_root_slot_class_and_style",
    "invalid_arrival_renders_only_the_fallback",
    "ref_props_resolve_to_elements_in_the_surface",
    "failed_binding_draws_the_node_fallback",
    "invalid_arrival_shows_only_the_fallback_and_recovers",
    "keep_last_invalid_arrival_keeps_the_last_tree_marked",
    "interactions_raise_one_complete_intent",
    "when_false_node_is_not_drawn",
    "set_local_redraws_and_never_reaches_the_host",
    "local_writes_apply_with_one_complete_host_intent",
    "from_local_intent_arrives_complete",
    "focus_mark_moves_focus_once",
    "focus_scroll_and_local_state_survive_revisions",
    "switching_keeps_nodes_and_focus_and_rerenders_nothing",
    stateRule,
    "overlay_keeps_surface_scope",
    "overlay_exit_finishes_before_unmount",
    "open_overlay_locks_scroll_and_makes_background_inert",
    "text_input_counts_code_points",
  ]);
});

test("dom_fixture_registry_passes_every_shared_case", async () => {
  // The styled-state case needs a fixture per projected state; `conformance-states.test.ts` covers it for both.
  for (const c of suite().filter((c) => c.name !== stateRule)) await c.run();
}, 600000);

test("dom_overlay_keeps_surface_scope", async () => {
  const rule = "overlay_keeps_surface_scope";
  await suite()
    .find((c) => c.name === rule)
    ?.run();
  await expect(
    suite("scope")
      .find((c) => c.name === rule)
      ?.run(),
  ).rejects.toMatchObject({ rule });
}, 120000);

// One broken subject per shared case it must catch: an implementation or page defect, named by its mode.
for (const [mode, name] of [
  ["throw", "every_example_renders_on_the_server_under_every_design_system"],
  ["slot", "every_node_carries_its_root_slot_class_and_style"],
  ["id", "ref_props_resolve_to_elements_in_the_surface"],
  ["proxy-text", "failed_binding_draws_the_node_fallback"],
  ["ignore-keep-last", "keep_last_invalid_arrival_keeps_the_last_tree_marked"],
  ["undeclared", "interactions_raise_one_complete_intent"],
  ["wrong-value", "interactions_raise_one_complete_intent"],
  ["stale-children", "when_false_node_is_not_drawn"],
  ["forward-local", "set_local_redraws_and_never_reaches_the_host"],
  ["post-local", "local_writes_apply_with_one_complete_host_intent"],
  ["unfilled", "from_local_intent_arrives_complete"],
  ["no-dom-id", "focus_mark_moves_focus_once"],
  ["replace", "focus_scroll_and_local_state_survive_revisions"],
  ["context", "switching_keeps_nodes_and_focus_and_rerenders_nothing"],
  ["instant-exit", "overlay_exit_finishes_before_unmount"],
  ["no-lock", "open_overlay_locks_scroll_and_makes_background_inert"],
  ["utf16", "text_input_counts_code_points"],
] as const)
  test(`dom_suite_fails_a_broken_subject_on_its_named_rule: ${mode}`, async () => {
    const c = suite(mode, domImplementations(mode)).find((c) => c.name === name);
    expect(c).toBeDefined();
    try {
      await c?.run();
      throw new Error("Mutant passed");
    } catch (error) {
      expect(error).toBeInstanceOf(ConformanceFailure);
      expect((error as ConformanceFailure).rule).toBe(name);
    }
  }, 120000);

test("dom_suite_fails_a_broken_subject_on_its_named_rule: registry", async () => {
  const c = suite("", domImplementations().slice(1)).find((c) => c.name === "registry_check_passes");
  await expect(c?.run()).rejects.toMatchObject({ rule: "registry_check_passes" });
});

test("dom_law_4_a_renderer_that_forwards_set_local_fails_only_its_rule", async () => {
  const rules = [
    "when_false_node_is_not_drawn",
    "set_local_redraws_and_never_reaches_the_host",
    "local_writes_apply_with_one_complete_host_intent",
    "from_local_intent_arrives_complete",
    "focus_mark_moves_focus_once",
  ];
  const rule = "set_local_redraws_and_never_reaches_the_host";
  for (const c of suite("forward-local", domImplementations("forward-local")).filter((c) => rules.includes(c.name))) {
    if (c.name === rule) await expect(c.run()).rejects.toMatchObject({ rule });
    else await c.run();
  }
}, 240000);

function stateCase(mode = "") {
  return domRendererBrowserSuite({
    ...shared,
    designSystems: shared.designSystems.map((system) => ({
      ...system,
      recipes: {
        ...Object.fromEntries(
          Object.entries(system.recipes)
            .filter(([key]) => key.endsWith(".rest"))
            .flatMap(([key, value]) => [
              [key, value],
              [key.replace(/rest$/, "focus"), {}],
            ]),
        ),
        "button.primary.root.selected": { opacity: 0.5 },
      },
    })),
    implementations: domImplementations(mode),
    examples: [current],
    fixtures: {
      ...allFixtures,
      states: {
        "button.primary.selected": {
          tree: {
            ...fixtures.survival.tree,
            root: { id: "root", kind: "button", variant: "primary", props: { label: "Selected", pressed: true } },
          },
          target: (p) => p.getByRole("button", { name: "Selected" }),
        },
      },
    },
    page: () => browser.newPage(),
    url: `${server.url.href}?mutant=${mode}`,
  }).find((c) => c.name === stateRule);
}
test("dom_state_case_reaches_selected_and_catches_an_unreachable_state", async () => {
  await stateCase()?.run();
  await expect(stateCase("selected")?.run()).rejects.toMatchObject({
    rule: stateRule,
    details: [expect.stringContaining("button.primary.selected")],
  });
}, 120000);
