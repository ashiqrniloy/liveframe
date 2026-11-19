import { strict as assert } from "node:assert";
import { chromium, firefox, webkit } from "playwright";
import { proofSheets } from "../proof/css/sheets.ts";
import { browserHost } from "../src/__tests__/fixtures/conformance-browser-host.ts";
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { compileValidator, type UiTree } from "../src/index.ts";
import { render } from "../src/sdk/render.ts";
import { budget, metric } from "./metrics.ts";
import { bootstrap, median, pairedRatios, verdict } from "./stats.ts";

// The DOM adapter (plan 038 Task 5, design §4 Budget): mounting and patching the agent-home tree with `/dom` costs
// at most `/react`'s median for the same structure, in Chromium's production profile. Both adapters draw the
// parity fixture's generic elements, so the difference is the adapter's. Validation and the shared core are most of
// a patch (about 1.3 of 1.6 ms), so the two medians sit within noise of each other: the gate takes the paired
// /dom ÷ /react ratio per run and fails only when its 95% bootstrap interval lies wholly above 1. WebKit and
// Firefox are recorded.
//   bun --conditions liveframe:source bench/dom.bench.ts [--production]
const production = Bun.argv.includes("--production");
const MOUNT_RUNS = 12;
const REVISIONS = 50;

const fixture = proofWidgets.find((entry) => entry.name === "agent-home");
assert(fixture, "agent-home fixture missing");
const scenario = fixture.scenarios.find((entry) => entry.name === "ready");
assert(scenario, "agent-home/ready scenario missing");
const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });

/** Revision `index`: one row's status changes, as in the streaming bench. */
function revisionTree(index: number): UiTree {
  const data = structuredClone(scenario.data);
  const rows = data.groups.find((group) => group.id === "tasks")?.pages[0]?.rows;
  assert(rows, "revision rows missing");
  const row = rows[index % rows.length];
  assert(row, "revision row missing");
  row.rowStatus = index % 2 === 0 ? "overdue" : "done";
  const result = render(fixture.widget, { ...scenario, data }, { validator, surfaceId: "dom", revision: index });
  assert(result.ok, `revision ${index}: ${JSON.stringify(result.errors)}`);
  return result.value;
}

const treesJson = JSON.stringify(Array.from({ length: REVISIONS + 1 }, (_, i) => revisionTree(i)));
const manifestJson = JSON.stringify(fixture.manifest);
const server = await browserHost(new URL("./dom-client.tsx", import.meta.url).pathname, proofSheets, production);

try {
  for (const [name, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
    ["firefox", firefox],
  ] as const) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(server.url.href);
      await page.waitForFunction(() => !!window.domBench);
      assert.equal(await page.evaluate(() => window.domBench.production), production, "bundle build mode");
      const samples = {
        react: { mountMs: [] as number[], patchMs: [] as number[] },
        dom: { mountMs: [] as number[], patchMs: [] as number[] },
      };
      // A warm-up round each, then alternating rounds so drift on a busy host lands on both sides.
      for (let round = 0; round < 3; round++)
        for (const adapter of ["react", "dom"] as const) {
          const result = await page.evaluate(
            ([adapter, manifest, trees, runs]) => window.domBench.measure(adapter, manifest, trees, runs),
            [adapter, manifestJson, treesJson, MOUNT_RUNS] as const,
          );
          if (round === 0) continue;
          samples[adapter].mountMs.push(...result.mountMs);
          samples[adapter].patchMs.push(...result.patchMs);
        }
      assert.equal(errors.length, 0, errors.join("\n"));
      const line: string[] = [];
      for (const measure of ["mountMs", "patchMs"] as const) {
        const react = median(samples.react[measure]);
        const dom = median(samples.dom[measure]);
        const ratio = bootstrap(pairedRatios(samples.react[measure], samples.dom[measure]));
        metric(`dom.${name}.react.${measure}`, react);
        metric(`dom.${name}.dom.${measure}`, dom);
        metric(`dom.${name}.ratio.${measure}`, ratio.median);
        line.push(
          `${measure} react ${react.toFixed(3)} → dom ${dom.toFixed(3)} (×${ratio.median.toFixed(2)}, 95% ${ratio.low.toFixed(2)}–${ratio.high.toFixed(2)})`,
        );
        if (name === "chromium" && production)
          budget(
            verdict(ratio, 1) !== "fail",
            `/dom ${measure} is slower than /react's: ×${ratio.median.toFixed(2)} (95% ${ratio.low.toFixed(2)}–${ratio.high.toFixed(2)})`,
          );
      }
      console.log(`${name} (${production ? "production" : "development"}), agent-home: ${line.join("; ")}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.stop(true);
}
