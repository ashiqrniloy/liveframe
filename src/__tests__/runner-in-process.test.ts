import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "@arnilo/liveframe/sdk";
import { compileValidator, type Result, validateCatalog, validateCapabilities } from "../index.ts";
import { pack, type Scenario, type WidgetPackage } from "../pack/index.ts";
import { packageHash } from "../pack/hash.ts";
import { inProcessRunner, type Runner } from "../preview/index.ts";
import { loadModule } from "../preview/load.ts";
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

test("in_process_matches_render", async () => {
  const runner: Runner = inProcessRunner();
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
});

test("in_process_reports_slow_render", async () => {
  const runner = inProcessRunner();
  const slow = withCode(`import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => {
  const start = Date.now();
  while (Date.now() - start < 150) {}
  return __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" });
};`);
  const result = await runner.render(slow, inputs, options);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toEqual([expect.objectContaining({ kind: "limit-exceeded" })]);
  expect((await runner.render(slow, inputs, { ...options, timeoutMs: 1000 })).ok).toBe(true);
  expect((await runner.render(withCode(simpleCode), inputs, options)).ok).toBe(true);
});

test("bad_module_is_render_failed", async () => {
  const runner = inProcessRunner();
  for (const code of ["export default 3;", "export const named = 1;", "throw new Error('load failed');"])
    expect(await runner.render(withCode(code), inputs, options)).toMatchObject({
      ok: false,
      errors: [{ kind: "render-failed", pointer: "" }],
    });
});

test("in_process_preserves_sdk_errors_and_limits", async () => {
  const runner = inProcessRunner();
  const pkg = withCode(simpleCode);
  const validator = compileValidator({ ...options, manifest: pkg.manifest });
  const module = await loadModule(pkg.code, pkg.hash);
  if (typeof module.default !== "function") throw new Error("Expected a widget");
  const widget = module.default;
  for (const [input, limits] of [
    [{ ...inputs, state: {} }, undefined],
    [inputs, { nodes: 0 }],
  ] as const) {
    const current = limits ? { ...options, limits } : options;
    const expected = render((props) => widget(props), input, { ...current, validator });
    expect(expected.ok).toBe(false);
    expect(await runner.render(pkg, input, current)).toEqual(expected);
  }
  const thrown = await runner.render(
    withCode("export default () => { throw new Error('widget failed'); };"),
    inputs,
    options,
  );
  expect(thrown).toMatchObject({ ok: false, errors: [{ kind: "render-failed" }] });
});

test("in_process_leaves_package_verification_to_host", async () => {
  const pkg = { ...withCode(simpleCode), hash: `sha256-${"0".repeat(64)}` };
  expect((await inProcessRunner().render(pkg, inputs, options)).ok).toBe(true);
});

test("in_process_caches_validator_per_catalog_capabilities_and_hash", async () => {
  let catalogReads = 0;
  let capabilityReads = 0;
  const countedCatalog = () =>
    new Proxy(catalog, {
      get(target, key, receiver) {
        catalogReads++;
        return Reflect.get(target, key, receiver);
      },
    });
  const countedCapabilities = () =>
    new Proxy(capabilities, {
      get(target, key, receiver) {
        capabilityReads++;
        return Reflect.get(target, key, receiver);
      },
    });
  const runner = inProcessRunner();
  const pkg = withCode(simpleCode);
  const first = { ...options, catalog: countedCatalog(), capabilities: countedCapabilities() };
  expect((await runner.render(pkg, inputs, first)).ok).toBe(true);
  const coldReads = [catalogReads, capabilityReads];
  expect(coldReads.every((count) => count > 0)).toBe(true);
  expect((await runner.render(pkg, inputs, { ...first, revision: 2 })).ok).toBe(true);
  expect([catalogReads, capabilityReads]).toEqual(coldReads);
  for (const changed of [
    { ...first, catalog: countedCatalog() },
    { ...first, capabilities: countedCapabilities() },
  ]) {
    const previous = capabilityReads;
    expect((await runner.render(pkg, inputs, changed)).ok).toBe(true);
    expect(capabilityReads).toBeGreaterThan(previous);
  }
  const previous = capabilityReads;
  expect((await runner.render(withCode(`${simpleCode}\n// another hash`), inputs, first)).ok).toBe(true);
  expect(capabilityReads).toBeGreaterThan(previous);
});

test("in_process_runner_resolves_sdk_from_other_cwd", async () => {
  const directory = await mkdtemp(join(tmpdir(), "liveframe-runner-"));
  try {
    const script = join(directory, "runner.ts");
    await Bun.write(
      script,
      `import { inProcessRunner } from ${JSON.stringify(new URL("../preview/index.ts", import.meta.url).href)};
console.log(JSON.stringify(await inProcessRunner().render(${JSON.stringify(base)}, ${JSON.stringify(inputs)}, ${JSON.stringify(options)})));`,
    );
    const child = Bun.spawn(["timeout", "10s", process.execPath, script], {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exitCode, stderr).toBe(0);
    const validator = compileValidator({ ...options, manifest: base.manifest });
    const fixture = proofWidgets[0];
    if (!fixture) throw new Error("Missing widget");
    expect(JSON.parse(stdout)).toEqual(render(fixture.widget, inputs, { ...options, validator }));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);

test("in_process_warm_overhead_under_point_one_ms", async () => {
  const runner = inProcessRunner();
  const module = await loadModule(base.code, base.hash);
  if (typeof module.default !== "function") throw new Error("Expected a widget");
  const widget = module.default;
  const validator = compileValidator({ ...options, manifest: base.manifest });
  for (let i = 0; i < 50; i++) {
    render((props) => widget(props), inputs, { ...options, validator });
    value(await runner.render(base, inputs, options));
  }
  const differences = [];
  for (let batch = 0; batch < 3; batch++) {
    let direct = 0;
    let throughRunner = 0;
    const measureDirect = () => {
      const start = performance.now();
      render((props) => widget(props), inputs, { ...options, validator });
      direct += performance.now() - start;
    };
    const measureRunner = async () => {
      const start = performance.now();
      value(await runner.render(base, inputs, options));
      throughRunner += performance.now() - start;
    };
    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        measureDirect();
        await measureRunner();
      } else {
        await measureRunner();
        measureDirect();
      }
    }
    differences.push((throughRunner - direct) / 50);
  }
  differences.sort((a, b) => a - b);
  const overhead = differences[1];
  console.info(`in-process warm median overhead: ${overhead?.toFixed(4)} ms/render`);
  expect(overhead).toBeLessThan(0.1);
});
