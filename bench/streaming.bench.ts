import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { chromium } from "playwright";
import { toElements } from "../scripts/fixtures/elements.ts";
import { browserHost } from "../src/__tests__/fixtures/conformance-browser-host.ts";
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import { countNodes } from "../src/__tests__/fixtures/render-workloads.ts";
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { applyPatch, compileValidator, diffTrees, type UiTree } from "../src/index.ts";
import { renderElements } from "../src/sdk/elements.ts";
import { render } from "../src/sdk/render.ts";

const patches = Bun.argv.includes("--patches");
const initialLoad = loadavg();
const REVISIONS = 100;
const INTERVAL_MS = 100;
const MAX_GZIP_BYTES = 1024;
const MAX_VALIDATION_AND_COMMIT_MS = 8;

const fixture = proofWidgets.find((entry) => entry.name === "agent-home");
assert(fixture, "agent-home fixture missing");
const scenario = fixture.scenarios.find((entry) => entry.name === "ready");
assert(scenario, "agent-home/ready scenario missing");
const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
const tasks = scenario.data.groups.find((group) => group.id === "tasks");
assert(tasks, "agent-home tasks group missing");
const sourceRows = tasks.pages[0]?.rows;
assert(sourceRows && sourceRows.length === 50, "agent-home must have 50 rows");

function revisionTree(index: number): UiTree {
  const data = structuredClone(scenario.data);
  const rows = data.groups.find((group) => group.id === "tasks")?.pages[0]?.rows;
  assert(rows, "revision rows missing");
  const row = rows[index % rows.length];
  assert(row, "revision row missing");
  row.rowStatus = index % 2 === 0 ? "overdue" : "done";
  const result = render(fixture.widget, { ...scenario, data }, { validator, surfaceId: "stream", revision: index });
  assert(result.ok, `revision ${index}: ${JSON.stringify(result.errors)}`);
  return result.value;
}

function changedValueBytes(previous: unknown, next: unknown): number {
  if (Object.is(previous, next)) return 0;
  if (next === null || typeof next !== "object") return Buffer.byteLength(JSON.stringify(next));
  let bytes = 0;
  if (Array.isArray(previous) && Array.isArray(next)) {
    for (let i = 0; i < Math.max(previous.length, next.length); i++) {
      bytes += changedValueBytes(previous[i], next[i]);
    }
    return bytes;
  }
  const before = (previous ?? {}) as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    bytes += changedValueBytes(before[key], after[key]);
  }
  return bytes;
}

const revisions = [];
const initialTree = patches ? revisionTree(0) : undefined;
let previous: UiTree | undefined = initialTree;
for (let index = 0; index < REVISIONS; index++) {
  const revision = patches ? index + 1 : index;
  const tree = revisionTree(revision);
  assert.equal(countNodes(tree.root), 679, `revision ${index}: node count`);
  const elements = toElements(tree.root);
  const result = renderElements(elements, { validator, surfaceId: "stream", revision });
  assert(result.ok, `revision ${index}: ${JSON.stringify(result.errors)}`);
  let payload: unknown = result.value;
  let diffMs = 0;
  if (patches) {
    assert(previous);
    const started = performance.now();
    const patch = diffTrees(previous, result.value);
    diffMs = performance.now() - started;
    assert(patch.ok, `diff ${revision}: ${JSON.stringify(patch)}`);
    const applied = applyPatch(previous, patch.value);
    assert(applied.ok, `apply ${revision}: ${JSON.stringify(applied)}`);
    assert.deepEqual(applied.value, result.value, `round trip ${revision}`);
    payload = patch.value;
  }
  const json = JSON.stringify(payload);
  revisions.push({
    json,
    diffMs,
    bytes: Buffer.byteLength(json),
    gzipBytes: Bun.gzipSync(json).byteLength,
    changedBytes: previous ? changedValueBytes(previous, tree) : 0,
  });
  previous = tree;
}

