import { strict as assert } from "node:assert";
import { fromA2ui } from "../packages/a2ui/src/index.ts";
import { metric, timed } from "./metrics.ts";

// Converting a 500-component A2UI surface (design 039 F11 budget): recorded, not gated. Linearity is a test
// (`conversion_is_linear` in packages/a2ui), so this row only tracks the time per conversion of JSONL text.
const catalogId = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
const rows = 166;
const components = [
  { id: "root", component: "Column", children: Array.from({ length: rows }, (_, i) => `row${i}`) },
  ...Array.from({ length: rows }, (_, i) => [
    { id: `row${i}`, component: "Row", children: [`text${i}`, `go${i}`] },
    { id: `text${i}`, component: "Text", text: { path: `/tasks/${i}/title` } },
    { id: `go${i}`, component: "Button", action: { event: { name: "claim", context: { id: `t${i}` } } } },
  ]).flat(),
];
const tasks = Array.from({ length: rows }, (_, i) => ({ title: `Task number ${i}` }));
const jsonl = [
  { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId } },
  { version: "v0.9.1", updateComponents: { surfaceId: "main", components } },
  { version: "v0.9.1", updateDataModel: { surfaceId: "main", value: { tasks } } },
]
  .map((message) => JSON.stringify(message))
  .join("\n");
const mapping = {
  catalogId,
  components: {
    Column: { kind: "stack" },
    Row: { kind: "inline" },
    Text: { kind: "text", props: { text: "text" } },
    Button: { kind: "button", event: "onPress" },
  },
  actions: { claim: "tasks.claim" },
};

assert(components.length === 499, "about 500 components");
const run = () => assert(fromA2ui(jsonl, mapping).ok);
for (let i = 0; i < 50; i++) run();
const { wallMs } = timed(run, 200);
metric("a2ui.convert500Ms", wallMs);
console.log(`fromA2ui: ${components.length} components, ${jsonl.length} characters of JSONL: ${wallMs.toFixed(3)} ms`);
