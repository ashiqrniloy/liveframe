// Regenerate: timeout 120s bun --conditions liveframe:source plans/evidence/026-render-ownership.ts
// Materializes the baseline as a sibling module and removes it afterwards.
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import catalog from "../../src/__tests__/fixtures/proof/catalog.json";
import capabilities from "../../src/__tests__/fixtures/widgets/capabilities.json";
import { proofWidgets } from "../../src/__tests__/fixtures/widgets/index.ts";
import { compileValidator } from "../../src/index.ts";
import { freezeCopy } from "../../src/internal.ts";
import type { render as Render } from "../../src/sdk/render.ts";
import { render as head } from "../../src/sdk/render.ts";

const target = new URL("../../src/sdk/render-t3-baseline.ts", import.meta.url);
const source = Bun.spawnSync(["git", "show", "v0.2.3:src/sdk/render.ts"]);
assert.equal(source.exitCode, 0);
await Bun.write(target, source.stdout);
const base = (await import(target.href)).render as typeof Render;
try {
  const fixture = proofWidgets[0]!;
  const inputs = freezeCopy(fixture.scenarios[0]!);
  const options = {
    validator: compileValidator({ catalog, capabilities, manifest: fixture.manifest }),
    surfaceId: "proof",
    revision: 0,
  };
  const a = () => base(fixture.widget, inputs, options);
  const b = () => head(fixture.widget, inputs, options);
  assert.deepEqual(a(), b());
  const median = (v: number[]) => v.sort((a, b) => a - b)[v.length >> 1]!;
  const time = (fn: () => unknown) => {
    for (let i = 0; i < 50; i++) fn();
    const start = performance.now();
    for (let i = 0; i < 300; i++) fn();
    return (performance.now() - start) / 300;
  };
  const ratios: number[] = [];
  const aa: number[] = [];
  const bb: number[] = [];
  for (let i = 0; i < 21; i++) {
    let x: number, y: number;
    if (i % 2) {
      y = time(b);
      x = time(a);
    } else {
      x = time(a);
      y = time(b);
    }
    aa.push(x);
    bb.push(y);
    ratios.push(y / x);
  }
  console.log({ baselineMs: median(aa), headMs: median(bb), pairedRatio: median(ratios) });
} finally {
  rmSync(target);
}
