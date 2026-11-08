// Plan 030 T9: packing a widget against two library packages must not cost more than packing the same
// widget with the same components bundled in (the libraries are packed once, ahead of the widget).
// Plan 030 T10: rendering that widget with warm libraries stays within 5% of the bundled equivalent.

import { strict as assert } from "node:assert";
import catalogDoc from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { type Result, validateCapabilities, validateCatalog } from "../src/index.ts";
import { pack, type WidgetPackage } from "../src/pack/index.ts";
import { inProcessRunner } from "../src/preview/index.ts";
import { budget, metric } from "./metrics.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const install = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
const ui = await Bun.file(new URL("../src/__tests__/fixtures/widgets/ui.gen.ts", import.meta.url)).text();
const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
const scenarios = [{ name: "ready", params: {}, context: {}, data: {} }];
const manifest = (id: string, extra = {}) => ({
  format: "liveframe-manifest/1",
  id,
  version: "1.0.0",
  catalogId: "proof.ui@1",
  params: empty,
  state: empty,
  context: empty,
  initialState: {},
  sources: {},
  actions: [],
  ...extra,
});
const head = '/** @jsxImportSource @arnilo/liveframe/sdk */\nimport { Heading, Stack, Text } from "./ui.gen.ts";\n';
// Components of a realistic size: some dozens of rows each.
const rows = (prefix: string) =>
  Array.from({ length: 40 }, (_, i) => `<Text key="${prefix}${i}" text={\`${prefix} ${i}: \${title}\`} />`).join(
    "\n      ",
  );
const component = (name: string) =>
  `${head}export function ${name}({ title }: { title: string }) {\n  return (\n    <Stack padding="space.3">\n      <Heading text={title} level={2} />\n      ${rows(name)}\n    </Stack>\n  );\n}\nexport default function Gallery() { return <${name} title="g" />; }\n`;

const libraryFile = (name: string) => ({ "ui.gen.ts": ui, "lib.tsx": component(name) });
const libs: WidgetPackage[] = ["Alpha", "Beta"].map((name) =>
  value(
    pack(
      {
        files: libraryFile(name),
        entry: "lib.tsx",
        manifest: manifest(`bench.${name.toLowerCase()}`, { exports: [name] }),
        scenarios,
      },
      install,
    ),
  ),
);
const body = `export default function Home() { return <Stack><Alpha key="a" title="a" /><Beta key="b" title="b" /></Stack>; }\n`;
const withLibraries = {
  files: {
    "ui.gen.ts": ui,
    "entry.tsx": `${head}import { Alpha } from "liveframe:lib/bench.alpha@1.0.0";\nimport { Beta } from "liveframe:lib/bench.beta@1.0.0";\n${body}`,
  },
  entry: "entry.tsx",
  manifest: manifest("bench.home"),
  scenarios,
  libraries: libs,
};
const bundled = {
  files: {
    "ui.gen.ts": ui,
    "alpha.tsx": component("Alpha"),
    "beta.tsx": component("Beta"),
    "entry.tsx": `${head}import { Alpha } from "./alpha.tsx";\nimport { Beta } from "./beta.tsx";\n${body}`,
  },
  entry: "entry.tsx",
  manifest: manifest("bench.home"),
  scenarios,
};

function median(run: () => unknown, runs = 21): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = process.cpuUsage();
    run();
    const used = process.cpuUsage(start);
    times.push((used.user + used.system) / 1000);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)] as number;
}

const linked = value(pack(withLibraries, { ...install, libraries: libs }));
assert(!(linked.code as string).includes("Alpha 39"), "library code must not be copied into the dependent");
median(() => pack(bundled, install), 3);
median(() => pack(withLibraries, { ...install, libraries: libs }), 3);
const bundledMs = median(() => pack(bundled, install));
const librariesMs = median(() => pack(withLibraries, { ...install, libraries: libs }));
console.log(JSON.stringify({ packBundledMs: bundledMs, packWithLibrariesMs: librariesMs }));
metric("pack_bundled_ms", bundledMs);
metric("pack_with_libraries_ms", librariesMs);
budget(
  librariesMs <= bundledMs,
  `packing with libraries (${librariesMs.toFixed(2)} ms) costs more than bundling (${bundledMs.toFixed(2)} ms)`,
);

// Render: both packages are loaded and warm; the library one also resolves two library modules.
const runner = inProcessRunner();
const renderOptions = { ...install, surfaceId: "bench", revision: 1 };
const props = { params: {}, state: {}, context: {}, data: {}, actions: {} };
const bundledPackage = value(pack(bundled, install));
const renderWith = (pkg: WidgetPackage, libraries?: readonly WidgetPackage[]) =>
  runner.render(pkg, props, { ...renderOptions, ...(libraries ? { libraries } : {}) });
async function batch(pkg: WidgetPackage, libraries?: readonly WidgetPackage[], runs = 200): Promise<number> {
  const start = process.cpuUsage();
  for (let i = 0; i < runs; i++) {
    const rendered = await renderWith(pkg, libraries);
    assert(rendered.ok, JSON.stringify(rendered));
  }
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000 / runs;
}
await batch(bundledPackage, undefined, 20);
await batch(linked, libs, 20);
const bundledRender: number[] = [];
const linkedRender: number[] = [];
for (let i = 0; i < 11; i++) {
  bundledRender.push(await batch(bundledPackage));
  linkedRender.push(await batch(linked, libs));
}
// The fastest batch is the figure least disturbed by a busy machine; both sides get the same treatment.
const bundledRenderMs = Math.min(...bundledRender);
const linkedRenderMs = Math.min(...linkedRender);
console.log(JSON.stringify({ renderBundledMs: bundledRenderMs, renderWithLibrariesMs: linkedRenderMs }));
metric("render_bundled_ms", bundledRenderMs);
metric("render_with_libraries_ms", linkedRenderMs);
budget(
  linkedRenderMs <= bundledRenderMs * 1.05,
  `rendering with libraries (${linkedRenderMs.toFixed(3)} ms) is over 5% above bundled (${bundledRenderMs.toFixed(3)} ms)`,
);
