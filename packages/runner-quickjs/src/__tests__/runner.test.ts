import { afterAll, expect, test } from "bun:test";
import { canonicalJson } from "@arnilo/liveframe/pack";
import { inProcessRunner, templateRunner } from "@arnilo/liveframe/preview";
import { quickjsRunner } from "../index.ts";
import { codePackages, inputs, packages, renderOptions, templatePackage, textOf, widget } from "./fixtures.ts";

/** The hostile probes get a short limit per render; every render that must succeed gets a long one. */
const short = { ...renderOptions, timeoutMs: 100 };
const long = { ...renderOptions, timeoutMs: 5000 };
const runners: { close(): void }[] = [];
async function open(options: Parameters<typeof quickjsRunner>[0] = {}) {
  const runner = await quickjsRunner(options);
  runners.push(runner);
  return runner;
}
afterAll(() => {
  for (const runner of runners) runner.close();
});

test("quickjs_matches_render_for_every_proof_scenario", async () => {
  const runner = await open({ timeoutMs: 5000 });
  const reference = inProcessRunner();
  let scenarios = 0;
  for (const pkg of codePackages) {
    for (const scenario of pkg.scenarios) {
      const input = {
        params: scenario.params,
        state: scenario.state ?? pkg.manifest.initialState,
        context: scenario.context,
        data: scenario.data,
        actions: scenario.actions ?? {},
      };
      const [actual, expected] = await Promise.all([
        runner.render(pkg, input, long),
        reference.render(pkg, input, long),
      ]);
      expect(expected.ok).toBe(true);
      expect(actual.ok, `${pkg.manifest.id} / ${scenario.name}`).toBe(true);
      if (actual.ok && expected.ok) expect(canonicalJson(actual.value)).toBe(canonicalJson(expected.value));
      scenarios++;
    }
  }
  expect(scenarios).toBeGreaterThanOrEqual(25);
});

test("quickjs_infinite_loop_limit_exceeded", async () => {
  const runner = await open();
  const start = Date.now();
  const result = await runner.render(widget("t.loop", "export default () => { for (;;) {} };"), inputs, short);
  expect(result.ok).toBe(false);
  expect(!result.ok && result.errors[0]).toMatchObject({ kind: "limit-exceeded" });
  expect(textOf(result)).toContain("timeout");
  expect(Date.now() - start).toBeLessThan(1000);
});

test("quickjs_memory_bomb_limit_exceeded", async () => {
  const runner = await open({ timeoutMs: 5000, memoryBytes: 8 << 20 });
  const result = await runner.render(
    widget(
      "t.memory",
      "export default () => { const held: unknown[] = []; for (;;) held.push(new Array(1 << 20).fill(1)); };",
    ),
    inputs,
    renderOptions,
  );
  expect(!result.ok && result.errors[0]).toMatchObject({ kind: "limit-exceeded" });
  expect(textOf(result)).toContain("memory");
});

test("quickjs_stack_overflow_limit_exceeded", async () => {
  const runner = await open({ timeoutMs: 5000 });
  const result = await runner.render(
    widget("t.stack", "const f = (n: number): number => f(n + 1) + 1;\nexport default () => show(f(0));"),
    inputs,
    renderOptions,
  );
  expect(!result.ok && result.errors[0]).toMatchObject({ kind: "limit-exceeded" });
  expect(textOf(result)).toContain("stack");
  expect(textOf(await runner.render(widget("t.ok", 'export default () => show("ok");'), inputs, long))).toBe("ok");
});

test("quickjs_native_hold_is_killed_and_recovers", async () => {
  const runner = await open();
  const hold = widget("t.hold", 'export default () => show("a".repeat(1e7).indexOf("a".repeat(5e6) + "b"));');
  const start = Date.now();
  const held = await runner.render(hold, inputs, short);
  const elapsed = Date.now() - start;
  expect(!held.ok && held.errors[0]).toMatchObject({ kind: "limit-exceeded" });
  expect(elapsed).toBeLessThan(600);
  const recovered = await runner.render(widget("t.ok", 'export default () => show("ok");'), inputs, long);
  expect(textOf(recovered)).toBe("ok");
  // Twice: the replacement child is as killable as the first.
  expect((await runner.render(hold, inputs, short)).ok).toBe(false);
  expect(textOf(await runner.render(widget("t.ok", 'export default () => show("ok");'), inputs, long))).toBe("ok");
});

test("quickjs_no_host_globals", async () => {
  const runner = await open({ timeoutMs: 5000 });
  const names = [
    "fetch",
    "process",
    "Bun",
    "Deno",
    "require",
    "module",
    "setTimeout",
    "console",
    "WebAssembly",
    "TextEncoder",
    "structuredClone",
    "performance",
    "Worker",
  ];
  const probe = widget(
    "t.globals",
    `const g: any = globalThis; const seen = ${JSON.stringify(names)}.filter((name) => typeof g[name] !== "undefined");
let escaped = "none"; try { escaped = typeof (g.constructor.constructor("return this")() as any).process; } catch {}
export default () => show(seen.join(",") + "|" + escaped);`,
  );
  expect(textOf(await runner.render(probe, inputs, renderOptions))).toBe("|undefined");
});

