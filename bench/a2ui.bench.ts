import { strict as assert } from "node:assert";
import { fromA2ui } from "../packages/a2ui/src/index.ts";
import { budget, metric, timed } from "./metrics.ts";

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

const create = { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId } };
const text = (value: unknown) => ({
  version: "v0.9.1",
  updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: value }] },
});
const data = (value: unknown, path = "/") => ({
  version: "v0.9.1",
  updateDataModel: { surfaceId: "main", path, value },
});
// biome-ignore lint/suspicious/noTemplateCurlyInString: A2UI interpolation syntax
const format = { call: "formatString", args: { value: "${/value}".repeat(5) } };
const cases = [
  { name: "sparseIndex", messages: [create, text("Ready"), data({ items: [1] }), data(2, "/items/2")] },
  { name: "formattedText", messages: [create, text(format), data({ value: "x".repeat(160 * 1024) })] },
  { name: "deepPointer", messages: [create, text("Ready"), data(1, "/item".repeat(129))] },
];
for (const { name, messages } of cases) {
  const input = messages.map((message) => JSON.stringify(message)).join("\n");
  const reject = () => {
    const result = fromA2ui(input, mapping, { limits: { bytes: 48 * 1024 } });
    assert(!result.ok && result.errors.length === 1 && result.errors[0]?.kind === "limit-exceeded", name);
    assert.notEqual(result.errors[0].pointer, "/", name);
  };
  const times: number[] = [];
  const growth: number[] = [];
  for (let i = 0; i < 9; i++) {
    const before = process.memoryUsage.rss();
    const start = performance.now();
    reject();
    times.push(performance.now() - start);
    growth.push(Math.max(0, process.memoryUsage.rss() - before));
  }
  const ms = times.sort((a, b) => a - b)[4] as number;
  const rss = growth.sort((a, b) => a - b)[4] as number;
  metric(`a2ui.${name}.wallMs`, ms);
  metric(`a2ui.${name}.rssGrowthBytes`, rss);
  console.log(`fromA2ui ${name}: median ${ms.toFixed(3)} ms, ${rss} bytes RSS growth`);
  budget(ms < 10, `${name}: ${ms.toFixed(3)} ms exceeds the 10 ms budget`);
  budget(rss < 1024 * 1024, `${name}: ${rss} bytes of RSS growth exceeds the 1 MiB budget`);
}
