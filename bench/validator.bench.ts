import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { validatorCatalog, validatorFixtures } from "../src/__tests__/fixtures/validator.ts";
import { checkValue, type UiNode } from "../src/index.ts";
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
if (failed) process.exitCode = 1;
