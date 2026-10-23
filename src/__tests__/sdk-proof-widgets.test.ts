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
import capabilitiesDocument from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const catalogResult = validateCatalog(catalogDocument);
const capabilitiesResult = validateCapabilities(capabilitiesDocument);
if (!catalogResult.ok || !capabilitiesResult.ok) throw new Error("Invalid proof documents");
const catalog = catalogResult.value;
const capabilities = capabilitiesResult.value;

function flexRows(node: UiNode): UiNode {
  if (node.kind !== "grid") return { ...node, ...(node.children ? { children: node.children.map(flexRows) } : {}) };
  expect(node.style?.columns).toEqual(["space.4", "1fr", "0fr"]);
  return {
    ...node,
    kind: "inline",
    style: { gap: "space.3", align: "start" },
    children: (node.children ?? []).map((child) => ({
      ...child,
      ...(child.id.endsWith("/marker") ? { style: { width: "space.4", shrink: 0 } } : {}),
      ...(child.id.endsWith("/body") ? { style: { ...child.style, grow: 1, basis: 0 } } : {}),
      ...(child.id.endsWith("/flag") ? { style: { ...child.style, shrink: 0 } } : {}),
    })),
  };
}

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
    test(`proof_trees_match_exports: ${exportName} (queue-row grid, marker, body and flag)`, async () => {
      const scenario = fixture.scenarios.find((entry) => entry.name === scenarioName);
      if (!scenario) throw new Error(`Missing scenario ${scenarioName}`);
      const result = render(fixture.widget, scenario, { validator, surfaceId: "proof", revision: 0 });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      const expected: UiTree = await Bun.file(
        new URL(`./fixtures/proof/${exportName}.tree.json`, import.meta.url),
      ).json();
      // QueueRow's compact track becomes flex: retain ids and node counts for the benchmark.
      expect(result.value).toEqual({ ...expected, root: flexRows(expected.root) });
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
    "core-queue": ["small", "medium", "large", "full"],
    "git-status": ["ready", "empty", "benchmark"],
    "rack-module": ["ready", "benchmark"],
  });
});
