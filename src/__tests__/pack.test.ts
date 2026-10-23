import { expect, test } from "bun:test";
import { pack, type Scenario, type WidgetPackage, verifyPackage } from "@arnilo/liveframe/pack";
import { type Result, obj, str, validateCatalog, validateCapabilities } from "../index.ts";
import { packageHash } from "../pack/hash.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities };
const fixture = proofWidgets[0];
if (!fixture) throw new Error("Missing agent-home fixture");
const root = new URL("./fixtures/widgets/", import.meta.url);
const paths = [
  "ui.gen.ts",
  ...["queue", "task-card", "decision-card", "alert-card", "facts", "queue-row"].map(
    (name) => `agent-home/${name}.tsx`,
  ),
];
const files = Object.fromEntries(
  await Promise.all(paths.map(async (path) => [path, await Bun.file(new URL(path, root)).text()] as const)),
);
files["agent-home/queue.tsx"] += "\nexport default AgentHomeQueue;";
const scenarios = fixture.scenarios as readonly Scenario[];
const input = { files, entry: "agent-home/queue.tsx", manifest: fixture.manifest, scenarios };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function rejects(result: Result<unknown>, kind: string, pointer: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors).toContainEqual(expect.objectContaining({ kind, pointer }));
    expect(result.errors.length).toBeLessThanOrEqual(20);
  }
}

test("pack_is_reproducible", () => {
  const first = value(pack(input, options));
  const second = value(pack({ ...input, files: Object.fromEntries(Object.entries(files).reverse()) }, options));
  expect(second).toEqual(first);
  expect(first.hash).toBe(packageHash(first));
  expect(value(verifyPackage(first, options))).toEqual(first);
});

test("pack_rejections", () => {
  const manifest = value(pack(input, options)).manifest;
  const scenario = scenarios[0];
  if (!scenario) throw new Error("Missing scenario");
  rejects(
    pack(
      { ...input, files: { "entry.ts": 'import "node:fs"; export default () => null;' }, entry: "entry.ts" },
      options,
    ),
    "forbidden-import",
    "/files/entry.ts/1",
  );
  rejects(
    pack({ ...input, manifest: { ...manifest, initialState: null } }, options),
    "invalid-document",
    "/manifest/initialState",
  );
  rejects(pack({ ...input, scenarios: [] }, options), "invalid-document", "/scenarios");
  rejects(pack({ ...input, scenarios: [scenario, scenario] }, options), "invalid-document", "/scenarios/1/name");
  rejects(
    pack({ ...input, scenarios: Array.from({ length: 65 }, (_, i) => ({ ...scenario, name: String(i) })) }, options),
    "invalid-document",
    "/scenarios",
  );
  for (const field of ["params", "state", "context"] as const) {
    rejects(
      pack({ ...input, scenarios: [{ ...scenario, [field]: null }] }, options),
      "invalid-document",
      `/scenarios/0/${field}`,
    );
  }
  rejects(
    pack({ ...input, scenarios: [{ ...scenario, data: { ...scenario.data, status: 3 } }] }, options),
    "invalid-document",
    "/scenarios/0/data/status",
  );
  rejects(
    pack({ ...input, scenarios: [{ ...scenario, data: {} }] }, options),
    "invalid-document",
    "/scenarios/0/data/status",
  );
  rejects(
    pack({ ...input, scenarios: [{ ...scenario, data: { ...scenario.data, extra: true } }] }, options),
    "invalid-document",
    "/scenarios/0/data/extra",
  );
  rejects(
    pack({ ...input, manifest: { ...manifest, catalogId: "other@1" } }, options),
    "catalog-mismatch",
    "/manifest/catalogId",
  );
  rejects(
    pack({ ...input, files: { "entry.ts": "export default (" }, entry: "entry.ts" }, options),
    "transpile-failed",
    "/files/entry.ts/1",
  );
});

test("scenario_defaults_and_capability_result_schemas", () => {
  const manifest = value(pack(input, options)).manifest;
  const scenario = scenarios[0];
  if (!scenario) throw new Error("Missing scenario");
  const { state: _state, ...withoutState } = scenario;
  expect(pack({ ...input, scenarios: [withoutState] }, options).ok).toBe(true);
  const source = capabilities.sources["queue.status"];
  if (!source) throw new Error("Missing queue.status capability");
  const changed = {
    ...capabilities,
    sources: {
      ...capabilities.sources,
      "queue.status": { ...source, result: str({ maxLength: 10, enum: ["different"] }) },
    },
  };
  rejects(
    pack({ ...input, manifest }, { catalog, capabilities: changed }),
    "invalid-document",
    "/scenarios/0/data/status",
  );
});

