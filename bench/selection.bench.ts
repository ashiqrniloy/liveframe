import { strict as assert } from "node:assert";
import { budget, metric } from "./metrics.ts";

// Reuse the production proof measurement, including both design systems and its browser assertions.
const child = Bun.spawn({
  cmd: [
    "bun",
    "test",
    "--conditions",
    "liveframe:source",
    "proof/tests/renderer-browser.test.tsx",
    "--test-name-pattern",
    "^(selection_rerender_cost_is_recorded_in_production|focus_continuity_selection_cost_is_recorded_in_production|live_filter_50_rows_no_round_trip)$",
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

const focus = [...(out + err).matchAll(/679-node focus continuity (false|true): median ([\d.]+) ms/g)];
assert.equal(focus.length, 2, out + err);
for (const [, mode, median] of focus) {
  assert(Number.isFinite(Number(median)) && Number(median) > 0);
  metric(`focusContinuity.${mode}.wallMs`, Number(median));
}

const liveFilterMatch = (out + err).match(/keystroke flipping 9 of 50 rows median ([\d.]+) ms/);
assert(liveFilterMatch?.[1], out + err);
const liveFilterMedianMs = Number(liveFilterMatch[1]);
assert(Number.isFinite(liveFilterMedianMs) && liveFilterMedianMs > 0);
metric("liveFilter.medianMs", liveFilterMedianMs);
budget(
  liveFilterMedianMs <= 4,
  `live_filter_50_rows_no_round_trip median ${liveFilterMedianMs.toFixed(3)} ms exceeds 4 ms`,
);

const emptyRowMatch = (out + err).match(/keystroke flipping 9 of 50 rows beside an empty row median ([\d.]+) ms/);
assert(emptyRowMatch?.[1], out + err);
const emptyRowMedianMs = Number(emptyRowMatch[1]);
assert(Number.isFinite(emptyRowMedianMs) && emptyRowMedianMs > 0);
metric("liveFilter.emptyRow.medianMs", emptyRowMedianMs);
budget(
  emptyRowMedianMs <= 4,
  `live_filter_50_rows_no_round_trip with an empty row median ${emptyRowMedianMs.toFixed(3)} ms exceeds 4 ms`,
);
