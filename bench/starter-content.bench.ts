// The starter's content kinds at their bounds (plan 039 design, F12 budget): recorded, not gated. Production React is
// selected before React loads. The chart row is a server render of the whole surface, the React work a client frame
// also pays; layout and paint are the browser's, and the browser test draws the same chart at its bound.
import { strict as assert } from "node:assert";
import { metric, timed } from "./metrics.ts";

process.env.NODE_ENV = "production";
const { compileValidator } = await import("@arnilo/liveframe");
const { createRenderer } = await import("@arnilo/liveframe/react");
const { createElement } = await import("react");
const { renderToString } = await import("react-dom/server");
const { catalog, designSystem, implementations, themes } = await import("../packages/starter/src/index.ts");
const { parseRichText } = await import("../packages/starter/src/rich-text.ts");
const { capabilities, manifest, tree } = await import("../packages/starter/src/__tests__/host.ts");

const text = Array.from(
  { length: 60 },
  (_, i) => `- item **${i}** with *emphasis*, \`code\` and a [link](https://example.com/${i})`,
)
  .join("\n")
  .slice(0, 4000);
assert(text.length === 4000, "formatted text at its bound");
for (let i = 0; i < 50; i++) parseRichText(text);
const parse = timed(() => parseRichText(text), 500);
metric("starter.richTextParse4000Ms", parse.wallMs);

const labels = Array.from({ length: 100 }, (_, i) => `d${i}`);
const series = Array.from({ length: 4 }, (_, n) => ({
  name: `s${n}`,
  values: labels.map((_, i) => Math.round(Math.sin(i / 7 + n) * 100)),
}));
const chart = tree("bench", { id: "root", kind: "chart", props: { label: "Bound", type: "bar", labels, series } });
const validator = compileValidator({ catalog, capabilities, manifest });
assert(validator.validateTree(chart).ok, "chart at its bound is valid");
const { Surface } = createRenderer({ catalog, implementations });
const [theme] = themes;
if (!theme) throw new Error("Missing theme");
const draw = () =>
  renderToString(
    createElement(Surface, { tree: chart, validator, theme, designSystem, fallback: "Unavailable", onIntent() {} }),
  );
assert((draw().match(/<rect /g) ?? []).length === 400, "every bar drawn");
for (let i = 0; i < 20; i++) draw();
const render = timed(draw, 100);
metric("starter.chart400RenderMs", render.wallMs);

console.log(`richText: parse ${text.length} characters: ${parse.wallMs.toFixed(3)} ms`);
console.log(`chart: 4 × 100 bars, production server render: ${render.wallMs.toFixed(3)} ms (frame 16 ms)`);
