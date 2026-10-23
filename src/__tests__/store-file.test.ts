import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pack } from "@arnilo/liveframe/pack";
import { loadPlacement } from "@arnilo/liveframe/store";
import { fileStore } from "../store/fs/index.ts";
import { obj, validateCatalog, validateCapabilities } from "../index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/proof/capabilities.json" with { type: "json" };
import { pkg, placement, storeContract } from "./store-contract.ts";

const dirs: string[] = [];
async function directory() {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-store-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
storeContract("file", async () => fileStore(await directory()));

test("file_store_survives_reopen", async () => {
  const dir = join(await directory(), "new", "store");
  const store = fileStore(dir);
  const style = { kind: "designSystem" as const, id: "Rack", version: "1.0", body: {} };
  await store.putPackage(pkg);
  await store.putPlacement(placement);
  await store.putState(placement.id, { count: 3 });
  await store.putStyle(style);
  const reopened = fileStore(dir);
  expect(await reopened.getPackage(pkg.manifest.id, pkg.manifest.version)).toEqual(pkg);
  expect(await reopened.listPlacements()).toEqual([placement]);
  expect(await reopened.getState(placement.id)).toEqual({ count: 3 });
  expect(await reopened.getStyle(style.kind, style.id, style.version)).toEqual(style);
});

test("file_store_paths_cannot_escape", async () => {
  const dir = await directory();
  const store = fileStore(dir);
  const ids = ["../x", "a/b", "CON", "Queue", "queue", "é😀", "%2E", "a\\b"];
  const encoded = ["%2E%2E%2Fx", "a%2Fb", "%43%4F%4E", "%51ueue", "queue", "%C3%A9%F0%9F%98%80", "%252%45", "a%5Cb"];
  for (const id of ids) {
    await store.putPackage({ ...pkg, manifest: { ...pkg.manifest, id, version: id } });
    await store.putPlacement({ ...placement, id });
    await store.putState(id, id);
    await store.putStyle({ kind: "theme", id, version: id, body: id });
  }
  expect((await readdir(join(dir, "placements"))).sort()).toEqual(encoded.map((id) => `${id}.json`).sort());
  expect(new Set(encoded.map((id) => id.toLowerCase())).size).toBe(ids.length);
  for (const [i, id] of ids.entries()) {
    expect(await store.getPackage(id, id)).toMatchObject({ manifest: { id, version: id } });
    expect(await store.getState(id)).toBe(id);
    expect(await store.getStyle("theme", id, id)).toMatchObject({ body: id });
    expect(await Bun.file(join(dir, "packages", encoded[i]!, `${encoded[i]}.json`)).exists()).toBe(true);
  }
  expect((await readdir(dir)).sort()).toEqual(["packages", "placements", "states", "styles"]);
});

test("corrupt_file_is_typed_error", async () => {
  const dir = await directory();
  const store = fileStore(dir);
  await store.putPlacement(placement);
  const path = join(dir, "placements", "home.json");
  await writeFile(path, '{"id":');
  const catalog = validateCatalog(catalogDoc);
  const capabilities = validateCapabilities(capabilitiesDoc);
  if (!catalog.ok || !capabilities.ok) throw new Error("Invalid fixture");
  const result = await loadPlacement(store, "home", { catalog: catalog.value, capabilities: capabilities.value });
  expect(result).toEqual({
    ok: false,
    errors: [expect.objectContaining({ kind: "invalid-document", message: expect.stringContaining(path) })],
  });
  for (const record of ["states/home.json", "packages/test/1.json", "styles/theme/test/1.json"]) {
    const file = join(dir, record);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, "{");
  }
  await expect(store.getState("home")).rejects.toMatchObject({ kind: "invalid-document" });
  await expect(store.getPackage("test", "1")).rejects.toMatchObject({ kind: "invalid-document" });
  await expect(store.getStyle("theme", "test", "1")).rejects.toMatchObject({ kind: "invalid-document" });
  const options = { catalog: catalog.value, capabilities: capabilities.value };
  const packed = pack(
    {
      files: { "entry.ts": "export default () => null;" },
      entry: "entry.ts",
      manifest: {
        ...pkg.manifest,
        id: "test",
        version: "1",
        params: obj({}),
        state: obj({}),
        initialState: {},
        context: obj({}),
        sources: {},
        actions: [],
      },
      scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
    },
    options,
  );
  if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
  await store.putPlacement({ ...placement, widget: { id: "test", version: "1" }, params: {} });
  // Parse failures in either package or state must fail the load, rather than reset state.
  for (const record of ["packages/test/1.json", "states/home.json"]) {
    const result = await loadPlacement(store, "home", options);
    expect(result).toEqual({
      ok: false,
      errors: [expect.objectContaining({ kind: "invalid-document", message: expect.stringContaining(record) })],
    });
    await writeFile(join(dir, record), JSON.stringify(record.startsWith("packages/") ? packed.value : {}));
  }
  expect((await loadPlacement(store, "home", options)).ok).toBe(true);
});

test("file_store_ignores_leftover_temps_and_replaces_complete_records", async () => {
  const dir = await directory();
  const store = fileStore(dir);
  await store.putPlacement(placement);
  await writeFile(join(dir, "placements", "home.json.leftover.tmp"), "{");
  expect(await store.listPlacements()).toEqual([placement]);
  await Promise.all(Array.from({ length: 20 }, (_, n) => store.putState("home", { n, payload: "x".repeat(10000) })));
  expect(await store.getState("home")).toMatchObject({ payload: "x".repeat(10000) });
  expect(await readdir(join(dir, "states"))).toEqual(["home.json"]);
  const results = await Promise.allSettled([
    store.putPackage(pkg),
    fileStore(dir).putPackage({ ...pkg, hash: `sha256-${"1".repeat(64)}` }),
  ]);
  expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
  expect(await store.getPackage(pkg.manifest.id, pkg.manifest.version)).toEqual(pkg);
});

test("file_store_readers_only_see_complete_replacements", async () => {
  const dir = await directory();
  const store = fileStore(dir);
  const old = { payload: "old".repeat(100000) };
  const next = { payload: "new".repeat(100000) };
  await store.putState("home", old);
  const replacing = store.putState("home", next);
  for (let i = 0; i < 20; i++) {
    expect<unknown[]>([old, next]).toContainEqual(await fileStore(dir).getState("home"));
  }
  await replacing;
  expect(await store.getState("home")).toEqual(next);
  // A failed rename must leave no partial record or temporary file behind.
  await mkdir(join(dir, "states", "blocked.json"));
  await expect(store.putState("blocked", next)).rejects.toBeDefined();
  expect((await readdir(join(dir, "states"))).sort()).toEqual(["blocked.json", "home.json"]);
});