test("quickjs_no_state_between_renders", async () => {
  const counter =
    'let calls = 0; export default () => show(++calls + "/" + ((globalThis as any).__n = ((globalThis as any).__n ?? 0) + 1));';
  const fresh = await open({ timeoutMs: 5000 });
  const a = widget("t.counter", counter);
  for (let i = 0; i < 3; i++) expect(textOf(await fresh.render(a, inputs, renderOptions))).toBe("1/1");
});

test("quickjs_reuse_package_keeps_state_per_package", async () => {
  const counter = (id: string) => widget(id, "let calls = 0; export default () => show(++calls);");
  const kept = await open({ timeoutMs: 5000, reuse: "package", maxRuntimes: 2 });
  const [a, b, c] = [counter("t.a"), counter("t.b"), counter("t.c")] as const;
  const next = async (pkg: typeof a) => textOf(await kept.render(pkg, inputs, renderOptions));
  expect([await next(a), await next(a), await next(b), await next(a)]).toEqual(["1", "2", "1", "3"]);
  // Two runtimes are kept: rendering c evicts the least recently used (b).
  expect(await next(c)).toBe("1");
  expect(await next(b)).toBe("1");
});

test("quickjs_reuse_package_drops_a_runtime_after_a_failure", async () => {
  const kept = await open({ reuse: "package" });
  const loop = widget(
    "t.flaky",
    "let calls = 0; export default () => { if (++calls === 2) for (;;) {} return show(calls); };",
  );
  expect(textOf(await kept.render(loop, inputs, long))).toBe("1");
  expect((await kept.render(loop, inputs, short)).ok).toBe(false);
  // The interrupted runtime is gone: the count starts again.
  expect(textOf(await kept.render(loop, inputs, long))).toBe("1");
});

test("quickjs_host_revalidates_a_forged_tree", async () => {
  const runner = await open({ timeoutMs: 5000 });
  const forging = widget(
    "t.forge",
    'JSON.stringify = () => \'{"ok":true,"value":{"forged":"FORGED"}}\';\nexport default () => show("ok");',
  );
  const result = await runner.render(forging, inputs, renderOptions);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain('FORGED"}');
  const bad = await runner.render(
    widget(
      "t.forge-errors",
      'JSON.stringify = () => \'{"ok":false,"errors":[{"kind":"made-up","pointer":"","message":"x"}]}\';\nexport default () => show("ok");',
    ),
    inputs,
    renderOptions,
  );
  expect(!bad.ok && bad.errors[0]).toMatchObject({
    kind: "render-failed",
    message: "The sandbox returned a malformed result",
  });
});

test("quickjs_renders_templates_on_the_host", async () => {
  const runner = await open();
  const scenario = templatePackage.scenarios[0];
  if (!scenario) throw new Error("scenario");
  const input = {
    params: scenario.params,
    state: templatePackage.manifest.initialState,
    context: scenario.context,
    data: scenario.data,
    actions: {},
  };
  const [actual, expected] = await Promise.all([
    runner.render(templatePackage, input, renderOptions),
    templateRunner().render(templatePackage, input, renderOptions),
  ]);
  expect(actual.ok).toBe(true);
  if (actual.ok && expected.ok) expect(canonicalJson(actual.value)).toBe(canonicalJson(expected.value));
});

test("quickjs_refuses_a_tampered_package_before_loading", async () => {
  const runner = await open();
  const ok = widget("t.tamper", 'export default () => show("ok");');
  const result = await runner.render({ ...ok, code: `for (;;) {}\n${ok.code}` } as typeof ok, inputs, renderOptions);
  expect(!result.ok && result.errors[0]).toMatchObject({ kind: "hash-mismatch" });
});

test("quickjs_close_settles_and_refuses", async () => {
  const runner = await quickjsRunner({ timeoutMs: 5000 });
  const loop = runner.render(widget("t.close", "export default () => { for (;;) {} };"), inputs, renderOptions);
  await Bun.sleep(100);
  runner.close();
  const closed = await loop;
  expect(!closed.ok && closed.errors[0]).toMatchObject({ kind: "render-failed", message: "Runner closed" });
  const after = await runner.render(packages[0] as never, inputs, renderOptions);
  expect(!after.ok && after.errors[0]).toMatchObject({ message: "Runner closed" });
});

test("quickjs_rejects_invalid_options", async () => {
  await expect(quickjsRunner({ timeoutMs: 0 })).rejects.toThrow(RangeError);
  await expect(quickjsRunner({ memoryBytes: 1.5 })).rejects.toThrow(RangeError);
});
