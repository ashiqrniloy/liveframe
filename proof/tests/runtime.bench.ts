import {
  action,
  Button,
  Heading,
  Inline,
  proofCatalog,
  render,
  Stack,
  state,
  Text,
  WidgetError,
} from "../runtime/index.ts";
import { jsx, jsxs } from "../runtime/jsx-runtime.ts";
import type { RenderOptions, UiNode, WidgetProps } from "../runtime/types.ts";

const rows = Array.from({ length: 50 }, (_, i) => ({
  id: `task:${i}`,
  title: `Synthetic task ${i}`,
  detail: "Waiting on you",
  owner: "You",
}));
const inputs = { params: {}, state: { selected: "task:0" }, data: { rows }, context: { size: "full" } };
const options: RenderOptions = {
  catalog: proofCatalog,
  actions: ["tasks.claim", "tasks.escalate"],
  state: {
    type: "object",
    properties: { selected: { type: "string", maxLength: 128 } },
    required: ["selected"],
    additionalProperties: false,
  },
};

// Synthetic full queue until Tasks 6–8 supply the host and real queue widget.
function queue({
  data,
}: WidgetProps<typeof inputs.params, typeof inputs.state, typeof inputs.data, typeof inputs.context>) {
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
                  jsx(Button, { label: "Escalate", onPress: action("tasks.escalate", { id: row.id }) }, "escalate"),
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

function run() {
  const result = render(queue, inputs, options);
  if (result instanceof WidgetError) throw result;
  return result;
}
for (let i = 0; i < 200; i++) run();
const iterations = 1000;
const start = performance.now();
for (let i = 0; i < iterations; i++) run();
const mean = (performance.now() - start) / iterations;
const result = run();
const count = (node: UiNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
console.log(
  `full_queue_renders_under_budget: ${rows.length} rows, ${count(result.root)} nodes, ${mean.toFixed(3)} ms mean (${iterations} renders, 2 ms budget)`,
);
if (mean >= 2) throw new Error(`Render mean ${mean.toFixed(3)} ms exceeds 2 ms`);
