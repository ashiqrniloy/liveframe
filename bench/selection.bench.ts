import { strict as assert } from "node:assert";
import { metric } from "./metrics.ts";

// Reuse the production proof measurement, including both design systems and its browser assertions.
const child = Bun.spawn({
  cmd: [
    "bun",
    "test",
    "--conditions",
    "liveframe:source",
    "proof/tests/renderer-browser.test.tsx",
    "--test-name-pattern",
    "^selection_rerender_cost_is_recorded_in_production$",
  ],
  stdout: "pipe",
  stderr: "pipe",
  timeout: 120_000,
});
const [out, err] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
assert.equal(await child.exited, 0, out + err);
const matches = [...(out + err).matchAll(/679-node selection (\w+) production: (\[.*?\]) ms/g)];
assert.equal(matches.length, 2, out + err);
for (const [, system, json] of matches) {
  const samples: { react: number; validation: number; wall: number }[] = JSON.parse(json as string);
  assert.equal(samples.length, 10);
  for (const field of ["react", "validation", "wall"] as const) {
    const values = samples.map((sample) => sample[field]).toSorted((a, b) => a - b);
    assert(values.every((value) => Number.isFinite(value) && value > 0));
    metric(`${system}.${field}Ms`, ((values[4] as number) + (values[5] as number)) / 2);
  }
}
