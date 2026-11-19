// Plan 030 T2-T4: pipeline overhead of renderPlacement and handleIntent beyond the injected calls (budget 0.2 ms), and dependents over 1,000 placements.

import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import capabilitiesDoc from "../examples/demo-host/capabilities.json" with { type: "json" };
import catalogDoc from "../examples/demo-host/catalog.json" with { type: "json" };
import { frozenJsonCopy, sameJson } from "../src/formats/json.ts";
import { dependents, handleIntent, renderPlacement, type Served } from "../src/host/index.ts";
import { bindSources, diffTrees, obj, type Result, str, validateCapabilities, validateCatalog } from "../src/index.ts";
import { renderKey } from "../src/pack/hash.ts";
import { checkPackages, pack } from "../src/pack/index.ts";
import { inProcessRunner, templateRunner } from "../src/preview/index.ts";
import type { Runner } from "../src/preview/runner.ts";
import { fileStore } from "../src/store/fs/index.ts";
import { loadPlacement, memoryStore, verifiedPackages, verifyPlacementInputs } from "../src/store/index.ts";
import { verifyStoredPackage } from "../src/store/verified.ts";
import { compileSchema } from "../src/validate/schema.ts";
import { drafts, packageOptions } from "../src/__tests__/fixtures/widgets/drafts.ts";
import { budget, metric } from "./metrics.ts";

const runsFlag = Bun.argv.indexOf("--runs");
/** `--runs <n>` shortens a smoke run; the default is the measured figure. */
const smokeRuns = runsFlag >= 0 ? Number(Bun.argv[runsFlag + 1]) : undefined;

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const capabilities = value(
  validateCapabilities({
    ...capabilitiesDoc,
    sources: { "notes.read": { description: "A note", params: obj({}), result: str({ maxLength: 200 }) } },
  }),
);
const install = frozenJsonCopy({ catalog: value(validateCatalog(catalogDoc)), capabilities });
const installs = { [install.catalog.catalogId]: install };

// About 4 KB of inputs, as the demo host's: a 3.6 KB state string plus a short source value.
const label = "x".repeat(3600);
const properties = (max: number) => ({ label: { type: "string", maxLength: max } });
const manifest = {
  format: "liveframe-manifest/1",
  id: "bench",
  version: "1",
  catalogId: install.catalog.catalogId,
  params: obj({}),
  state: { type: "object", properties: properties(5000), required: ["label"], additionalProperties: false },
  context: obj({}),
  initialState: { label },
  sources: { note: { source: "notes.read", params: {} } },
  actions: [],
};
const template = { format: "liveframe-template/1", root: { kind: "text", props: { text: "Bench" } } };
const pkg = value(
  pack(
    {
      template,
      manifest,
      scenarios: [{ name: "default", params: {}, state: { label }, context: {}, data: { note: "n" } }],
    } as never,
    install,
  ),
);
const store = memoryStore();
await store.putPackage(pkg);
await store.putPlacement({ id: "p", slot: "main", widget: { id: "bench", version: "1" }, params: {} });

// A stub runner: the tree is rendered once, then served with the revision it is asked for.
const real = value(
  await templateRunner().render(
    pkg,
    { params: {}, state: { label }, context: {}, data: { note: "n" } },
    {
      ...install,
      surfaceId: "p",
      revision: 1,
    },
  ),
);
const runner: Runner = { render: async (_pkg, _inputs, { revision }) => ({ ok: true, value: { ...real, revision } }) };
const wiring = {
  store,
  runner,
  installs,
  resolve: async () => ({ note: { ok: true as const, value: "n" } }),
  verified: verifiedPackages(),
  placementId: "p",
  catalogId: install.catalog.catalogId,
  viewer: "viewer",
  context: {},
};

const N = smokeRuns ?? 3000;
const warmup = smokeRuns ? Math.min(5, smokeRuns) : 300;
const batches = smokeRuns ? 1 : 5;
const batchSize = Math.max(1, Math.floor(N / batches));
async function time(run: (i: number) => Promise<unknown> | unknown): Promise<number> {
  for (let i = 0; i < warmup; i++) await run(i);
  // CPU time, not wall time: a busy machine must not decide a per-call budget.
  const samples: number[] = [];
  for (let b = 0; b < batches; b++) {
    const start = process.cpuUsage();
    for (let i = 0; i < batchSize; i++) await run(b * batchSize + i);
    const used = process.cpuUsage(start);
    samples.push((used.user + used.system) / 1000 / batchSize);
  }
  samples.sort((a, b) => a - b);
  return samples[batches >> 1] as number;
}

