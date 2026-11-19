import { strict as assert } from "node:assert";
import { chromium, firefox, webkit } from "playwright";
import { proofSheets } from "../proof/css/sheets.ts";
import { designSystemCss } from "../src/css/index.ts";
import { browserHost } from "../src/__tests__/fixtures/conformance-browser-host.ts";
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import certified from "../src/__tests__/fixtures/proof/certified.design-system.json" with { type: "json" };
import type { Catalog, DesignSystem } from "../src/index.ts";
import { budget, metric } from "./metrics.ts";

// Design-system motion (plan 038 Task 3, design §2 Budget): a commit that removes 20 rows and moves 50 under one
// parent adds at most 2 ms in Chromium's production profile. The work the renderer defers to the next frame is
// recorded beside it. WebKit and Firefox are recorded, not gated. The streaming bench drives Chromium over CDP
// only, so motion has its own bench.
//   bun --conditions liveframe:source bench/motion.bench.ts [--production]
const production = Bun.argv.includes("--production");
const RUNS = 20;
const WARMUP = 5;
const MAX_ADDED_MS = 2;

const base = certified as DesignSystem;
const motion: DesignSystem = {
  ...base,
  id: "motion",
  recipes: {
    ...base.recipes,
    "text.default.root.rest": {
      ...base.recipes["text.default.root.rest"],
      transitionDuration: "motion.fast",
      motion: "fade-move",
    },
  },
};
const projected = designSystemCss(motion, { catalog: catalog as Catalog, registry: {} });
if (!projected.ok) throw new Error(JSON.stringify(projected.errors));
const server = await browserHost(
  new URL("./motion-client.tsx", import.meta.url).pathname,
  `${proofSheets}\n${projected.value}`,
  production,
);
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

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
      await page.waitForFunction(() => !!window.motionBench);
      assert.equal(await page.evaluate(() => window.motionBench.production), production, "bundle build mode");
      const measure = (system: string) =>
        page.evaluate(([system, runs, warmup]) => window.motionBench.measureMotion(system, runs, warmup), [
          system,
          RUNS,
          WARMUP,
        ] as const);
      // Alternate so drift on a busy host lands on both sides.
      const plain = { commitMs: [] as number[], frameMs: [] as number[] };
      const moving = { commitMs: [] as number[], frameMs: [] as number[] };
      for (let round = 0; round < 2; round++)
        for (const [system, into] of [
          ["certified", plain],
          ["motion", moving],
        ] as const) {
          const result = await measure(system);
          into.commitMs.push(...result.commitMs);
          into.frameMs.push(...result.frameMs);
        }
      assert.equal(errors.length, 0, errors.join("\n"));
      const commitAdded = median(moving.commitMs) - median(plain.commitMs);
      const frameAdded = median(moving.frameMs) - median(plain.frameMs);
      const totalAdded = commitAdded + frameAdded;
      metric(`motion.${name}.plainCommitMs`, median(plain.commitMs));
      metric(`motion.${name}.motionCommitMs`, median(moving.commitMs));
      metric(`motion.${name}.commitAddedMs`, commitAdded);
      metric(`motion.${name}.frameAddedMs`, frameAdded);
      metric(`motion.${name}.totalAddedMs`, totalAdded);
      console.log(
        `${name} (${production ? "production" : "development"}): commit ${median(plain.commitMs).toFixed(3)} → ${median(moving.commitMs).toFixed(3)} ms (added ${commitAdded.toFixed(3)}); next frame ${median(plain.frameMs).toFixed(3)} → ${median(moving.frameMs).toFixed(3)} ms (added ${frameAdded.toFixed(3)}); total added ${totalAdded.toFixed(3)} ms`,
      );
      if (name === "chromium" && production)
        budget(
          commitAdded <= MAX_ADDED_MS,
          `motion adds ${commitAdded.toFixed(3)} ms to the commit (budget ${MAX_ADDED_MS} ms)`,
        );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.stop(true);
}
