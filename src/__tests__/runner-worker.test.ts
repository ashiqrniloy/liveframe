import { expect, test } from "bun:test";
import { jsx, primitive, render } from "@arnilo/liveframe/sdk";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { packageHash } from "../pack/hash.ts";
import { pack, type Scenario, type WidgetPackage } from "../pack/index.ts";
import { workerRunner } from "../preview/worker/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities, surfaceId: "runner", revision: 1 };
const root = new URL("./fixtures/widgets/", import.meta.url);
const files: Record<string, string> = {};
for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan(root.pathname))
  files[path] = await Bun.file(new URL(path, root)).text();
const entries = [
  ["agent-home/queue.tsx", "AgentHomeQueue"],
  ["core-queue/widget.tsx", "CoreQueue"],
  ["git-status/git-status.tsx", "GitStatus"],
  ["rack-module/rack-module.tsx", "RackModule"],
];
const packages = proofWidgets.map((fixture, i) => {
  const entry = entries[i];
  if (!entry) throw new Error("Missing widget entry");
  return value(
    pack(
      {
        files: { ...files, "entry.ts": `export { ${entry[1]} as default } from "./${entry[0]}";` },
        entry: "entry.ts",
        manifest: fixture.manifest,
        scenarios: fixture.scenarios as readonly Scenario[],
      },
      options,
    ),
  );
});
const base = packages[0];
const inputs = proofWidgets[0]?.scenarios[0];
if (!base || !inputs) throw new Error("Missing agent-home fixture");
const simpleCode = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" });`;
function withCode(code: string): WidgetPackage {
  const pkg = { ...base, code } as WidgetPackage;
  return { ...pkg, hash: packageHash(pkg) };
}

test("worker_matches_render", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  try {
    for (const [i, fixture] of proofWidgets.entries()) {
      const pkg = packages[i];
      if (!pkg) throw new Error("Missing packed widget");
      const validator = compileValidator({ ...options, manifest: pkg.manifest });
      for (const scenario of fixture.scenarios) {
        const expected = render(fixture.widget, scenario, { ...options, validator });
        expect(expected.ok, `${fixture.name}/${scenario.name}`).toBe(true);
        expect(await runner.render(pkg, scenario, options)).toEqual(expected);
      }
    }
  } finally {
    runner.close();
  }
});

test("worker_times_out_then_recovers", async () => {
  const runner = workerRunner();
  try {
    for (const code of ["while (true) {}", "export default () => { while (true) {} };"]) {
      const start = performance.now();
      expect(await runner.render(withCode(code), inputs, options)).toMatchObject({
        ok: false,
        errors: [{ kind: "limit-exceeded" }],
      });
      expect(performance.now() - start).toBeLessThan(600);
      expect((await runner.render(withCode(simpleCode), inputs, { ...options, timeoutMs: 2000 })).ok).toBe(true);
    }
    const slow = withCode(
      simpleCode.replace(
        'text: "ok"',
        'text: String((() => { const start = Date.now(); while (Date.now() - start < 50) {} return "ok"; })())',
      ),
    );
    expect(await runner.render(slow, inputs, { ...options, timeoutMs: 10 })).toMatchObject({
      ok: false,
      errors: [{ kind: "limit-exceeded" }],
    });
  } finally {
    runner.close();
  }
});

test("worker_crash_is_render_failed", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const counted = withCode(
    simpleCode
      .replace("export default () =>", "let count = 0; export default () =>")
      .replace('text: "ok"', "text: String(++count)"),
  );
  try {
    for (const code of [
      "throw new Error('load failed');",
      "export default 3;",
      "self.close(); export default () => { while (true) {} };",
      "queueMicrotask(() => { throw new Error('worker crashed'); }); await new Promise(() => {});",
    ]) {
      const before = await runner.render(counted, inputs, options);
      expect(before).toMatchObject({ ok: true });
      expect(await runner.render(withCode(code), inputs, options)).toMatchObject({
        ok: false,
        errors: [{ kind: "render-failed" }],
      });
      const after = await runner.render(counted, inputs, options);
      expect(after).toMatchObject({ ok: true });
      if (after.ok) expect(after.value.root.props.text).toBe("1");
    }
  } finally {
    runner.close();
  }
});

