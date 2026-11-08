import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { linkPackage } from "@arnilo/liveframe/runner-kit";
import { createEngine, type Job } from "../runtime.ts";
import { capabilities, catalog, inputs, textOf, widget } from "./fixtures.ts";

const wasm = await WebAssembly.compile(
  await Bun.file(fileURLToPath(import.meta.resolve("@jitl/quickjs-wasmfile-release-sync/wasm"))).arrayBuffer(),
);
const kit = await Bun.file(fileURLToPath(import.meta.resolve("@arnilo/liveframe/runner-kit.bundle.js"))).text();

const limits = { memoryBytes: 32 << 20, stackBytes: 256 << 10, timeoutMs: 5000 };

const manifest = widget("e.base", 'export default () => show("ok");').manifest;
const request = JSON.stringify({
  inputs,
  options: { catalog, capabilities, manifest, surfaceId: "e", revision: 1 },
});

function link(code: string): string {
  const linked = linkPackage(code, () => "liveframe:kit");
  if (!linked.ok) throw new Error("link");
  return linked.value;
}

/** A job for widget source the packer accepts. */
function job(source: string, extra: Partial<Job> = {}): Job {
  return { code: link(widget("e.job", source).code as string), libraries: {}, limits, request, ...extra };
}

/** A job for hand-built package code the packer would refuse: the engine must survive whatever a host hands it. */
function rawJob(body: string, extra: Partial<Job> = {}): Job {
  const code = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";\n${body}`;
  return { code: link(code), libraries: {}, limits, request, ...extra };
}

const SHOW = '__lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" })';

/** The text the sandbox's answer holds, or its failure. */
function answer(outcome: Awaited<ReturnType<ReturnType<typeof createEngine>["render"]>>): string {
  if ("error" in outcome) return `error: ${outcome.error}`;
  return textOf(JSON.parse(outcome.json));
}

test("quickjs_dispose_abort_drops_the_wasm_instance", async () => {
  const engine = createEngine(wasm, kit);
  // At 1 MiB QuickJS recurses past the host stack: the host throws RangeError from inside wasm (spike F3).
  const overflow = job(
    "export default () => { const f = (): void => { [1].map(() => f()); }; f(); return show(1); };",
    {
      limits: { ...limits, stackBytes: 1 << 20 },
    },
  );
  const outcome = await engine.render(overflow);
  expect("error" in outcome && /stack/i.test(outcome.error)).toBe(true);
  expect(engine.tainted()).toBe(1);
  // The next render runs in a new instance and the default stack gives QuickJS's own, graceful, overflow.
  expect(answer(await engine.render(job('export default () => show("next");')))).toBe("next");
  expect(engine.tainted()).toBe(1);
  engine.close();
});

test("quickjs_never_runs_pending_jobs", async () => {
  const engine = createEngine(wasm, kit);
  // A self-perpetuating microtask chain would abort `dispose()` if it were run and interrupted (spike F4).
  const chain = job(
    "const f = (): unknown => Promise.resolve().then(f); f();\n(globalThis as any).__ran = false;\nPromise.resolve().then(() => { (globalThis as any).__ran = true; });\nexport default () => show(String((globalThis as any).__ran));",
    { limits: { ...limits, timeoutMs: 150 }, key: "chain" },
  );
  expect(answer(await engine.render(chain))).toBe("false");
  // The kept runtime is called again: nothing ran between the renders either.
  expect(answer(await engine.render(chain))).toBe("false");
  expect(engine.tainted()).toBe(0);
  engine.close();
  expect(engine.tainted()).toBe(0);
});

test("quickjs_unsettled_top_level_await_is_a_failed_render", async () => {
  const engine = createEngine(wasm, kit);
  const outcome = await engine.render(rawJob(`await new Promise(() => {});\nexport default () => ${SHOW};`));
  expect(outcome).toEqual({ error: "The package did not finish loading: top-level await is not supported" });
  expect(engine.tainted()).toBe(0);
  engine.close();
});

test("quickjs_disposes_every_handle", async () => {
  // A leaked handle makes `runtime.dispose()` abort, which the engine counts as a tainted instance.
  const engine = createEngine(wasm, kit);
  const short = { ...limits, timeoutMs: 100 };
  const bodies = [
    `export default () => ${SHOW};`,
    'export default () => { throw new Error("boom"); };',
    "export default = ;",
    "export default 42;",
    "export default () => { for (;;) {} };",
    "const f = (n) => f(n + 1) + 1;\nexport default () => f(0);",
    "export default () => { const held = []; for (;;) held.push(new Array(1 << 20).fill(1)); };",
    `import("node:fs");\nexport default () => ${SHOW};`,
    `import "liveframe:elsewhere";\nexport default () => ${SHOW};`,
  ];
  for (const [i, body] of bodies.entries()) {
    await engine.render(rawJob(body, { limits: short }));
    await engine.render(rawJob(body, { limits: short, key: `k${i}` }));
  }
  expect(engine.tainted()).toBe(0);
  engine.close();
  expect(engine.tainted()).toBe(0);
  expect(engine.kept()).toBe(0);
});