const first = value(await renderPlacement(wiring));
const full = await time(() => renderPlacement(wiring));
const skipped = await time(() => renderPlacement({ ...wiring, previous: first }));
// With `previous`, a changed revision is diffed: that is the common re-render.
let previous: Served = first;
const rerender = await time(async (i) => {
  previous = value(await renderPlacement({ ...wiring, state: { label: `${label}${i}` }, previous }));
});
// What the laws require beside the budgeted work: `validateTree` and `diffTrees`.
const next = { ...real, revision: 2 };
const validate = await time(() => first.validator.validateTree(next));
const diff = await time(() => diffTrees(first.tree, next));

// The split of the budgeted part, so a miss says where the time goes.
const load = await time(() => loadPlacement(store, "p", install, { verified: wiring.verified }));
const bind = await time(() => bindSources(pkg.manifest, capabilities, { params: {}, state: { label }, context: {} }));
// Overhead is what the pipeline adds beyond `loadPlacement` (reported on its own: it re-hashes the package and
// re-canonicalises the catalog on every verified-cache hit), the runner, the resolver, `validateTree` and `diffTrees`.
const overhead = skipped - load;
const key = await time(() =>
  renderKey({
    hash: pkg.hash,
    catalogId: install.catalog.catalogId,
    params: {},
    state: { label },
    data: { note: "n" },
    context: {},
    actions: {},
  }),
);
// handleIntent: an action through checkOffered, authorize, dispatch, record and the final render. The baseline is a
// renderPlacement with the same inputs, so the runner, `loadPlacement` and the resolver cancel out.
const press = {
  key: "go",
  kind: "button",
  props: { label: "Go" },
  events: { onPress: { type: "action", name: "demo.notify", args: { message: "hi" } } },
};
const actionPkg = value(
  pack(
    {
      template: { format: "liveframe-template/1", root: { kind: "stack", children: [press] } },
      manifest: { ...manifest, id: "act", sources: {}, actions: ["demo.notify"] },
      scenarios: [{ name: "default", params: {}, state: { label }, context: {}, data: {} }],
    } as never,
    install,
  ),
);
await store.putPackage(actionPkg);
await store.putPlacement({ id: "q", slot: "main", widget: { id: "act", version: "1" }, params: {} });
const acting = { ...wiring, runner: templateRunner(), placementId: "q" };
const shown = value(await renderPlacement(acting));
const button = shown.tree.root.children?.[0];
if (!button?.id) throw new Error("The bench tree has no button");
const settled = { "demo.notify": { status: "ok" as const, action: "demo.notify" } };
const handled = await time(() =>
  handleIntent({
    ...acting,
    served: shown,
    origin: { surfaceId: "q", revision: shown.revision, nodeId: button.id as string, event: "onPress" },
    intent: button.events?.onPress as never,
    authorize: () => true,
    dispatch: async () => ({ ok: true }),
  }),
);
const baseline = await time(() => renderPlacement({ ...acting, previous: shown, actions: settled }));
const intentOverhead = handled - baseline;

// dependents: one scan over 1,000 placements with two bound calls each; every tenth depends on the change.
const bound = (i: number) =>
  ({
    rows: { source: "tasks.read", params: { page: i } },
    sel: { source: i % 10 === 0 ? "selection.current" : "selection.other", params: { id: "1" } },
  }) as Served["bound"];
const placements = Array.from({ length: 1000 }, (_, i) => ({ placementId: `p${i}`, bound: bound(i) }));
const scanned = await time(() => dependents(placements, { source: "selection.current", params: { id: "1" } }));

