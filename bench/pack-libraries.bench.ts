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

function medianCpu(run: () => unknown, runs = 21): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = process.cpuUsage();
    run();
    const used = process.cpuUsage(start);
    times.push((used.user + used.system) / 1000);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)] as number;
}

// Each process settles into its own JIT state, and that state moves a 0.12 ms render by a few percent
// either way, so no statistic inside one process can average it out. The parent times the pack comparison
// itself and the render comparison in RENDER_PROCESSES fresh child processes (this file with
// LF_BENCH_CHILD=1), and gates on the median of their linked/bundled ratios.
const child = process.env.LF_BENCH_CHILD === "1";
const RENDER_PROCESSES = 7;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] as number;

const linked = value(pack(withLibraries, { ...install, libraries: libs }));
assert(!(linked.code as string).includes("Alpha 39"), "library code must not be copied into the dependent");

if (!child) {
  medianCpu(() => pack(bundled, install), 3);
  medianCpu(() => pack(withLibraries, { ...install, libraries: libs }), 3);
  const bundledMs = medianCpu(() => pack(bundled, install));
  const librariesMs = medianCpu(() => pack(withLibraries, { ...install, libraries: libs }));
  console.log(JSON.stringify({ packBundledMs: bundledMs, packWithLibrariesMs: librariesMs }));
  metric("pack_bundled_ms", bundledMs);
  metric("pack_with_libraries_ms", librariesMs);
  budget(
    librariesMs <= bundledMs,
    `packing with libraries (${librariesMs.toFixed(2)} ms) costs more than bundling (${bundledMs.toFixed(2)} ms)`,
  );

  type Figures = { bundledMs: number; linkedMs: number };
  const figures: Figures[] = [];
  for (let i = 0; i < RENDER_PROCESSES; i++) {
    const proc = Bun.spawnSync([process.execPath, "--conditions", "liveframe:source", import.meta.path], {
      env: { ...process.env, LF_BENCH_CHILD: "1" },
      stdout: "pipe",
      stderr: "inherit",
    });
    assert(proc.exitCode === 0, `render child ${i} exited ${proc.exitCode}`);
    figures.push(JSON.parse(proc.stdout.toString()) as Figures);
  }
  const ratios = figures.map((f) => f.linkedMs / f.bundledMs);
  const ratio = median(ratios);
  const renderBundledMs = median(figures.map((f) => f.bundledMs));
  const renderWithLibrariesMs = median(figures.map((f) => f.linkedMs));
  console.log(
    JSON.stringify({
      renderBundledMs,
      renderWithLibrariesMs,
      medianRatio: ratio,
      processRatios: ratios.map((r) => Number(r.toFixed(3))),
    }),
  );
  metric("render_bundled_ms", renderBundledMs);
  metric("render_with_libraries_ms", renderWithLibrariesMs);
  metric("render_libraries_ratio", ratio);
  budget(
    ratio <= 1.05,
    `rendering with libraries is ${((ratio - 1) * 100).toFixed(1)}% above bundled (median ratio of ${RENDER_PROCESSES} processes: ${ratios.map((r) => r.toFixed(3)).join(", ")}); the limit is 5%`,
  );
} else {
  // Render: both packages are loaded and warm; the library one also resolves two library modules.
  const runner = inProcessRunner();
  // The gate measures speed, not the 100 ms render limit: a long limit keeps a host stall from failing a batch.
  const renderOptions = { ...install, surfaceId: "bench", revision: 1, timeoutMs: 5000 };
  const props = { params: {}, state: {}, context: {}, data: {}, actions: {} };
  const bundledPackage = value(pack(bundled, install));
  const batch = async (pkg: WidgetPackage, libraries: readonly WidgetPackage[] | undefined, runs: number) => {
    const start = process.cpuUsage();
    for (let i = 0; i < runs; i++) {
      const rendered = await runner.render(pkg, props, { ...renderOptions, ...(libraries ? { libraries } : {}) });
      assert(rendered.ok, JSON.stringify(rendered));
    }
    const used = process.cpuUsage(start);
    return (used.user + used.system) / 1000 / runs;
  };
  // Blocks in A-B-B-A order: each block times BLOCK batches of one package back to back, so a package's call
  // sites stay monomorphic (alternating the two every batch inflates the linked side by a few percent), and the
  // reversed second half cancels drift within the process. A side's figure is the median of its batches, which
  // keeps the garbage-collection cost that the minimum hides.
  const BLOCK = 20;
  const times = { bundled: [] as number[], linked: [] as number[] };
  for (const side of ["bundled", "linked", "linked", "bundled"] as const) {
    const [pkg, libraries] = side === "bundled" ? [bundledPackage, undefined] : [linked, libs];
    await batch(pkg, libraries, 20);
    for (let i = 0; i < BLOCK; i++) times[side].push(await batch(pkg, libraries, 100));
  }
  console.log(JSON.stringify({ bundledMs: median(times.bundled), linkedMs: median(times.linked) }));
}
