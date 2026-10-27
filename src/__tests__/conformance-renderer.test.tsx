import { expect, test } from "bun:test";
import { ConformanceFailure } from "@arnilo/liveframe/conformance";
import { rendererSuite } from "@arnilo/liveframe/conformance/react";
import type { UiTree } from "../index.ts";
import { implement, type Implementation } from "../react/index.ts";
import { catalog, identity, surfaceProps, tree } from "./fixtures/react-surface.tsx";
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

function implementations(broken = ""): Implementation[] {
  return catalog.definitions.map((definition) =>
    implement(definition, (input) => {
      if (broken === "throw" && definition.kind === "button" && input.slot("root").includes("primary"))
        throw new Error("Broken primary variant");
      return (
        <div
          className={
            broken === "slot" && definition.kind === "text"
              ? undefined
              : broken === "classes"
                ? input.slot("root").split(" ")[0]
                : input.slot("root")
          }
          style={broken === "style" && definition.kind === "text" ? undefined : input.style}
        >
          {input.children}
        </div>
      );
    }),
  );
}
const base = tree();
const input: UiTree = {
  ...base,
  root: {
    ...base.root,
    children: [
      { id: "root/first", kind: "text", props: { text: "First" }, style: { padding: "space.2" } },
      { id: "root/second", kind: "text", props: { text: "Second" }, style: { padding: "space.2" } },
      { id: "root/button", kind: "button", variant: "primary", props: { label: "Save" } },
    ],
    style: { gap: { base: "space.1", "bp.md": "space.2" } },
  },
};
const options = {
  catalog,
  capabilities,
  manifest,
  themes: [identity],
  designSystems: [identity],
  examples: [input],
  fallback: surfaceProps.fallback,
};

async function fails(bindings: Implementation[], name: string) {
  const c = rendererSuite({ ...options, implementations: bindings }).find((c) => c.name === name);
  if (!c) throw new Error(`Missing case: ${name}`);
  try {
    await c.run();
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    expect(error).toMatchObject({ rule: name, spec: "§11" });
    return;
  }
  throw new Error(`Case passed: ${name}`);
}

test("renderer_server_cases_pass_and_are_runner_independent", async () => {
  const cases = rendererSuite({ ...options, implementations: implementations() });
  expect(cases.map((c) => c.name)).toEqual([
    "registry_check_passes",
    "every_example_renders_on_the_server_under_every_design_system",
    "every_node_carries_its_root_slot_class_and_style",
    "invalid_arrival_renders_only_the_fallback",
  ]);
  await Promise.all(cases.map((c) => c.run()));
});

test("renderer_server_cases_catch_broken_implementations", async () => {
  const slots = "every_node_carries_its_root_slot_class_and_style";
  await fails(implementations("slot"), slots);
  await fails(implementations("style"), slots);
  await fails(implementations("classes"), slots);
  await fails(implementations("throw"), "every_example_renders_on_the_server_under_every_design_system");
  await fails(implementations().slice(1), "registry_check_passes");
  // One styled element cannot stand in for two nodes of the same kind/variant.
  let texts = 0;
  await fails(
    catalog.definitions.map((d) =>
      implement(d, (props) => (
        <div className={props.slot("root")} style={d.kind === "text" && texts++ === 1 ? {} : props.style}>
          {props.children}
        </div>
      )),
    ),
    slots,
  );
});

test("renderer_server_cases_reject_invalid_or_empty_examples", async () => {
  for (const examples of [[], [{ ...input, catalogId: "wrong.ui@1" }]]) {
    const cases = rendererSuite({ ...options, examples, implementations: implementations() });
    for (const c of cases.slice(1)) await expect(c.run()).rejects.toBeInstanceOf(ConformanceFailure);
  }
});

test("invalid_arrivals_never_call_even_throwing_implementations", async () => {
  const c = rendererSuite({ ...options, implementations: implementations("throw") }).find(
    (c) => c.name === "invalid_arrival_renders_only_the_fallback",
  );
  if (!c) throw new Error("Missing invalid-arrival case");
  await c.run();
});

test("conformance_semantics_fixtures_render", async () => {
  const children = ["form", "group", "figure", "status", "alert"].map((semantics) => ({
    id: `root/${semantics}`,
    kind: "stack",
    props: { semantics, label: semantics },
    children: [{ id: `root/${semantics}/text`, kind: "text", props: { text: semantics } }],
  }));
  const examples = [{ ...base, root: { ...base.root, children } }];
  const cases = rendererSuite({ ...options, examples, implementations: implementations() });
  await Promise.all(cases.map((c) => c.run()));
});
