import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { validatorCatalog, validatorFixtures } from "../src/__tests__/fixtures/validator.ts";
import { applyPatch, arr, diffTrees, checkValue, obj, str, type TreePatch, type UiNode, union } from "../src/index.ts";
import { compileSchema, type SchemaSink } from "../src/validate/schema.ts";

const fixtures = await validatorFixtures();
const schemas = new Map(validatorCatalog.definitions.map((definition) => [definition.kind, definition.props]));
const sink: SchemaSink = { errors: [], maxErrors: 20 };
const interpreted = new Map(
  [...schemas].map(([kind, schema]) => [kind, (value: unknown) => checkValue(schema, value).ok]),
);
const compiled = new Map(
  [...schemas].map(([kind, schema]) => {
    const check = compileSchema(schema);
    return [kind, (value: unknown) => check(value, "", sink)];
  }),
);

// Deliberately props-only: the compiled validator does all of §10, this baseline only interprets schemas.
function props(node: UiNode, checks: ReadonlyMap<string, (value: unknown) => boolean>): boolean {
  const check = checks.get(node.kind);
  if (!check?.(node.props)) return false;
  for (const child of node.children ?? []) if (!props(child, checks)) return false;
  return true;
}

function measure(run: () => boolean): number {
  for (let i = 0; i < 200; i++) assert(run(), "Validation failed during warm-up");
  const start = performance.now();
  for (let i = 0; i < 1_000; i++) assert(run(), "Validation failed during timing");
  return (performance.now() - start) / 1_000;
}

console.log(`Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; ${cpus().length} logical CPUs`);
console.log(`Load average (1/5/15 min): ${loadavg().join(", ")}; 200 warm-ups, 1,000 runs per implementation`);
console.log("Generic baseline: checkValue on props only (includes its schema validation); compile/load excluded.");
let failed = false;
for (const { name, nodes, tree, validateTree } of fixtures) {
  for (const checks of [interpreted, compiled]) {
    assert(props(tree.root, checks), `${name}: props checker rejected valid fixture`);
    assert(!props({ ...tree.root, props: { ...tree.root.props, undeclaredBenchmarkProp: true } }, checks));
    assert(!props({ ...tree.root, kind: "unknown-benchmark-kind" }, checks));
    sink.errors.length = 0;
  }
  const compiledMs = measure(() => validateTree(tree).ok);
  const genericMs = measure(() => props(tree.root, interpreted));
  const compiledPropsMs = measure(() => props(tree.root, compiled));
  const perNode = (compiledMs * 1_000) / nodes;
  const speedup = genericMs / compiledMs;
  const propsSpeedup = genericMs / compiledPropsMs;
  console.log(
    `${name}: ${nodes} nodes; compiled ${compiledMs.toFixed(4)} ms, ${perNode.toFixed(3)} µs/node; generic ${genericMs.toFixed(4)} ms, ${((genericMs * 1_000) / nodes).toFixed(3)} µs/node; ${speedup.toFixed(2)}×`,
  );
  console.log(
    `  Equal-work props check: compiled ${compiledPropsMs.toFixed(4)} ms; ${propsSpeedup.toFixed(2)}× over checkValue`,
  );
  if (perNode > 1.5 || (name === "agent-home" && propsSpeedup < 2)) {
    console.error(`${name}: failed ≤ 1.5 µs/node or agent-home equal-work props ≥ 2× gate`);
    failed = true;
  }
}
console.log(`Load average at end: ${loadavg().join(", ")}`);
const feedSchema = arr(
  union("kind", {
    task: obj({ title: str({ maxLength: 200 }) }),
    alert: obj({ level: str({ maxLength: 8, enum: ["info", "error"] }) }),
  }),
  { maxItems: 500 },
);
const feed = Array.from({ length: 500 }, (_, i) =>
  i % 2 ? { kind: "task", title: "Task" } : { kind: "alert", level: "info" },
);
const checkFeed = compileSchema(feedSchema);
assert(!checkFeed([{ kind: "unknown" }], "", sink));
sink.errors.length = 0;
const feedMs = measure(() => checkFeed(feed, "", sink));
console.log(
  `mixed-feed: 500 elements; compiled ${feedMs.toFixed(4)} ms, ${((feedMs * 1000) / 500).toFixed(3)} µs/element`,
);
if (failed) process.exitCode = 1;

// LF-17's 679-node, 50-row subject: time application and host diffing separately from validation.
const subject = fixtures.find((fixture) => fixture.name === "agent-home");
assert(subject && subject.nodes === 679);
const pending = [subject.tree.root];
const statuses: UiNode[] = [];
while (pending.length) {
  const node = pending.pop();
  assert(node);
  if (node.props.text === "overdue") statuses.push(node);
  pending.push(...(node.children ?? []));
}
assert.equal(statuses.length, 50, "LF-17 must have 50 row statuses");
const samples: number[] = [];
const diffSamples: number[] = [];
let served = subject.tree;
for (let i = 0; i < 1200; i++) {
  const node = statuses[i % statuses.length];
  assert(node);
  const { children: _children, ...own } = node;
  const patch: TreePatch = {
    format: "liveframe/tree-patch/1",
    catalogId: served.catalogId,
    surfaceId: served.surfaceId,
    base: served.revision,
    revision: served.revision + 1,
    ops: [
      { op: "set", ...own, props: { ...node.props, text: Math.floor(i / statuses.length) % 2 ? "overdue" : "done" } },
    ],
  };
  const start = performance.now();
  const result = applyPatch(served, patch);
  const elapsed = performance.now() - start;
  assert(result.ok);
  assert.equal(result.value.revision, patch.revision);
  assert(subject.validateTree(result.value).ok);
  // Host renders are fresh trees; do not benchmark against application's shared nodes.
  const rendered = JSON.parse(JSON.stringify(result.value));
  const diffStart = performance.now();
  const diff = diffTrees(served, rendered);
  const diffElapsed = performance.now() - diffStart;
  assert(diff.ok);
  assert.deepEqual(diff.value, patch);
  served = result.value;
  if (i >= 200) {
    samples.push(elapsed);
    diffSamples.push(diffElapsed);
  }
}
samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];
assert(median !== undefined);
console.log(
  `applyPatch: 679 nodes, 50 rows, one row status per revision; 200 warm-ups, 1000 samples; median ${median.toFixed(4)} ms (<= 0.5 ms)`,
);
assert(median <= 0.5, "applyPatch exceeded 0.5 ms median");

diffSamples.sort((a, b) => a - b);
const diffMedian = diffSamples[Math.floor(diffSamples.length / 2)];
assert(diffMedian !== undefined);
console.log(
  `diffTrees: 679 nodes, 50 rows, one row status per revision; 200 warm-ups, 1000 samples; median ${diffMedian.toFixed(4)} ms (<= 1.5 ms)`,
);
assert(diffMedian <= 1.5, "diffTrees exceeded 1.5 ms median");