console.log(
  JSON.stringify({
    dependentsMs: scanned,
    intentMs: handled,
    intentBaselineMs: baseline,
    intentPipelineMs: intentOverhead,
    inputBytes: JSON.stringify({ label }).length,
    renderMs: full,
    skippedMs: skipped,
    rerenderMs: rerender,
    validateTreeMs: validate,
    diffTreesMs: diff,
    pipelineMs: overhead,
    split: { loadMs: load, bindMs: bind, renderKeyMs: key },
  }),
);
metric("host_render_ms", full);
metric("host_skipped_ms", skipped);
metric("host_pipeline_ms", overhead);
metric("host_load_ms", load);
metric("host_intent_ms", handled);
metric("host_dependents_1000_ms", scanned);
metric("host_intent_pipeline_ms", intentOverhead);
budget(overhead <= 0.2, `renderPlacement pipeline overhead ${overhead.toFixed(3)} ms exceeds the 0.2 ms budget`);
budget(
  intentOverhead <= 0.2,
  `handleIntent pipeline overhead ${intentOverhead.toFixed(3)} ms exceeds the 0.2 ms budget`,
);

budget(scanned <= 20, `dependents over 1,000 placements ${scanned.toFixed(3)} ms exceeds the 20 ms budget`);

// Plan 033 T9: warm HTTP `setState` round-trip CPU time over 30 local requests (budget <= 50 ms/req).
const stateBtns = [
  {
    key: "sa",
    kind: "button",
    props: { label: "A" },
    events: { onPress: { type: "setState", key: "label", value: "a" } },
  },
  {
    key: "sb",
    kind: "button",
    props: { label: "B" },
    events: { onPress: { type: "setState", key: "label", value: "b" } },
  },
];
const statePkg = value(
  pack(
    {
      template: { format: "liveframe-template/1", root: { kind: "stack", children: stateBtns } },
      manifest: { ...manifest, id: "http-state", sources: {} },
      scenarios: [{ name: "default", params: {}, state: { label }, context: {}, data: {} }],
    } as never,
    install,
  ),
);
await store.putPackage(statePkg);
await store.putPlacement({ id: "h", slot: "main", widget: { id: "http-state", version: "1" }, params: {} });
const httpWiring = { ...wiring, runner: templateRunner(), placementId: "h" };
let httpServed = value(await renderPlacement(httpWiring));
const stateNodeIds = (httpServed.tree.root.children ?? []).map((n) => n.id);
assert(stateNodeIds.length === 2, "expected two setState buttons");
const httpServer = Bun.serve({
  port: 0,
  async fetch(req) {
    const body = (await req.json()) as { index: number };
    const idx = body.index % 2;
    const node = httpServed.tree.root.children?.[idx];
    assert(node?.events?.onPress, "missing setState event");
    const result = await handleIntent({
      ...httpWiring,
      served: httpServed,
      origin: { surfaceId: "h", revision: httpServed.revision, nodeId: node.id, event: "onPress" },
      intent: node.events.onPress,
      authorize: () => true,
      dispatch: async () => ({ ok: true }),
    });
    if (!result.ok) return new Response(JSON.stringify(result.errors), { status: 400 });
    httpServed = result.value.served;
    return Response.json({ revision: httpServed.revision });
  },
});
let httpAvgCpuMs = 0;
try {
  const postIntent = async (i: number) => {
    const res = await fetch(httpServer.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: i }),
    });
    assert(res.ok, `HTTP setState failed: ${res.status}`);
    return (await res.json()) as { revision: number };
  };
  const httpRequests = smokeRuns ?? 30;
  for (let i = 0; i < Math.min(5, httpRequests); i++) await postIntent(i);
  const httpCpuStart = process.cpuUsage();
  for (let i = 0; i < httpRequests; i++) await postIntent(i);
  const httpCpuUsed = process.cpuUsage(httpCpuStart);
  httpAvgCpuMs = (httpCpuUsed.user + httpCpuUsed.system) / 1000 / httpRequests;
} finally {
  httpServer.stop(true);
}
console.log(JSON.stringify({ httpSetStateCpuMs: httpAvgCpuMs }));
metric("host_http_set_state_cpu_ms", httpAvgCpuMs);
budget(httpAvgCpuMs <= 50, `warm HTTP setState round-trip ${httpAvgCpuMs.toFixed(3)} ms exceeds the 50 ms budget`);

