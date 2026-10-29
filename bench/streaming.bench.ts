import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { chromium } from "playwright";
import { compileValidator, type UiTree } from "../src/index.ts";
import { countNodes } from "../src/__tests__/fixtures/render-workloads.ts";
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { browserHost } from "../src/__tests__/fixtures/conformance-browser-host.ts";
import { renderElements } from "../src/sdk/elements.ts";
import { toElements } from "../scripts/fixtures/elements.ts";
import { render } from "../src/sdk/render.ts";

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
let previous: UiTree | undefined;
for (let index = 0; index < REVISIONS; index++) {
  const tree = revisionTree(index);
  assert.equal(countNodes(tree.root), 679, `revision ${index}: node count`);
  const elements = toElements(tree.root);
  const result = renderElements(elements, { validator, surfaceId: "stream", revision: index });
  assert(result.ok, `revision ${index}: ${JSON.stringify(result.errors)}`);
  const json = JSON.stringify(result.value);
  revisions.push({
    json,
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
  const outcome = await page.evaluate(
    (payload) => window.streamTest.run(payload),
    revisions.map((entry) => entry.json),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(outcome.samples.length, REVISIONS);

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
  const changed = revisions.slice(1).map((entry) => entry.changedBytes);
  const update = outcome.samples.map((sample) => sample.profilerMs);
  const validation = axis("validationMs");
  const commit = axis("commitMs");
  const bytes = revisions.map((entry) => entry.bytes);
  const achieved = ((REVISIONS - 1) / outcome.elapsedMs) * 1000;

  const lines = [
    "# Streaming agent surface: element JSON → arrival validation → React commit",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Machine: ${platform()} ${release()}; ${cpus()[0]?.model}; ${cpus().length} logical CPUs`,
    `- Bun: ${Bun.version}; Playwright Chromium: ${browser.version()}`,
    "- Command: `bun --conditions liveframe:source bench/streaming.bench.ts`",
    `- Subject: agent-home, 679 nodes, 50 rows; ${REVISIONS} revisions at a ${1000 / INTERVAL_MS}/s target; one row's status changes per revision, whole trees sent.`,
    "- Timings are browser-side, one sample per revision; Chromium runs React's development build, so Profiler overhead is included; the first revision includes mount.",
    "- Changed-value bytes sum changed leaf values only and assume no patch format.",
    `- Patch thresholds fixed before measuring: gzipped whole-tree update above ${MAX_GZIP_BYTES} bytes, or arrival validation plus React commit above ${MAX_VALIDATION_AND_COMMIT_MS} ms.`,
    "",
    "## Summary",
    "",
    "| Measure | median | p95 | max |",
    "|---|---:|---:|---:|",
    `| Whole-tree JSON bytes | ${median(bytes)} | ${p95(bytes)} | ${Math.max(...bytes)} |`,
    `| Gzip bytes | ${median(gzip)} | ${p95(gzip)} | ${Math.max(...gzip)} |`,
    `| Changed-value bytes (patch floor, revisions 2–${REVISIONS}) | ${median(changed)} | ${p95(changed)} | ${Math.max(...changed)} |`,
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
    "## Per revision",
    "",
    "| # | JSON bytes | gzip bytes | changed bytes | parse ms | arrival validation ms | React commit ms | validation + commit ms |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...revisions.map((entry, index) => {
      const sample = outcome.samples[index];
      assert(sample, `sample ${index} missing`);
      return `| ${index + 1} | ${entry.bytes} | ${entry.gzipBytes} | ${index === 0 ? "—" : entry.changedBytes} | ${sample.parseMs.toFixed(3)} | ${sample.validationMs.toFixed(3)} | ${sample.commitMs.toFixed(3)} | ${sample.profilerMs.toFixed(3)} |`;
    }),
    "",
    `Load average at end: ${loadavg().join(", ")}`,
    "",
  ];
  const evidence = new URL("../plans/evidence/019-streaming-bench.md", import.meta.url);
  await Bun.write(evidence, lines.join("\n"));
  console.log(lines.slice(0, 25).join("\n"));
  console.log(`Wrote ${evidence.pathname}`);
} finally {
  await browser.close();
  await server.stop(true);
}
