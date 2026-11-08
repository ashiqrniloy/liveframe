// Plan 030 T2-T4: pipeline overhead of renderPlacement and handleIntent beyond the injected calls (budget 0.2 ms), and dependents over 1,000 placements.

import capabilitiesDoc from "../examples/demo-host/capabilities.json" with { type: "json" };
import catalogDoc from "../examples/demo-host/catalog.json" with { type: "json" };
import { dependents, handleIntent, renderPlacement, type Served } from "../src/host/index.ts";
import { bindSources, diffTrees, obj, type Result, str, validateCapabilities, validateCatalog } from "../src/index.ts";
import { renderKey } from "../src/pack/hash.ts";
import { pack } from "../src/pack/index.ts";
import { templateRunner } from "../src/preview/index.ts";
import type { Runner } from "../src/preview/runner.ts";
import { loadPlacement, memoryStore, verifiedPackages } from "../src/store/index.ts";
import { budget, metric } from "./metrics.ts";

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
const install = { catalog: value(validateCatalog(catalogDoc)), capabilities };
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

const N = 3000;
async function time(run: (i: number) => Promise<unknown> | unknown): Promise<number> {
  for (let i = 0; i < 300; i++) await run(i);
  // CPU time, not wall time: a busy machine must not decide a per-call budget.
  const start = process.cpuUsage();
  for (let i = 0; i < N; i++) await run(i);
  const used = process.cpuUsage(start);
  return (used.user + used.system) / 1000 / N;
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