// Plan 030 T6: `checkPackages` over 1,000 distinct template packages (verify + render every scenario), CPU time per package.
const packageCount = smokeRuns ?? 1000;
const stored = Array.from({ length: packageCount }, (_, i) =>
  value(
    pack(
      {
        template,
        manifest: { ...manifest, version: String(i) },
        scenarios: [{ name: "default", params: {}, state: { label }, context: {}, data: { note: "n" } }],
      } as never,
      install,
    ),
  ),
);
const checkStart = process.cpuUsage();
const checked = await checkPackages(stored, { ...install, runner: templateRunner() });
const checkUsed = process.cpuUsage(checkStart);
const checkMs = (checkUsed.user + checkUsed.system) / 1000 / stored.length;
assert(
  checked.every((entry) => entry.ok),
  "every bench package should check ok",
);
console.log(JSON.stringify({ checkPackagesMsPerPackage: checkMs, packages: stored.length }));
metric("check_packages_ms_per_package", checkMs);

// Plan 034 T1: the proof's agent-home code package (199 KB, 167 KB scenarios) in memoryStore() and fileStore()
// through inProcessRunner(), plus the CPU-time split of one renderPlacement.
const homeDraft = drafts[0];
assert(homeDraft, "missing agent-home draft");
const homeInstall = frozenJsonCopy(packageOptions);
const homeInstalls = { [homeInstall.catalog.catalogId]: homeInstall };
const homePkg = value(pack(homeDraft, homeInstall));
const homeScenario = homePkg.scenarios[0];
assert(homeScenario, "missing agent-home scenario");
const homeState = homeScenario.state ?? homePkg.manifest.initialState;
const homePlacement = {
  id: "home",
  slot: "main",
  widget: { id: homePkg.manifest.id, version: homePkg.manifest.version },
  params: homeScenario.params,
};
const homeMemory = memoryStore();
await homeMemory.putPackage(homePkg);
await homeMemory.putPlacement(homePlacement);
await homeMemory.putState("home", "", homeState);

