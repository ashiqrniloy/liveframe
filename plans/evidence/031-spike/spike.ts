// Plan 031 Task 1 spike: QuickJS (quickjs-emscripten) as the isolated runner's engine.
// Run from the repository root: `bun plans/evidence/031-spike/spike.ts`. Not shipped.
// It renders the agent-home package in a QuickJS runtime that serves only the runner-kit bundle and the linked
// package, compares the tree with render(), times cold/warm cost against the reference runners, and runs
// the hostile probes the Task 3 isolation cases will need.
import { readFileSync } from "node:fs";
import {
  newQuickJSWASMModule,
  type QuickJSWASMModule,
  RELEASE_SYNC,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "../../../src/index.ts";
import { packageHash } from "../../../src/pack/hash.ts";
import { pack, type WidgetPackage } from "../../../src/pack/index.ts";
import { inProcessRunner } from "../../../src/preview/index.ts";
import { templateRunner } from "../../../src/preview/template.ts";
import { workerRunner } from "../../../src/preview/worker/index.ts";
import { linkPackage } from "../../../src/runner-kit/index.ts";
import catalogDoc from "../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "../../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../../src/__tests__/fixtures/widgets/index.ts";
import { agentHomeTemplate } from "../../../src/__tests__/fixtures/templates/agent-home.ts";

import { render } from "../../../src/sdk/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1] as number;
const ms = (n: number) => `${n.toFixed(3)} ms`;

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities, surfaceId: "spike", revision: 1 };
const fixture = proofWidgets[0];
const draft = drafts[0];
if (!fixture || !draft) throw new Error("agent-home fixture missing");
const pkg = value(pack(draft, options));
const scenario = fixture.scenarios[0];
if (!scenario) throw new Error("scenario missing");
const kitText = readFileSync(new URL("../../../dist/runner-kit.bundle.js", import.meta.url), "utf8");

// ---------------------------------------------------------------- the sandbox render (what Task 4 productises)
type Limits = { memoryBytes: number; stackBytes: number; timeoutMs: number };
const defaults: Limits = { memoryBytes: 32 << 20, stackBytes: 256 << 10, timeoutMs: 1000 };

const entrySource = `import { renderModule } from "liveframe:kit";
import widget from "liveframe:pkg";
const q = JSON.parse(globalThis.__req);
globalThis.__out = JSON.stringify(renderModule(widget, q.inputs, q.options));`;

function linked(code: string): string {
  return value(linkPackage(code, () => "liveframe:kit"));
}

type Outcome = { kind: "ok"; json: string } | { kind: "error"; message: string; name?: string };

function runSandbox(quickjs: QuickJSWASMModule, code: string, request: string, limits: Limits): Outcome {
  const runtime = quickjs.newRuntime();
  try {
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + limits.timeoutMs));
    const sources: Record<string, string> = { "liveframe:kit": kitText, "liveframe:pkg": linked(code) };
    runtime.setModuleLoader((name) => sources[name] ?? { error: new Error(`module not found`) });
    const context = runtime.newContext();
    try {
      const req = context.newString(request);
      context.setProp(context.global, "__req", req);
      req.dispose();
      const result = context.evalCode(entrySource, "entry.js", { type: "module" });
      if (result.error) {
        const err = context.dump(result.error);
        result.error.dispose();
        return { kind: "error", message: String(err?.message ?? err), name: err?.name };
      }
      result.value.dispose();
      const jobs = runtime.executePendingJobs();
      if (jobs.error) {
        const err = context.dump(jobs.error);
        jobs.error.dispose();
        return { kind: "error", message: String(err?.message ?? err), name: err?.name };
      }
      const out = context.getProp(context.global, "__out");
      if (context.typeof(out) !== "string") {
        out.dispose();
        return { kind: "error", message: "no result: module evaluation did not settle" };
      }
      const json = context.getString(out);
      out.dispose();
      return { kind: "ok", json };
    } finally {
      context.dispose();
    }
  } finally {
    runtime.dispose();
  }
}

const request = JSON.stringify({
  inputs: scenario,
  options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "spike", revision: 1 },
});
console.log(`request ${(request.length / 1024).toFixed(1)} KiB; kit bundle ${(kitText.length / 1024).toFixed(1)} KiB`);

