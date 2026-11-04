/** Compare the installed 0.2.2 archive with the checkout's built packer; see 025-acceptance.md. */
import assert from "node:assert/strict";
import { loadavg } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { drafts, packageOptions } from "../../src/__tests__/fixtures/widgets/drafts.ts";

assert(Bun.argv[2], "Pass the installed @arnilo/liveframe@0.2.2 package directory");
const base = await import(pathToFileURL(resolve(Bun.argv[2], "dist/pack/index.js")).href);
const head = await import(new URL("../../dist/pack/index.js", import.meta.url).href);
assert.equal(drafts.length, 5);
function packAll(packer: typeof base) {
  return drafts.map((draft) => {
    const result = packer.pack(draft, packageOptions);
    assert(result.ok, JSON.stringify(result.errors));
    return { code: result.value.code, hash: result.value.hash };
  });
}
assert.deepEqual(packAll(head), packAll(base));
for (let i = 0; i < 5; i++) {
  packAll(base);
  packAll(head);
}
const loadBefore = loadavg();
const before: number[] = [];
const after: number[] = [];
for (let i = 0; i < 20; i++) {
  for (const [packer, samples] of [
    [base, before],
    [head, after],
  ] as const) {
    const start = performance.now();
    packAll(packer);
    samples.push(performance.now() - start);
  }
}
const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};
const ratio = median(after) / median(before);
console.log(
  JSON.stringify(
    {
      loadBefore,
      loadAfter: loadavg(),
      baseMs: median(before),
      headMs: median(after),
      ratio,
      pairedRatio: median(after.map((time, i) => time / (before[i] as number))),
      samples: 20,
      widgets: drafts.length,
      identicalCodeAndHashes: true,
      before,
      after,
    },
    null,
    2,
  ),
);
assert(ratio <= 1.05, `pack() regressed: ${ratio}`);
