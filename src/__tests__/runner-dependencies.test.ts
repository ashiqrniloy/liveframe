import { expect, test } from "bun:test";
import { renderPlacement } from "@arnilo/liveframe/host";
import { linkPackage } from "@arnilo/liveframe/runner-kit";
import { type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { packageHash } from "../pack/hash.ts";
import { pack, type WidgetPackage } from "../pack/index.ts";
import { inProcessRunner } from "../preview/index.ts";
import { isModuleLoaded } from "../preview/load.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { loadPlacement, memoryStore, verifiedPackages } from "../store/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
function rejects(result: Result<unknown>, kind: string, pointer?: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors[0]).toMatchObject({ kind, ...(pointer ? { pointer } : {}) });
}

const install = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
const ui = await Bun.file(new URL("./fixtures/widgets/ui.gen.ts", import.meta.url)).text();
const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
const scenarios = [{ name: "ready", params: {}, context: {}, data: {} }];
const manifest = (id: string, version: string, extra: Record<string, unknown> = {}) => ({
  format: "liveframe-manifest/1",
  id,
  version,
  catalogId: "proof.ui@1",
  params: empty,
  state: empty,
  context: empty,
  initialState: {},
  sources: {},
  actions: [],
  ...extra,
});
const header = '/** @jsxImportSource @arnilo/liveframe/sdk */\nimport { Stack, Text } from "./ui.gen.ts";\n';
// A marker per call keeps every package's hash, and so its module, distinct.
let sequence = 0;
const tag = () => `t${++sequence}`;

function library(version = "1.0.0", marker = "LIB") {
  const source = `${header}
export function Badge({ label }: { label: string }) { return <Text text={\`${marker}-${tag()} \${label}\`} />; }
export default function Gallery() { return <Badge label="gallery" />; }
`;
  return value(
    pack(
      {
        files: { "ui.gen.ts": ui, "lib.tsx": source },
        entry: "lib.tsx",
        manifest: manifest("acme.cards", version, { exports: ["Badge"] }),
        scenarios,
      },
      install,
    ),
  );
}
function widget(libraries: readonly WidgetPackage[], id = "acme.home") {
  const source = `${header.replace("Stack, Text", "Stack")}import { Badge } from "liveframe:lib/acme.cards@${libraries[0]?.manifest.version}";
// ${tag()}
export default function Home() { return <Stack><Badge label="new" /></Stack>; }
`;
  return value(
    pack(
      {
        files: { "ui.gen.ts": ui, "entry.tsx": source },
        entry: "entry.tsx",
        manifest: manifest(id, "1.0.0"),
        scenarios,
      },
      { ...install, libraries },
    ),
  );
}
const options = { ...install, surfaceId: "s", revision: 1 };
const texts = (tree: unknown) => JSON.stringify(tree).match(/LIB-t\d+ new/g);

test("link_rewrites_library_header_lines", () => {
  const lib = library();
  const dep = widget([lib]);
  const code = dep.code as string;
  const library0 = `import * as __lf_lib0 from "liveframe:lib/acme.cards@1.0.0";`;
  expect(code).toContain(library0);
  const seen: string[] = [];
  const linked = value(
    linkPackage(code, (specifier) => {
      seen.push(specifier);
      return `sandbox:${specifier}`;
    }),
  );
  expect(seen).toContain("liveframe:lib/acme.cards@1.0.0");
  expect(linked).toContain('import * as __lf_lib0 from "sandbox:liveframe:lib/acme.cards@1.0.0";');
  expect(linked.replaceAll("sandbox:", "")).toBe(code);
  // The same bytes follow the header, and malformed library lines are errors, not guesses.
  for (const bad of [
    'import * as __lf_lib1 from "liveframe:lib/acme.cards@1.0.0";',
    'import * as __lf_lib0 from "liveframe:other/acme.cards@1.0.0";',
    `${library0}\n${library0.replace("lib0", "lib1")}`,
    'import * as __lf_lib0  from "liveframe:lib/acme.cards@1.0.0";',
  ])
    rejects(
      linkPackage(bad, (s) => s),
      "invalid-document",
      "/code",
    );
});

test("runner_loads_library_before_dependent", async () => {
  const lib = library();
  const dep = widget([lib]);
  expect(isModuleLoaded(lib.hash)).toBe(false);
  const tree = value(
    await inProcessRunner().render(
      dep,
      { params: {}, state: {}, context: {}, data: {}, actions: {} },
      { ...options, libraries: [lib] },
    ),
  );
  expect(texts(tree)).toHaveLength(1);
  expect(isModuleLoaded(lib.hash)).toBe(true);
  expect(isModuleLoaded(dep.hash)).toBe(true);
});

test("in_process_counts_libraries_toward_max_modules", async () => {
  const lib = library();
  const dep = widget([lib]);
  const inputs = { params: {}, state: {}, context: {}, data: {}, actions: {} };
  const stats = inProcessRunner().stats().modules;
  const refusing = inProcessRunner({ maxModules: stats + 1 });
  rejects(await refusing.render(dep, inputs, { ...options, libraries: [lib] }), "limit-exceeded");
  expect(isModuleLoaded(lib.hash)).toBe(false);
  expect(
    (await inProcessRunner({ maxModules: stats + 2 }).render(dep, inputs, { ...options, libraries: [lib] })).ok,
  ).toBe(true);
});