const wasmStart = performance.now();
const quickjs = await newQuickJSWASMModule(RELEASE_SYNC);
const wasmMs = performance.now() - wasmStart;
const only = process.env.PROBE;
if (!only) {
  // ---------------------------------------------------------------- cold start
  let t = performance.now();
  const first = runSandbox(quickjs, pkg.code as string, request, defaults);
  const firstMs = performance.now() - t;
  console.log(`cold: wasm module ${ms(wasmMs)}; first render (fresh runtime, kit load) ${ms(firstMs)}`);
  if (first.kind !== "ok") throw new Error(`first render failed: ${first.message}`);

  // ---------------------------------------------------------------- equality with render()
  const validator = compileValidator({ ...options, manifest: pkg.manifest });
  let compared = 0;
  let keyOrderDiffers = 0;
  const table: string[] = [];
  for (const fx of proofWidgets) {
    const index = proofWidgets.indexOf(fx);
    const d = drafts[index];
    if (!d) continue;
    const p = value(pack(d, options));
    const v = compileValidator({ ...options, manifest: p.manifest });
    for (const sc of fx.scenarios) {
      const expected = render(fx.widget, sc, { ...options, validator: v });
      const got = runSandbox(
        quickjs,
        p.code as string,
        JSON.stringify({
          inputs: sc,
          options: { catalog, capabilities, manifest: p.manifest, surfaceId: "spike", revision: 1 },
        }),
        defaults,
      );
      if (got.kind !== "ok") throw new Error(`${fx.name}/${sc.name}: ${got.message}`);
      const a = JSON.parse(got.json);
      const b = JSON.parse(JSON.stringify(expected));
      if (!Bun.deepEquals(a, b, true)) {
        await Bun.write("/tmp/claude-1000/spike-a.json", JSON.stringify(a, null, 1));
        await Bun.write("/tmp/claude-1000/spike-b.json", JSON.stringify(b, null, 1));
        throw new Error(`${fx.name}/${sc.name}: tree differs from render()`);
      }
      if (JSON.stringify(a) !== JSON.stringify(b)) keyOrderDiffers++;
      // per-scenario cost: median of 7 fresh sandbox renders vs 7 in-process renders
      const req = JSON.stringify({
        inputs: sc,
        options: { catalog, capabilities, manifest: p.manifest, surfaceId: "spike", revision: 1 },
      });
      const qjsMs = median(
        Array.from({ length: 7 }, () => {
          const s0 = performance.now();
          runSandbox(quickjs, p.code as string, req, defaults);
          return performance.now() - s0;
        }),
      );
      const hostMs = median(
        Array.from({ length: 7 }, () => {
          const s0 = performance.now();
          render(fx.widget, sc, { ...options, validator: v });
          return performance.now() - s0;
        }),
      );
      const count = (n: any): number => 1 + (n.children ?? []).reduce((x: number, c: any) => x + count(c), 0);
      const nodes = count(a.value.root);
      table.push(
        `${fx.name}/${sc.name}`.padEnd(30) +
          `${String(nodes).padStart(5)} nodes  quickjs(fresh) ${qjsMs.toFixed(1).padStart(7)} ms  render() ${hostMs.toFixed(2).padStart(6)} ms  result ${(got.json.length / 1024).toFixed(0).padStart(4)} KiB`,
      );
      compared++;
    }
  }
  console.log(table.join("\n"));
  console.log(`deep-equal to render(): ${compared} proof scenarios; key order differs in ${keyOrderDiffers}`);
  void validator;

  // ---------------------------------------------------------------- per-render cost
  function time(fn: () => void, n: number, warm = 10): number {
    for (let i = 0; i < warm; i++) fn();
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = performance.now();
      fn();
      xs.push(performance.now() - s);
    }
    return median(xs);
  }
  const fresh = time(() => runSandbox(quickjs, pkg.code as string, request, defaults), 60);
  console.log(`quickjs reuse:none  (fresh runtime + kit load + render, dispose): median ${ms(fresh)}`);

  // reuse: one runtime/context per package, kit already evaluated; only the entry is re-run.
  function makeReused(limits: Limits) {
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(limits.memoryBytes);
    runtime.setMaxStackSize(limits.stackBytes);
    const sources: Record<string, string> = { "liveframe:kit": kitText, "liveframe:pkg": linked(pkg.code as string) };
    runtime.setModuleLoader((name) => sources[name] ?? { error: new Error("module not found") });
    const context = runtime.newContext();
    return {
      run(req: string): string {
        runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + limits.timeoutMs));
        const s = context.newString(req);
        context.setProp(context.global, "__req", s);
        s.dispose();
        const result = context.unwrapResult(context.evalCode(entrySource, "entry.js", { type: "module" }));
        result.dispose();
        const out = context.getProp(context.global, "__out");
        const json = context.getString(out);
        out.dispose();
        return json;
      },
      dispose() {
        context.dispose();
        runtime.dispose();
      },
    };
  }
  const reused = makeReused(defaults);
  const reuse = time(() => reused.run(request), 200, 20);
  console.log(`quickjs reuse:package (warm runtime, entry re-run only): median ${ms(reuse)}`);
  const usage = reused.run(request).length;
  console.log(`result JSON ${(usage / 1024).toFixed(1)} KiB`);
  reused.dispose();

  // kit load alone (compile + evaluate the 139 KiB bundle), and request parse alone
  const kitOnly = time(() => {
    const rt = quickjs.newRuntime();
    rt.setModuleLoader((n) => (n === "liveframe:kit" ? kitText : { error: new Error("x") }));
    const cx = rt.newContext();
    cx.unwrapResult(
      cx.evalCode(`import * as k from "liveframe:kit"; globalThis.k = typeof k.renderModule;`, "e.js", {
        type: "module",
      }),
    ).dispose();
    cx.dispose();
    rt.dispose();
  }, 60);
  console.log(`runtime + kit load only: median ${ms(kitOnly)}`);
  const empty = time(() => {
    const rt = quickjs.newRuntime();
    const cx = rt.newContext();
    cx.dispose();
    rt.dispose();
  }, 200);
  console.log(`runtime + context create/dispose only: median ${ms(empty)}`);

  // reference runners, warm
  const runnerOptions = { ...options };
  const inProc = inProcessRunner();
  async function timeAsync(fn: () => Promise<unknown>, n: number, warm = 10): Promise<number> {
    for (let i = 0; i < warm; i++) await fn();
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = performance.now();
      await fn();
      xs.push(performance.now() - s);
    }
    return median(xs);
  }
  console.log(
    `inProcessRunner warm: median ${ms(await timeAsync(() => inProc.render(pkg, scenario, runnerOptions), 300))}`,
  );
  const worker = workerRunner({ timeoutMs: 5000 });
  t = performance.now();
  await worker.render(pkg, scenario, runnerOptions);
  console.log(`workerRunner cold (first render, worker start): ${ms(performance.now() - t)}`);
  console.log(
    `workerRunner warm: median ${ms(await timeAsync(() => worker.render(pkg, scenario, runnerOptions), 200))}`,
  );
  worker.close();
  const tpl = value(
    pack({ template: agentHomeTemplate, manifest: fixture.manifest, scenarios: fixture.scenarios as never }, options),
  );
  const tr = templateRunner();
  console.log(
    `templateRunner warm (template port): median ${ms(await timeAsync(() => tr.render(tpl, scenario, runnerOptions), 300))}`,
  );
}

