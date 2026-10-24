import { expect, test } from "bun:test";
import { render } from "@arnilo/liveframe/sdk";
import {
  compileValidator,
  type UiNode,
  type UiTree,
  validateCapabilities,
  validateCatalog,
  validateManifest,
} from "../index.ts";
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import type { QueueProps } from "./fixtures/widgets/agent-home/manifest.ts";
import capabilitiesDocument from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const catalogResult = validateCatalog(catalogDocument);
const capabilitiesResult = validateCapabilities(capabilitiesDocument);
if (!catalogResult.ok || !capabilitiesResult.ok) throw new Error("Invalid proof documents");
const catalog = catalogResult.value;
const capabilities = capabilitiesResult.value;

function nodes(node: UiNode): UiNode[] {
  return [node, ...(node.children ?? []).flatMap(nodes)];
}

for (const fixture of proofWidgets) {
  test(`ported_manifests_validate: ${fixture.name}`, () => {
    expect(validateManifest(fixture.manifest, { catalog, capabilities }).ok).toBe(true);
  });

  const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
  for (const scenario of fixture.scenarios) {
    test(`proof_scenarios_render: ${fixture.name}/${scenario.name}`, () => {
      const result = render(fixture.widget, scenario, { validator, surfaceId: "proof", revision: 0 });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      expect(validator.validateTree(result.value).ok).toBe(true);
      expect(render(fixture.widget, scenario, { validator, surfaceId: "proof", revision: 0 })).toEqual(result);
    });
  }

  for (const [scenarioName, exportName] of Object.entries(fixture.exports)) {
    test(`proof_trees_match_exports: ${exportName}`, async () => {
      const scenario = fixture.scenarios.find((entry) => entry.name === scenarioName);
      if (!scenario) throw new Error(`Missing scenario ${scenarioName}`);
      const result = render(fixture.widget, scenario, { validator, surfaceId: "proof", revision: 0 });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      const expected: UiTree = await Bun.file(
        new URL(`./fixtures/proof/${exportName}.tree.json`, import.meta.url),
      ).json();
      expect(result.value).toEqual(expected);
    });
  }
}

test("proof_node_counts_hold", async () => {
  for (const fixture of proofWidgets) {
    const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
    for (const [scenarioName, exportName] of Object.entries(fixture.exports)) {
      const scenario = fixture.scenarios.find((entry) => entry.name === scenarioName);
      if (!scenario) throw new Error(`Missing scenario ${scenarioName}`);
      const result = render(fixture.widget, scenario, { validator, surfaceId: "proof", revision: 0 });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      const expected: UiTree = await Bun.file(
        new URL(`./fixtures/proof/${exportName}.tree.json`, import.meta.url),
      ).json();
      expect(nodes(result.value.root)).toHaveLength(nodes(expected.root).length);
      if (exportName === "agent-home") expect(nodes(result.value.root)).toHaveLength(679);
    }
  }
});

test("proof_scenario_inventory", () => {
  expect(
    Object.fromEntries(proofWidgets.map((fixture) => [fixture.name, fixture.scenarios.map((s) => s.name)])),
  ).toEqual({
    "agent-home": ["ready", "host-ready", "loading", "empty", "failed", "read-only", "no-alerts", "no-escalate"],
    "core-queue": ["small", "medium", "large", "full", "host-small", "host-medium", "host-large", "host-full"],
    "git-status": ["ready", "empty", "benchmark"],
    "rack-module": ["ready", "benchmark"],
    harness: ["ready"],
  });
});

test("small_queue_counts_pages_through_cursor", () => {
  const fixture = proofWidgets.find((entry) => entry.name === "core-queue");
  const scenario = fixture?.scenarios.find((entry) => entry.name === "small");
  if (!fixture || !scenario) throw new Error("Missing small queue");
  const inputs = scenario as QueueProps;
  const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
  const groups = inputs.data.groups.map((group) => {
    if (group.id !== "decisions") return group;
    const row = group.pages[0]?.rows[0];
    if (!row) throw new Error("Missing decision");
    return { ...group, pages: [...group.pages, { cursor: "next", rows: [{ ...row, id: "extra" }] }] };
  });
  for (const [cursor, count] of [
    ["start", "50"],
    ["next", "51"],
  ] as const) {
    const result = render(
      fixture.widget,
      {
        ...inputs,
        state: { ...inputs.state, cursors: { ...inputs.state.cursors, decisions: cursor } },
        data: { ...inputs.data, groups },
      },
      { validator, surfaceId: "proof", revision: 0 },
    );
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(nodes(result.value.root).find((node) => node.kind === "heading")?.props.text).toBe(count);
  }
});
