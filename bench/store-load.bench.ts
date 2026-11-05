import { pack } from "../src/pack/index.ts";
import { loadPlacement, memoryStore, verifiedPackages } from "../src/store/index.ts";
import { obj, validateCatalog, validateCapabilities, type Result } from "../src/index.ts";
import catalogDoc from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../src/__tests__/fixtures/proof/capabilities.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const install = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
const pkg = value(
  pack(
    {
      files: { "entry.ts": 'throw new Error("must not execute"); export default () => null;' },
      entry: "entry.ts",
      manifest: {
        format: "liveframe-manifest/1",
        id: "bench",
        version: "1",
        catalogId: install.catalog.catalogId,
        params: obj({}),
        state: obj({}),
        initialState: {},
        context: obj({}),
        sources: {},
        actions: [],
      },
      scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
    },
    install,
  ),
);
const store = memoryStore();
await store.putPackage(pkg);
for (let i = 0; i < 100; i++)
  await store.putPlacement({ id: String(i), slot: "main", widget: { id: "bench", version: "1" }, params: {} });

for (const cached of [false, true]) {
  const cache = verifiedPackages();
  let misses = 0;
  const verified = {
    get: cache.get,
    set(key: string, verified: typeof pkg) {
      misses++;
      cache.set(key, verified);
    },
  };
  const start = performance.now();
  let first: typeof pkg | undefined;
  for (let i = 0; i < 100; i++) {
    const loaded = value(await loadPlacement(store, String(i), install, cached ? { verified } : {}));
    if (cached && first && loaded.package !== first) throw new Error("Cache did not reuse verified package");
    first = loaded.package;
  }
  const ms = performance.now() - start;
  const verifications = cached ? misses : 100;
  if (cached && verifications !== 1) throw new Error(`Expected one verification, got ${verifications}`);
  // Counts follow the load path: one fresh hash per load, plus verifyPackage's hash on each cache miss.
  const hashes = cached ? 100 + misses : 100;
  console.log(JSON.stringify({ cached, placements: 100, verifications, hashes, ms }));
}