const homeDir = await mkdtemp(join(tmpdir(), "lf-host-bench-"));
try {
  const homeFile = fileStore(homeDir);
  await homeFile.putPackage(homePkg);
  await homeFile.putPlacement(homePlacement);
  await homeFile.putState("home", "", homeState);

  const homeResolved = Object.fromEntries(
    Object.entries(homeScenario.data).map(([alias, val]) => [alias, { ok: true as const, value: val }]),
  );
  const homeResolve = async () => homeResolved;
  const homeRunner = inProcessRunner();
  const homeVerified = verifiedPackages();
  const homeWiring = {
    store: homeMemory,
    runner: homeRunner,
    installs: homeInstalls,
    resolve: homeResolve,
    verified: homeVerified,
    runOptions: { timeoutMs: 5000 },
    placementId: "home",
    catalogId: homeInstall.catalog.catalogId,
    viewer: "viewer",
    context: homeScenario.context,
  };

  const homeFirst = value(await renderPlacement(homeWiring));
  const homeSecond = value(
    await renderPlacement({ ...homeWiring, previous: homeFirst, revision: homeFirst.revision + 1 }),
  );
  const homeLoaded = value(await loadPlacement(homeMemory, "home", homeInstall, { verified: homeVerified }));
  const homeRawCopy = await homeMemory.getPackage(homePkg.manifest.id, homePkg.manifest.version);
  assert(homeRawCopy, "missing stored agent-home package");

  if (!smokeRuns) {
    for (let i = 0; i < 15; i++) {
      await renderPlacement({
        ...homeWiring,
        verified: undefined,
        previous: homeFirst,
        revision: homeFirst.revision + 1,
      });
      await renderPlacement({ ...homeWiring, previous: homeFirst, revision: homeFirst.revision + 1 });
    }
  }

  const codeBatches = smokeRuns ? 1 : 5;
  const codeBatchSize = smokeRuns ?? 6;
  const codeWarmup = smokeRuns ? Math.min(2, smokeRuns) : 3;
  const timeCode = async (run: (i: number) => Promise<unknown> | unknown): Promise<number> => {
    for (let i = 0; i < codeWarmup; i++) await run(i);
    const samples: number[] = [];
    for (let b = 0; b < codeBatches; b++) {
      const start = process.cpuUsage();
      for (let i = 0; i < codeBatchSize; i++) await run(b * codeBatchSize + i);
      const used = process.cpuUsage(start);
      samples.push((used.user + used.system) / 1000 / codeBatchSize);
    }
    samples.sort((a, b) => a - b);
    return samples[codeBatches >> 1] as number;
  };

  const homeRenderUncached = await timeCode(() =>
    renderPlacement({ ...homeWiring, verified: undefined, previous: homeFirst, revision: homeFirst.revision + 1 }),
  );
  const homeRenderVerified = await timeCode(() =>
    renderPlacement({ ...homeWiring, previous: homeFirst, revision: homeFirst.revision + 1 }),
  );
  const homeSkipped = await timeCode(() => renderPlacement({ ...homeWiring, previous: homeFirst }));
  const homeLoadUncached = await timeCode(() => loadPlacement(homeMemory, "home", homeInstall));
  const homeLoadVerified = await timeCode(() =>
    loadPlacement(homeMemory, "home", homeInstall, { verified: homeVerified }),
  );

  const homeFileRenderUncached = await timeCode(() =>
    renderPlacement({
      ...homeWiring,
      store: homeFile,
      verified: undefined,
      previous: homeFirst,
      revision: homeFirst.revision + 1,
    }),
  );
  const homeFileRenderVerified = await timeCode(() =>
    renderPlacement({ ...homeWiring, store: homeFile, previous: homeFirst, revision: homeFirst.revision + 1 }),
  );
  const homeFileSkipped = await timeCode(() =>
    renderPlacement({ ...homeWiring, store: homeFile, previous: homeFirst }),
  );
  const homeFileLoadUncached = await timeCode(() => loadPlacement(homeFile, "home", homeInstall));
  const homeFileLoadVerified = await timeCode(() =>
    loadPlacement(homeFile, "home", homeInstall, { verified: homeVerified }),
  );

  const homeStoreRead = await timeCode(async () => {
    await homeMemory.getPlacement("home");
    await homeMemory.getPackage(homePkg.manifest.id, homePkg.manifest.version);
    await homeMemory.getState("home", "");
  });
  const homeFileStoreRead = await timeCode(async () => {
    await homeFile.getPlacement("home");
    await homeFile.getPackage(homePkg.manifest.id, homePkg.manifest.version);
    await homeFile.getState("home", "");
  });
  const homeVerifyUncached = await timeCode(() => {
    assert(verifyStoredPackage(homeRawCopy, homeInstall).ok);
    assert(verifyPlacementInputs(homeLoaded.package, { params: homeScenario.params, state: homeState }).ok);
  });
  const homeVerifyVerified = await timeCode(() => {
    assert(verifyStoredPackage(homeRawCopy, homeInstall, homeVerified).ok);
    assert(verifyPlacementInputs(homeLoaded.package, { params: homeScenario.params, state: homeState }).ok);
  });
  const homeEquality = await timeCode(() => {
    assert(sameJson(homeLoaded.package, homeRawCopy));
  });
  const homeBindAndFit = await timeCode(async () => {
    const boundCalls = value(
      bindSources(homePkg.manifest, homeInstall.capabilities, {
        params: homeScenario.params,
        state: homeState,
        context: homeScenario.context,
      }),
    );
    const calls = Object.entries(boundCalls).map(([alias, { source, params }]) => ({ alias, source, params }));
    const resolved = (await homeResolve()) as Record<string, { ok: true; value: unknown }>;
    for (const { alias, source } of calls) {
      const schema = homeInstall.capabilities.sources[source]?.result;
      assert(schema && compileSchema(schema)(resolved[alias]?.value, `/data/${alias}`, { errors: [], maxErrors: 20 }));
    }
  });
  const homeKey = await timeCode(() =>
    renderKey({
      hash: homePkg.hash,
      catalogId: homeInstall.catalog.catalogId,
      params: homeScenario.params,
      state: homeState,
      data: homeScenario.data,
      context: homeScenario.context,
      actions: {},
    }),
  );
  const homeRunnerMs = await timeCode(async () => {
    assert(
      (
        await homeRunner.render(
          homeLoaded.package,
          {
            params: homeLoaded.params,
            state: homeLoaded.state,
            context: homeScenario.context,
            data: { ...homeScenario.data },
            actions: {},
          },
          { ...homeInstall, surfaceId: "home", revision: homeFirst.revision + 1, timeoutMs: 5000 },
        )
      ).ok,
    );
  });
  const homeValidate = await timeCode(() => {
    assert(homeFirst.validator.validateTree(homeSecond.tree).ok);
  });
  const homeDiff = await timeCode(() => {
    assert(diffTrees(homeFirst.tree, homeSecond.tree).ok);
  });

  console.log(
    JSON.stringify({
      subject: "agent-home",
      packageBytes: JSON.stringify(homePkg).length,
      codeBytes: (homePkg.code ?? "").length,
      scenarioBytes: JSON.stringify(homePkg.scenarios).length,
      memoryStore: {
        renderUncachedMs: homeRenderUncached,
        renderVerifiedMs: homeRenderVerified,
        skippedMs: homeSkipped,
        loadUncachedMs: homeLoadUncached,
        loadVerifiedMs: homeLoadVerified,
      },
      fileStore: {
        renderUncachedMs: homeFileRenderUncached,
        renderVerifiedMs: homeFileRenderVerified,
        skippedMs: homeFileSkipped,
        loadUncachedMs: homeFileLoadUncached,
        loadVerifiedMs: homeFileLoadVerified,
      },
      split: {
        storeReadMs: homeStoreRead,
        fileStoreReadMs: homeFileStoreRead,
        verifyUncachedMs: homeVerifyUncached,
        verifyVerifiedMs: homeVerifyVerified,
        equalityMs: homeEquality,
        bindAndFitMs: homeBindAndFit,
        renderKeyMs: homeKey,
        runnerMs: homeRunnerMs,
        validateTreeMs: homeValidate,
        diffTreesMs: homeDiff,
      },
    }),
  );
  metric("code_render_uncached_ms", homeRenderUncached);
  metric("code_render_verified_ms", homeRenderVerified);
  metric("code_skipped_ms", homeSkipped);
  metric("code_load_uncached_ms", homeLoadUncached);
  metric("code_load_verified_ms", homeLoadVerified);
  metric("code_file_render_uncached_ms", homeFileRenderUncached);
  metric("code_file_render_verified_ms", homeFileRenderVerified);
  metric("code_file_skipped_ms", homeFileSkipped);
  metric("code_file_load_uncached_ms", homeFileLoadUncached);
  metric("code_file_load_verified_ms", homeFileLoadVerified);
  metric("code_split_store_read_ms", homeStoreRead);
  metric("code_split_file_store_read_ms", homeFileStoreRead);
  metric("code_split_verify_uncached_ms", homeVerifyUncached);
  metric("code_split_verify_verified_ms", homeVerifyVerified);
  metric("code_split_equality_ms", homeEquality);
  metric("code_split_bind_and_fit_ms", homeBindAndFit);
  metric("code_split_render_key_ms", homeKey);
  metric("code_split_runner_ms", homeRunnerMs);
  metric("code_split_validate_tree_ms", homeValidate);
  metric("code_split_diff_trees_ms", homeDiff);
  budget(load <= 0.8, `template verified loadPlacement ${load.toFixed(3)} ms exceeds the 0.8 ms budget`);
  budget(
    homeLoadVerified <= 5,
    `agent-home memoryStore verified loadPlacement ${homeLoadVerified.toFixed(3)} ms exceeds the 5 ms budget`,
  );
  budget(
    homeFileLoadVerified <= 5,
    `agent-home fileStore verified loadPlacement ${homeFileLoadVerified.toFixed(3)} ms exceeds the 5 ms budget`,
  );
  budget(
    homeVerifyVerified <= 2,
    `agent-home verified package check ${homeVerifyVerified.toFixed(3)} ms exceeds the 2 ms budget`,
  );
  budget(homeEquality <= 1.5, `agent-home package sameJson ${homeEquality.toFixed(3)} ms exceeds the 1.5 ms budget`);
} finally {
  await rm(homeDir, { recursive: true, force: true });
}