// ---------------------------------------------------------------- limits and hostile probes
const header = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";\n`;
const widget = (body: string, top = false) =>
  `${header}${top ? body : ""}\nexport default () => { ${top ? "" : body}\n return __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" }); };`;
const probe = (name: string, body: string, limits: Partial<Limits> = {}) => {
  const code = name.startsWith("raw-") ? header + body : widget(body, /^(tla|microtask)/.test(name));
  const p: WidgetPackage = { ...pkg, code } as WidgetPackage;
  void packageHash(p);
  if (only && only !== name.split(" ")[0]) return;
  const s = performance.now();
  let outcome: Outcome;
  try {
    outcome = runSandbox(
      quickjs,
      code,
      JSON.stringify({
        inputs: scenario,
        options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "spike", revision: 1 },
      }),
      { ...defaults, ...limits },
    );
  } catch (error) {
    outcome = { kind: "error", message: `HOST-SIDE THROW ${String(error).slice(0, 200)}` };
  }
  const took = performance.now() - s;
  const shown =
    outcome.kind === "ok" ? `ok ${outcome.json.slice(0, 700)}` : `error ${outcome.name ?? ""}: ${outcome.message}`;
  console.log(`probe ${name} (${ms(took)}): ${shown}`);
  return outcome;
};
probe("stack-overflow-1MiB", "const f = (n) => f(n + 1) + 1; f(0);", { timeoutMs: 5000, stackBytes: 1 << 20 });
probe("deep-recursion-256KiB", "let d = 0; const f = () => { d++; [1].map(() => f()); }; f();", { timeoutMs: 5000 });
probe("deep-json-256KiB", "let o = {}; for (let i = 0; i < 1e6; i++) o = { o }; JSON.stringify(o);", {
  timeoutMs: 5000,
});
probe("memory-bomb-250ms", "const a = []; while (true) a.push(new Array(100000).fill(1));", { timeoutMs: 250 });
probe("memory-bomb-objects-250ms", "const a = []; while (true) a.push({ x: a.length });", { timeoutMs: 250 });
probe("memory-bomb-single", "new Array(1e8).fill(0);", { timeoutMs: 5000 });
probe("arraybuffer-bomb", "new ArrayBuffer(1e9);", { timeoutMs: 5000 });
probe("repeat-bomb", "'x'.repeat(1e9);", { timeoutMs: 5000 });
probe("tla-never-settles", "await new Promise(() => {});", { timeoutMs: 250 });
probe("microtask-loop-in-tla", "const f = () => Promise.resolve().then(f); f(); await new Promise(() => {});", {
  timeoutMs: 250,
});
probe(
  "raw-dynamic-import",
  `let r = "pending"; try { await import("node:fs"); r = "LOADED"; } catch (e) { r = "refused: " + e.message; }
let k = "none"; try { k = Object.keys(import.meta).join(",") + "|" + JSON.stringify(import.meta); } catch (e) { k = "err " + e.message; }
let ev = "none"; try { ev = String((0, eval)("typeof process + typeof Bun + typeof fetch")); } catch (e) { ev = "err " + e.message; }
let fn = "none"; try { fn = String(new Function("return typeof process + typeof Bun + typeof require")()); } catch (e) { fn = "err " + e.message; }
export default () => { throw new Error(["dyn=" + r, "meta=" + k, "eval=" + ev, "Function=" + fn].join(" ; ")); };`,
  { timeoutMs: 1000 },
);
probe(
  "raw-microtask-loop-pending-jobs",
  `const f = () => Promise.resolve().then(f); f();
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" });`,
  { timeoutMs: 250 },
);
probe("infinite-loop timeout=100ms", "while (true) {}", { timeoutMs: 100 });
probe("memory-bomb 32MiB", "const a = []; while (true) a.push(new Array(100000).fill(1));", { timeoutMs: 5000 });
probe("string-bomb 32MiB", "let s = 'x'; while (true) s += s;", { timeoutMs: 5000 });
probe("stack-overflow 1MiB", "const f = (n) => f(n + 1) + 1; f(0);", { timeoutMs: 5000 });
probe("deep-json", "let o = {}; for (let i = 0; i < 1e6; i++) o = { o }; JSON.stringify(o);", { timeoutMs: 5000 });
probe("promise-bomb (microtask loop)", "const f = () => Promise.resolve().then(f); f();", { timeoutMs: 200 });
probe(
  "host globals",
  `const names = ['fetch','process','Bun','Deno','require','module','exports','setTimeout','console','WebAssembly','SharedArrayBuffer','Atomics','TextEncoder','structuredClone','queueMicrotask','performance','navigator','XMLHttpRequest','Worker'];
   const seen = names.filter((n) => typeof globalThis[n] !== 'undefined');
   const own = Object.getOwnPropertyNames(globalThis).filter((n) => !['Object','Function','Array','Number','parseFloat','parseInt','Infinity','NaN','undefined','Boolean','String','Symbol','Date','Promise','RegExp','Error','AggregateError','EvalError','RangeError','ReferenceError','SyntaxError','TypeError','URIError','globalThis','JSON','Math','Intl','ArrayBuffer','Uint8Array','Int8Array','Uint16Array','Int16Array','Uint32Array','Int32Array','Float32Array','Float64Array','Uint8ClampedArray','BigUint64Array','BigInt64Array','DataView','Map','Set','WeakMap','WeakSet','Proxy','Reflect','BigInt','eval','isFinite','isNaN','decodeURI','decodeURIComponent','encodeURI','encodeURIComponent','escape','unescape','FinalizationRegistry','WeakRef','Float16Array','Iterator','SharedArrayBuffer','Atomics'].includes(n));
   throw new Error('SEEN=' + JSON.stringify(seen) + ' OWN=' + JSON.stringify(own));`,
);
probe(
  "constructor escape",
  `const g = (0, globalThis.constructor.constructor)('return this')(); throw new Error('ESC=' + typeof g.process + typeof g.Bun + typeof g.fetch + (g === globalThis));`,
);
probe(
  "import.meta / dynamic import",
  `try { new Function('return import("node:fs")')().then(() => {}, (e) => {}); } catch (e) {} throw new Error('DYN=' + (typeof import.meta));`,
);
probe(
  "host function reachable",
  `throw new Error('HOST=' + Object.getOwnPropertyNames(globalThis).filter((n) => typeof globalThis[n] === 'function' && /native code/.test(Function.prototype.toString.call(globalThis[n])) === false).join(','));`,
);