test("pin_mismatch_hash_mismatch", async () => {
  const lib = library();
  const dep = widget([lib]);
  const other = library(); // the same (id, version) with different content: another hash
  expect(other.hash).not.toBe(lib.hash);
  const inputs = { params: {}, state: {}, context: {}, data: {}, actions: {} };
  const worker = workerRunner({ timeoutMs: 3000 });
  try {
    for (const runner of [inProcessRunner(), worker])
      rejects(
        await runner.render(dep, inputs, { ...options, libraries: [other] }),
        "hash-mismatch",
        "/manifest/dependencies/0/hash",
      );
    // A library whose content no longer matches its own hash is refused before it loads.
    const tampered = { ...lib, code: `${lib.code}\n// tampered` } as WidgetPackage;
    for (const runner of [inProcessRunner(), worker])
      rejects(await runner.render(dep, inputs, { ...options, libraries: [tampered] }), "hash-mismatch");
    expect(isModuleLoaded(other.hash)).toBe(false);
  } finally {
    worker.close();
  }
});

test("missing_library_not_found", async () => {
  const dep = widget([library()]);
  const inputs = { params: {}, state: {}, context: {}, data: {}, actions: {} };
  const worker = workerRunner({ timeoutMs: 3000 });
  try {
    for (const runner of [inProcessRunner(), worker]) {
      rejects(await runner.render(dep, inputs, options), "not-found", "/manifest/dependencies/0");
      rejects(await runner.render(dep, inputs, { ...options, libraries: [] }), "not-found", "/manifest/dependencies/0");
    }
  } finally {
    worker.close();
  }
});

test("both_runners_agree_with_libraries", async () => {
  const lib = library();
  const dep = widget([lib]);
  const inputs = { params: {}, state: {}, context: {}, data: {}, actions: {} };
  const worker = workerRunner({ timeoutMs: 3000, maxPackages: 2 });
  try {
    const a = value(await inProcessRunner().render(dep, inputs, { ...options, libraries: [lib] }));
    const b = value(await worker.render(dep, inputs, { ...options, libraries: [lib] }));
    expect(b).toEqual(a);
    expect(texts(b)).toHaveLength(1);
    // The library counts toward the worker's package bound: two modules fill maxPackages 2, so a third restarts it.
    const lib2 = library("1.0.0");
    const dep2 = widget([lib2], "acme.other");
    expect((await worker.render(dep2, inputs, { ...options, libraries: [lib2] })).ok).toBe(true);
    expect((await worker.render(dep, inputs, { ...options, libraries: [lib] })).ok).toBe(true);
  } finally {
    worker.close();
  }
}, 30000);

async function stored(lib: WidgetPackage, dep: WidgetPackage) {
  const store = memoryStore();
  await store.putPackage(dep);
  await store.putPackage(lib);
  await store.putPlacement({
    id: "p",
    slot: "main",
    widget: { id: dep.manifest.id, version: dep.manifest.version },
    params: {},
  });
  return store;
}

test("load_placement_returns_pinned_libraries", async () => {
  const lib = library();
  const dep = widget([lib]);
  const store = await stored(lib, dep);
  const cache = verifiedPackages();
  const loaded = value(await loadPlacement(store, "p", install, { verified: cache }));
  expect(loaded.libraries?.map((item) => item.hash)).toEqual([lib.hash]);
  // The cache covers libraries: a second load returns the very objects it verified before.
  const again = value(await loadPlacement(store, "p", install, { verified: cache }));
  expect(again.libraries?.[0]).toBe(loaded.libraries?.[0]);
  // A package with no dependencies reports no `libraries` field at all.
  const plain = await stored(lib, lib);
  expect("libraries" in value(await loadPlacement(plain, "p", install))).toBe(false);
});

test("load_placement_pin_mismatch_and_missing_library", async () => {
  const lib = library();
  const dep = widget([lib]);
  rejects(
    await loadPlacement(await stored(library(), dep), "p", install),
    "hash-mismatch",
    "/manifest/dependencies/0/hash",
  );
  const store = memoryStore();
  await store.putPackage(dep);
  await store.putPlacement({ id: "p", slot: "main", widget: { id: dep.manifest.id, version: "1.0.0" }, params: {} });
  rejects(await loadPlacement(store, "p", install), "not-found", "/manifest/dependencies/0");
  // A stored library that was altered after hashing fails verification and never loads.
  const forged = { ...lib, hash: packageHash({ ...lib, code: "x" } as WidgetPackage) } as WidgetPackage;
  const bad = await stored(forged, dep);
  expect((await loadPlacement(bad, "p", install)).ok).toBe(false);
});

test("render_placement_passes_libraries_to_the_runner", async () => {
  const lib = library();
  const dep = widget([lib]);
  const store = await stored(lib, dep);
  const served = value(
    await renderPlacement({
      store,
      runner: inProcessRunner(),
      installs: { "proof.ui@1": install },
      resolve: async () => ({}),
      placementId: "p",
      catalogId: "proof.ui@1",
      viewer: "v",
      context: {},
    } as never),
  );
  expect(texts(served.tree)).toHaveLength(1);
});
