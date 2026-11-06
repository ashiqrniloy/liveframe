import { arr, int, obj, str } from "@arnilo/liveframe";
import { compileExpression, type Frame } from "../src/template/expr.ts";
import { rootScope } from "../src/template/scope.ts";
import { metric } from "./metrics.ts";

// Evaluation cost per expression node (plan 028 Task 2). The target is 50 ns per node on the reference
// machine: recorded, not gated. One step is one node evaluated, so `steps spent` is the node count.
const row = obj({ id: str({ maxLength: 32 }), n: int(), title: str({ maxLength: 64 }) });
const scope = rootScope({ data: obj({ rows: arr(row, { maxItems: 1000 }) }), params: obj({ k: int() }) });
const expr = {
  $sum: {
    $map: {
      in: { $filter: { in: { $path: "data.rows" }, as: "r", where: { $gt: [{ $path: "r.n" }, 10] } } },
      as: "r",
      index: "i",
      value: {
        $cond: [
          { $gt: [{ $path: "i" }, 5] },
          {
            $add: [
              { $mul: [{ $path: "r.n" }, { $path: "params.k" }] },
              { $len: { $concat: [{ $path: "r.id" }, "-", { $path: "r.title" }] } },
            ],
          },
          { $sub: [{ $path: "i" }, 1] },
        ],
      },
    },
  },
};
const compiled = compileExpression(expr, scope);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `row-${i}`, n: i, title: `Title number ${i}` }));
const slots: unknown[] = [];
slots[scope.names.get("data")?.slot as number] = { rows };
slots[scope.names.get("params")?.slot as number] = { k: 3 };
const run = compiled.value;
const frame = (): Frame => ({ slots, steps: 100_000_000 });

for (let i = 0; i < 20; i++) run(frame());
const f = frame();
run(f);
const nodes = 100_000_000 - f.steps;
const rounds = 200;
const times: number[] = [];
for (let i = 0; i < rounds; i++) {
  const start = performance.now();
  run(frame());
  times.push(performance.now() - start);
}
const median = times.sort((a, b) => a - b)[rounds >> 1] as number;
const ns = (median * 1e6) / nodes;
metric("template.expr.nsPerNode", ns);
console.log(`template expression evaluation: ${ns.toFixed(1)} ns/node over ${nodes} nodes (target 50, recorded)`);
