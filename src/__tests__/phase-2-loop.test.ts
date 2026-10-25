import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import { pack } from "@arnilo/liveframe/pack";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { render } from "@arnilo/liveframe/sdk";
import { loadPlacement, type Placement } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function rejects(result: Result<unknown>, kind: string, pointer?: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind, ...(pointer === undefined ? {} : { pointer }) }),
    );
    expect(result.errors.length).toBeLessThanOrEqual(20);
  }
}

const options = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
  surfaceId: "phase-2-loop",
  revision: 1,
};
const draft = drafts[0];
const fixture = proofWidgets[0];
if (!draft || !fixture) throw new Error("Missing agent-home fixture");
const base = value(pack(draft, options));
const first = base.scenarios[0];
if (!first) throw new Error("Missing agent-home scenario");
const scenario = { ...first, state: first.state ?? base.manifest.initialState };
const placement: Placement = {
  id: "home",
  slot: "home.main",
  widget: { id: base.manifest.id, version: base.manifest.version },
  params: scenario.params,
};
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "liveframe-loop-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("packs_stores_reloads_and_renders", async () => {
  const pkg = value(pack(draft, options));
  expect(value(pack(draft, options)).hash).toBe(pkg.hash);
  const store = fileStore(dir);
  await store.putPackage(pkg);
  await store.putPlacement(placement);
  expect(scenario.state).not.toEqual(pkg.manifest.initialState);
  await store.putState(placement.id, scenario.state);

  const loaded = value(await loadPlacement(fileStore(dir), placement.id, options));
  expect(loaded).toEqual({ package: pkg, params: scenario.params, state: scenario.state });
  const inputs = { ...scenario, params: loaded.params, state: loaded.state };
  const expected = value(
    render(fixture.widget, inputs, {
      ...options,
      validator: compileValidator({ ...options, manifest: pkg.manifest }),
    }),
  );
  const worker = workerRunner();
  try {
    for (const runner of [inProcessRunner(), worker])
      expect(value(await runner.render(loaded.package, inputs, options))).toEqual(expected);
  } finally {
    worker.close();
  }
});

test("every_proof_scenario_through_both_runners", async () => {
  const worker = workerRunner();
  try {
    const runners = [inProcessRunner(), worker];
    for (const [i, proof] of proofWidgets.entries()) {
      const input = drafts[i];
      if (!input) throw new Error("Missing widget draft");
      const pkg = value(pack(input, options));
      const validator = compileValidator({ ...options, manifest: pkg.manifest });
      for (const scenario of proof.scenarios) {
        const expected = value(render(proof.widget, scenario, { ...options, validator }));
        for (const runner of runners) expect(value(await runner.render(pkg, scenario, options))).toEqual(expected);
      }
    }
  } finally {
    worker.close();
  }
});

test.each([
  [
    "forbidden import",
    { files: { "entry.ts": 'import "node:fs"; export default () => null;' } },
    "forbidden-import",
    "/files/entry.ts/1",
  ],
  [
    "bad initial state",
    { manifest: { ...base.manifest, initialState: null } },
    "invalid-document",
    "/manifest/initialState",
  ],
  ["no scenario", { scenarios: [] }, "invalid-document", "/scenarios"],
  ["bad scenario", { scenarios: [{ ...scenario, params: null }] }, "invalid-document", "/scenarios/0/params"],
] as const)("done_list_typed_errors: %s", (_name, change, kind, pointer) => {
  rejects(pack({ ...draft, ...change }, options), kind, pointer);
});

test("done_list_typed_errors: version conflict", async () => {
  const store = fileStore(dir);
  await store.putPackage(base);
  const changed = value(pack({ ...draft, scenarios: [{ ...scenario, name: "changed" }] }, options));
  expect(changed.hash).not.toBe(base.hash);
  await expect(fileStore(dir).putPackage(changed)).rejects.toMatchObject({
    name: "LiveframeFailure",
    errors: [expect.objectContaining({ kind: "version-conflict" })],
  });
  expect(await store.getPackage(base.manifest.id, base.manifest.version)).toEqual(base);
});

