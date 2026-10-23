import { action, render, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { jsx, jsxs } from "@arnilo/liveframe/sdk/jsx-runtime";
import { compileValidator, obj, str, type UiNode } from "../../index.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./widgets/index.ts";
import { Button, Heading, Inline, Stack, Text } from "./widgets/ui.gen.ts";

export function countNodes(node: UiNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}

// The historical runtime bench's 50 rows; escalation now requires a reason.
const rows = Array.from({ length: 50 }, (_, i) => ({
  id: `task:${i}`,
  title: `Synthetic task ${i}`,
  detail: "Waiting on you",
  owner: "You",
}));
const syntheticInputs = { params: {}, state: { selected: "task:0" }, data: { rows }, context: { size: "full" } };
function syntheticQueue({ data }: WidgetProps<object, { selected: string }, { rows: typeof rows }, { size: string }>) {
  return jsxs(Stack, {
    gap: "space.3",
    children: [
      jsx(Heading, { text: "Waiting on you", level: 2 }),
      jsx(
        Stack,
        {
          children: data.rows.map((row) =>
            jsxs(
              Inline,
              {
                gap: "space.2",
                children: [
                  jsx(Text, { text: row.title }),
                  jsx(Text, { text: row.detail }, "detail"),
                  jsx(Text, { text: row.owner }, "owner"),
                  jsx(Button, { label: "Select", onPress: state.set("selected", row.id) }, "select"),
                  jsx(Button, { label: "Claim", onPress: action("tasks.claim", { id: row.id }) }, "claim"),
                  jsx(
                    Button,
                    {
                      label: "Escalate",
                      onPress: action("tasks.escalate", { id: row.id, reason: "Needs help" }),
                    },
                    "escalate",
                  ),
                ],
              },
              row.id,
            ),
          ),
        },
        "rows",
      ),
    ],
  });
}

/** Compile outside timing; each run includes widget execution, input checks and tree construction. */
export function renderWorkloads() {
  const workloads = [];
  for (const fixture of proofWidgets) {
    const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
    for (const scenarioName of Object.keys(fixture.exports)) {
      const scenario = fixture.scenarios.find((entry) => entry.name === scenarioName);
      if (!scenario) throw new Error(`Missing ${fixture.name}/${scenarioName}`);
      const queue = fixture.name === "agent-home" || fixture.name === "core-queue";
      const rack = fixture.name === "rack-module";
      const name = fixture.name === "core-queue" ? `core-queue.${scenarioName}` : fixture.name;
      workloads.push({
        name,
        period: rack ? 3 : queue ? 50 : 1,
        validator,
        run(i: number) {
          let inputs: WidgetProps = scenario;
          if (queue)
            inputs = {
              params: scenario.params,
              data: scenario.data,
              context: scenario.context,
              state: {
                ...(scenario.state as object),
                selected: `${fixture.name === "agent-home" ? "task" : "decision"}-${i % 50}`,
              },
            };
          if (rack)
            inputs = {
              params: scenario.params,
              data: scenario.data,
              context: scenario.context,
              state: { ...(scenario.state as object), tab: ["files", "om", "context"][i % 3], draft: `Draft ${i}` },
            };
          const result = render(fixture.widget, inputs, { validator, surfaceId: "proof", revision: 0 });
          if (!result.ok) throw new Error(`${name}: ${JSON.stringify(result.errors)}`);
          return result.value;
        },
      });
    }
  }
  const validator = compileValidator({
    catalog,
    capabilities: {
      ...capabilities,
      sources: {
        ...capabilities.sources,
        "benchmark.rows": {
          description: "Runtime benchmark rows",
          params: obj({}),
          result: {
            type: "array",
            maxItems: 50,
            items: obj({
              id: str({ maxLength: 128 }),
              title: str({ maxLength: 128 }),
              detail: str({ maxLength: 128 }),
              owner: str({ maxLength: 128 }),
            }),
          },
        },
      },
    },
    manifest: {
      format: "liveframe-manifest/1",
      id: "synthetic-queue",
      version: "1.0.0",
      catalogId: catalog.catalogId,
      params: obj({}),
      context: obj({ size: str({ enum: ["full"], maxLength: 4 }) }),
      state: obj({ selected: str({ maxLength: 128 }) }),
      initialState: { selected: "task:0" },
      sources: { rows: { source: "benchmark.rows", params: {} } },
      actions: ["tasks.claim", "tasks.escalate"],
    },
  });
  workloads.push({
    name: "synthetic-queue",
    period: 1,
    validator,
    run() {
      const result = render(syntheticQueue, syntheticInputs, { validator, surfaceId: "proof", revision: 0 });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return result.value;
    },
  });
  return workloads;
}