test("verify_detects_tampering", () => {
  const pkg = value(pack(input, options));
  for (const tampered of [
    { ...pkg, code: `${pkg.code}\n// changed` },
    { ...pkg, scenarios: pkg.scenarios.map((scenario) => ({ ...scenario, name: `${scenario.name}-changed` })) },
    { ...pkg, manifest: { ...pkg.manifest, version: "changed" } },
  ])
    rejects(verifyPackage(tampered, options), "hash-mismatch", "/hash");
  for (const statement of [
    'import "node:fs";',
    'export * from "lodash";',
    'import "./other.js";',
    'function hidden() { require?.("x"); }',
    'function hidden() { return import("x"); }',
    "const url = import.meta.url;",
  ]) {
    const tampered = { ...pkg, code: `${statement}\nexport default () => null;` };
    rejects(verifyPackage({ ...tampered, hash: packageHash(tampered) }, options), "forbidden-import", "/code/1");
  }
  const syntax = { ...pkg, code: "export default (" };
  rejects(verifyPackage({ ...syntax, hash: packageHash(syntax) }, options), "transpile-failed", "/code/1");
});

test("pack_and_verify_never_execute", () => {
  const marker = globalThis as typeof globalThis & { __lfPackageRan?: boolean };
  const code = 'globalThis.__lfPackageRan = true; throw new Error("executed"); export default () => null;';
  const pkg = value(pack({ ...input, files: { "entry.ts": code }, entry: "entry.ts" }, options));
  expect(verifyPackage(pkg, options).ok).toBe(true);
  const handwritten = { ...pkg, code };
  expect(verifyPackage({ ...handwritten, hash: packageHash(handwritten) }, options).ok).toBe(true);
  expect(marker.__lfPackageRan).toBeUndefined();
});

test("package_failures_are_bounded_and_fail_closed", () => {
  const pkg = value(pack(input, options));
  for (const doc of [null, {}, { ...pkg, format: "wrong" }, { ...pkg, scenarios: null }, { ...pkg, manifest: null }]) {
    expect(verifyPackage(doc, options).ok).toBe(false);
  }
  const scenario = pkg.scenarios[0];
  if (!scenario) throw new Error("Missing scenario");
  const bad = {
    ...pkg,
    scenarios: Array.from({ length: 30 }, (_, i) => ({ ...scenario, name: String(i), params: null })),
  };
  const rejected = verifyPackage(bad, options);
  expect(rejected.ok).toBe(false);
  if (!rejected.ok) {
    expect(rejected.errors).toHaveLength(20);
    expect(rejected.errors.every((error) => error.kind === "invalid-document")).toBe(true);
  }
  const unicode = { ...pkg, scenarios: [{ ...scenario, name: "\ud800" }] };
  rejects(verifyPackage(unicode, options), "invalid-document", "");
  rejects(pack({ ...input, scenarios: unicode.scenarios }, options), "invalid-document", "");
  const nonJson = { ...pkg, scenarios: [{ ...scenario, params: { bad: undefined } }] };
  expect(verifyPackage(nonJson, options).ok).toBe(false);
  const oversized = { ...pkg, code: " ".repeat(1048577) };
  rejects(verifyPackage(oversized, options), "invalid-document", "/code");
  rejects(
    pack(
      { ...input, files: { "entry.ts": `export default ${JSON.stringify("x".repeat(1048576))};` }, entry: "entry.ts" },
      options,
    ),
    "invalid-document",
    "/code",
  );
});

test("verify_rechecks_manifest_and_scenarios", () => {
  const pkg = value(pack(input, options));
  rejects(
    verifyPackage({ ...pkg, manifest: { ...pkg.manifest, catalogId: "other@1" } }, options),
    "catalog-mismatch",
    "/manifest/catalogId",
  );
  rejects(
    verifyPackage({ ...pkg, manifest: { ...pkg.manifest, initialState: null } }, options),
    "invalid-document",
    "/manifest/initialState",
  );
  rejects(
    verifyPackage({ ...pkg, scenarios: pkg.scenarios.map((scenario) => ({ ...scenario, data: {} })) }, options),
    "invalid-document",
    "/scenarios/0/data/status",
  );
  // The schema compiler must preserve escaped pointers in scenario errors.
  const manifest = { ...pkg.manifest, params: obj({ "a/~": str({ maxLength: 5 }) }) };
  const scenario = pkg.scenarios[0];
  if (!scenario) throw new Error("Missing scenario");
  rejects(
    verifyPackage({ ...pkg, manifest, scenarios: [{ ...scenario, params: { "a/~": false } }] }, options),
    "invalid-document",
    "/scenarios/0/params/a~1~0",
  );
});

test("verify_agent_home_under_20_ms", () => {
  const pkg: WidgetPackage = value(pack(input, options));
  for (let i = 0; i < 5; i++) value(verifyPackage(pkg, options));
  const start = performance.now();
  value(verifyPackage(pkg, options));
  const elapsed = performance.now() - start;
  console.info(`agent-home package verification: ${elapsed.toFixed(2)} ms`);
  expect(elapsed).toBeLessThan(20);
});