test("done_list_typed_errors: tampered package", async () => {
  const store = fileStore(dir);
  await store.putPackage({ ...base, code: `${base.code}\n// tampered` });
  await store.putPlacement(placement);
  rejects(await loadPlacement(fileStore(dir), placement.id, options), "hash-mismatch", "/hash");
});

test("done_list_typed_errors: params do not fit", async () => {
  const store = fileStore(dir);
  await store.putPackage(base);
  await store.putPlacement({ ...placement, params: null });
  rejects(await loadPlacement(fileStore(dir), placement.id, options), "invalid-prop", "/params");
});

test("done_list_typed_errors: corrupt record", async () => {
  const store = fileStore(dir);
  await store.putPackage(base);
  await store.putPlacement(placement);
  await writeFile(join(dir, "placements", "home.json"), '{"id":');
  rejects(await loadPlacement(fileStore(dir), placement.id, options), "invalid-document");
});

test("done_list_typed_errors: state reset after version change", async () => {
  const store = fileStore(dir);
  await store.putPackage(base);
  await store.putPlacement(placement);
  await store.putState(placement.id, scenario.state);
  const upgraded = value(
    pack(
      {
        ...draft,
        manifest: {
          ...base.manifest,
          version: "2.0.0",
          state: { type: "object", properties: {}, required: [], additionalProperties: false },
          initialState: {},
        },
        scenarios: [{ ...scenario, state: {} }],
      },
      options,
    ),
  );
  await store.putPackage(upgraded);
  await store.putPlacement({ ...placement, widget: { id: upgraded.manifest.id, version: upgraded.manifest.version } });
  const loaded = value(await loadPlacement(fileStore(dir), placement.id, options));
  expect(loaded.package).toEqual(upgraded);
  expect(loaded.state).toEqual({});
  expect(loaded.reset).toContainEqual(expect.objectContaining({ kind: "invalid-prop", pointer: "/state/filter" }));
  expect(await store.getState(placement.id)).toEqual(scenario.state);
});

test("pack_store_and_reload_never_execute_widget_code", async () => {
  const pkg = value(
    pack(
      {
        ...draft,
        files: { "entry.ts": 'throw new Error("execution-marker"); export default () => null;' },
      },
      options,
    ),
  );
  const store = fileStore(dir);
  await store.putPackage(pkg);
  await store.putPlacement(placement);
  const loaded = value(await loadPlacement(fileStore(dir), placement.id, options));
  const worker = workerRunner();
  try {
    for (const runner of [inProcessRunner(), worker]) {
      const result = await runner.render(loaded.package, scenario, options);
      rejects(result, "render-failed");
      if (!result.ok) expect(result.errors[0]?.message).toContain("execution-marker");
    }
  } finally {
    worker.close();
  }
});

test("done_list_typed_errors: worker timeout then recovery", async () => {
  const pkg = value(pack({ ...draft, files: { "entry.ts": "export default () => { while (true) {} };" } }, options));
  const worker = workerRunner();
  try {
    const start = performance.now();
    rejects(await worker.render(pkg, scenario, options), "limit-exceeded");
    expect(performance.now() - start).toBeLessThan(600);
    const expected = value(
      render(fixture.widget, scenario, {
        ...options,
        validator: compileValidator({ ...options, manifest: base.manifest }),
      }),
    );
    expect(value(await worker.render(base, scenario, options))).toEqual(expected);
  } finally {
    worker.close();
  }
});

// Run the guide verbatim with the same draft and configuration as the install-loop proof.
test("package_guide_example_runs", async () => {
  const guide = await Bun.file(new URL("../../docs/packages.md", import.meta.url)).text();
  const example = /```ts\n([\s\S]*?)```/.exec(guide)?.[1];
  if (!example) throw new Error("Missing package guide example");
  const contextFile = join(dir, "guide-inputs.json");
  await writeFile(contextFile, JSON.stringify({ draft, options, dir }));
  const process = Bun.spawn(
    [
      "bun",
      "--conditions",
      "liveframe:source",
      "--eval",
      `const { draft, options, dir } = await Bun.file(${JSON.stringify(contextFile)}).json();\n${example}`,
    ],
    { cwd: new URL("../../", import.meta.url).pathname, stdout: "pipe", stderr: "pipe" },
  );
  const stderr = await new Response(process.stderr).text();
  expect(await process.exited, stderr).toBe(0);
}, 10000);