const server = await browserHost(new URL("./streaming-client.tsx", import.meta.url).pathname);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(server.url.href);
  await page.waitForFunction(() => !!window.streamTest);
  const outcome = await page.evaluate((payload) => window.streamTest.run(payload.revisions, payload.initial), {
    revisions: revisions.map((entry) => entry.json),
    initial: initialTree ? JSON.stringify(initialTree) : null,
  });
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(outcome.samples.length, REVISIONS);
  if (patches) assert.deepEqual(outcome.finalTree, previous, "browser reconstructed final tree");

  const median = (values: readonly number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const p95 = (values: readonly number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
  };
  const axis = (name: keyof (typeof outcome.samples)[number]) => outcome.samples.map((sample) => sample[name]);
  const gzip = revisions.map((entry) => entry.gzipBytes);
  const changed = (patches ? revisions : revisions.slice(1)).map((entry) => entry.changedBytes);
  const update = outcome.samples.map((sample) => sample.profilerMs);
  const validation = axis("validationMs");
  const commit = axis("commitMs");
  const bytes = revisions.map((entry) => entry.bytes);
  const achieved = ((REVISIONS - 1) / outcome.elapsedMs) * 1000;

  const lines = [
    patches
      ? "# Streaming patches: LF-17 transport measurement (CL-15)"
      : "# Streaming agent surface: element JSON → arrival validation → React commit",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Machine: ${platform()} ${release()}; ${cpus()[0]?.model}; ${cpus().length} logical CPUs`,
    `- Bun: ${Bun.version}; Playwright Chromium: ${browser.version()}`,
    `- Command: \`bun --conditions liveframe:source bench/streaming.bench.ts${patches ? " --patches" : ""}\``,
    `- Subject: agent-home, 679 nodes, 50 rows; ${REVISIONS} revisions at a ${1000 / INTERVAL_MS}/s target; one row's status changes per revision, ${patches ? "patches sent after a separately mounted revision-0 whole tree" : "whole trees sent"}.`,
    ...(patches
      ? [
          `- Load average at start: ${initialLoad.join(", ")}`,
          `- React: ${outcome.reactVersion}, development; Playwright: ${(await import("playwright/package.json")).default.version}; Chromium headless.`,
          "- Bootstrap is outside the 100 timed updates and byte summaries; updates are revisions 1–100. The original revision generator is unchanged (each row status overrides the ready fixture for that revision).",
          "- Host diff timing excludes rendering, serialization and round-trip assertions. Every patch round-trips exactly; browser final-tree equality and every arrival validation are asserted.",
          "- The historical LF-17 metric calls Profiler actualDuration minus validation ‘commit’; React documents actualDuration as render work, not DOM commit or paint. That metric is retained unchanged; flushSync wall and parse + apply + flushSync end-to-end spans are also reported, excluding network, decompression and pacing.",
          "- Bootstrap mount is excluded in patch mode; LF-17 whole-tree mode still includes mount as its first sample. Both use the development build and the same 100 ms pacing.",
        ]
      : []),
    `- Timings are browser-side, one sample per revision; Chromium runs React's development build, so Profiler overhead is included; ${patches ? "bootstrap mount is excluded" : "the first revision includes mount"}.`,
    "- Changed-value bytes sum changed leaf values only and assume no patch format.",
    `- Patch thresholds fixed before measuring: gzipped ${patches ? "patch" : "whole-tree"} update above ${MAX_GZIP_BYTES} bytes, or arrival validation plus React commit above ${MAX_VALIDATION_AND_COMMIT_MS} ms.`,
    "",
    "## Summary",
    "",
    "| Measure | median | p95 | max |",
    "|---|---:|---:|---:|",
    `| ${patches ? "Patch" : "Whole-tree"} JSON bytes | ${median(bytes)} | ${p95(bytes)} | ${Math.max(...bytes)} |`,
    `| Gzip bytes | ${median(gzip)} | ${p95(gzip)} | ${Math.max(...gzip)} |`,
    `| Changed-value bytes (patch floor, revisions ${patches ? 1 : 2}–${REVISIONS}) | ${median(changed)} | ${p95(changed)} | ${Math.max(...changed)} |`,
    ...(patches
      ? [
          `| Host diffTrees ms | ${median(revisions.map((entry) => entry.diffMs)).toFixed(3)} | ${p95(revisions.map((entry) => entry.diffMs)).toFixed(3)} | ${Math.max(...revisions.map((entry) => entry.diffMs)).toFixed(3)} |`,
          ...(["applyMs", "endToEndMs"] as const).map(
            (name) =>
              `| ${name === "applyMs" ? "Browser applyPatch ms" : "Browser end-to-end ms (parse + apply + flushSync)"} | ${median(axis(name)).toFixed(3)} | ${p95(axis(name)).toFixed(3)} | ${Math.max(...axis(name)).toFixed(3)} |`,
          ),
        ]
      : []),
    `| JSON parse ms | ${median(axis("parseMs")).toFixed(3)} | ${p95(axis("parseMs")).toFixed(3)} | ${Math.max(...axis("parseMs")).toFixed(3)} |`,
    `| Arrival validation ms | ${median(validation).toFixed(3)} | ${p95(validation).toFixed(3)} | ${Math.max(...validation).toFixed(3)} |`,
    `| React commit ms (Profiler, net of validation) | ${median(commit).toFixed(3)} | ${p95(commit).toFixed(3)} | ${Math.max(...commit).toFixed(3)} |`,
    `| Arrival validation + React commit ms | ${median(update).toFixed(3)} | ${p95(update).toFixed(3)} | ${Math.max(...update).toFixed(3)} |`,
    `| Wall time around flushSync ms | ${median(axis("wallMs")).toFixed(3)} | ${p95(axis("wallMs")).toFixed(3)} | ${Math.max(...axis("wallMs")).toFixed(3)} |`,
    "",
    `Achieved update rate: ${achieved.toFixed(2)}/s over ${outcome.elapsedMs.toFixed(0)} ms.`,
    "",
    `Verdict: gzip ${median(gzip) > MAX_GZIP_BYTES ? "exceeds" : "stays within"} ${MAX_GZIP_BYTES} bytes; arrival validation plus commit ${median(update) > MAX_VALIDATION_AND_COMMIT_MS ? "exceeds" : "stays within"} ${MAX_VALIDATION_AND_COMMIT_MS} ms.`,
    "",
    ...(patches
      ? [
          `Task 12: ${median(update) <= MAX_VALIDATION_AND_COMMIT_MS && median(gzip) <= MAX_GZIP_BYTES ? "n/a — measured; both medians pass" : "required; streaming thresholds are not both met"}. Commit-only median: ${median(commit).toFixed(3)} ms against ${MAX_VALIDATION_AND_COMMIT_MS} ms.`,
          "",
        ]
      : []),
    "## Per revision",
    "",
    `| # | JSON bytes | gzip bytes | changed bytes | parse ms | arrival validation ms | React commit ms | validation + commit ms |${patches ? " diff ms | apply ms | end-to-end ms |" : ""}`,
    `|---:|---:|---:|---:|---:|---:|---:|---:|${patches ? "---:|---:|---:|" : ""}`,
    ...revisions.map((entry, index) => {
      const sample = outcome.samples[index];
      assert(sample, `sample ${index} missing`);
      return `| ${index + 1} | ${entry.bytes} | ${entry.gzipBytes} | ${index === 0 && !patches ? "—" : entry.changedBytes} | ${sample.parseMs.toFixed(3)} | ${sample.validationMs.toFixed(3)} | ${sample.commitMs.toFixed(3)} | ${sample.profilerMs.toFixed(3)} |${patches ? ` ${entry.diffMs.toFixed(3)} | ${sample.applyMs.toFixed(3)} | ${sample.endToEndMs.toFixed(3)} |` : ""}`;
    }),
    "",
    `Load average at end: ${loadavg().join(", ")}`,
    "",
  ];
  const evidence = new URL(
    patches ? "../plans/evidence/021-streaming-patches.md" : "../plans/evidence/019-streaming-bench.md",
    import.meta.url,
  );
  await Bun.write(evidence, lines.join("\n"));
  console.log(lines.slice(0, 25).join("\n"));
  console.log(`Wrote ${evidence.pathname}`);
} finally {
  await browser.close();
  await server.stop(true);
}