test("worker_serialises_requests_and_clones_results", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const pkg = withCode(
    simpleCode
      .replace("export default () =>", "let count = 0; export default () =>")
      .replace('text: "ok"', "text: String(++count)"),
  );
  try {
    const results = await Promise.all(Array.from({ length: 6 }, () => runner.render(pkg, inputs, options)));
    for (const [i, result] of results.entries()) {
      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.value.root.props.text).toBe(String(i + 1));
    }
    const first = results[0];
    if (first?.ok) (first.value.root.props as Record<string, unknown>).text = "changed";
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
    const [timeout, recovered] = await Promise.all([
      runner.render(withCode("while (true) {}"), inputs, { ...options, timeoutMs: 20 }),
      runner.render(pkg, inputs, options),
    ]);
    expect(timeout).toMatchObject({ ok: false, errors: [{ kind: "limit-exceeded" }] });
    expect(recovered).toMatchObject({ ok: true });
    if (recovered.ok) expect(recovered.value.root.props.text).toBe("1");
  } finally {
    runner.close();
  }
});

test("worker_preserves_validation_and_recovers_from_clone_failure", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const pkg = withCode(simpleCode);
  try {
    expect(await runner.render(pkg, inputs, { ...options, limits: { nodes: 0 } })).toMatchObject({
      ok: false,
      errors: [{ kind: "invalid-prop" }],
    });
    expect(await runner.render(pkg, { ...inputs, state: {} }, options)).toMatchObject({ ok: false });
    const denied = { ...catalog, definitions: [] };
    const validator = compileValidator({ ...options, catalog: denied, manifest: pkg.manifest });
    const expected = render(() => jsx(primitive("text"), { text: "ok" }), inputs, { ...options, validator });
    expect(expected.ok).toBe(false);
    expect(await runner.render(pkg, inputs, { ...options, catalog: denied })).toEqual(expected);
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
    expect(await runner.render(pkg, { ...inputs, data: { callback: () => {} } }, options)).toMatchObject({
      ok: false,
      errors: [{ kind: "render-failed" }],
    });
    expect((await runner.render(pkg, inputs, options)).ok).toBe(true);
  } finally {
    runner.close();
  }
});

test("worker_reuses_cloned_configuration_until_identity_changes", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  let reads = 0;
  const counted = {
    ...catalog,
    get definitions() {
      reads++;
      return catalog.definitions;
    },
  };
  const current = { ...options, catalog: counted };
  try {
    expect((await runner.render(withCode(simpleCode), inputs, current)).ok).toBe(true);
    const coldReads = reads;
    expect(coldReads).toBeGreaterThan(0);
    expect((await runner.render(withCode(simpleCode), inputs, { ...current, revision: 2 })).ok).toBe(true);
    expect((await runner.render(withCode(`${simpleCode}\n// new hash`), inputs, current)).ok).toBe(true);
    expect(reads).toBe(coldReads);
    expect(
      (await runner.render(withCode(simpleCode), inputs, { ...current, capabilities: { ...capabilities } })).ok,
    ).toBe(true);
    expect(reads).toBeGreaterThan(coldReads);
  } finally {
    runner.close();
  }
});

test("worker_close_settles_active_queued_and_future_requests", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
  const active = runner.render(withCode("while (true) {}"), inputs, options);
  const queued = runner.render(withCode(simpleCode), inputs, options);
  await new Promise((resolve) => setTimeout(resolve, 20));
  runner.close();
  runner.close();
  for (const result of await Promise.all([active, queued, runner.render(withCode(simpleCode), inputs, options)]))
    expect(result).toMatchObject({ ok: false, errors: [{ kind: "render-failed" }] });
});

test("worker_warm_overhead_report", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  const fixture = proofWidgets[0];
  if (!fixture) throw new Error("Missing widget");
  const validator = compileValidator({ ...options, manifest: base.manifest });
  try {
    for (let i = 0; i < 20; i++) value(await runner.render(base, inputs, options));
    let direct = 0;
    let worker = 0;
    for (let i = 0; i < 100; i++) {
      let start = performance.now();
      value(render(fixture.widget, inputs, { ...options, validator }));
      direct += performance.now() - start;
      start = performance.now();
      value(await runner.render(base, inputs, options));
      worker += performance.now() - start;
    }
    console.info(
      `worker warm overhead: ${((worker - direct) / 100).toFixed(4)} ms/render (direct ${(direct / 100).toFixed(4)}, worker ${(worker / 100).toFixed(4)})`,
    );
  } finally {
    runner.close();
  }
});
