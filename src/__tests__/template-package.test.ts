import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pack, verifyPackage, type WidgetPackage } from "@arnilo/liveframe/pack";
import type { WidgetProps } from "@arnilo/liveframe/sdk";
import { loadPlacement, memoryStore } from "@arnilo/liveframe/store";
import { type Json, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { canonicalJson, packageHash, renderKey } from "../pack/hash.ts";
import { inProcessRunner, templateRunner } from "../preview/index.ts";
import type { RunnerOptions } from "../preview/runner.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { cachedValidatorCount } from "../runner-kit/cache.ts";
import { renderTemplatePackage } from "../runner-kit/index.ts";
import { fileStore } from "../store/fs/index.ts";
import type { Template } from "../template/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const install = { catalog, capabilities };
const widget = proofWidgets[0];
if (!widget) throw new Error("Missing agent-home fixture");
const scenarios = widget.scenarios;
const first = scenarios[0] as WidgetProps & { name: string };
const draft = { template: agentHomeTemplate, manifest: widget.manifest, scenarios };
const runnerOptions: RunnerOptions = { ...install, surfaceId: "home", revision: 3 };
const templatePackage = value(pack(draft, install));
const codePackage = value(pack(drafts[0] as NonNullable<(typeof drafts)[number]>, install));

function rejects(result: Result<unknown>, kind: string, pointer: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ kind, pointer }));
}

/** The agent-home template with one JSON string replaced: a deep copy that is still a template. */
function mutated(from: string, to: string): Template {
  const text = JSON.stringify(agentHomeTemplate);
  expect(text).toContain(from);
  return JSON.parse(text.replace(from, to)) as Template;
}

/** A hand-built package, as a hostile store could hold: rehashed so only verification can refuse it. */
function handBuilt(template: Template): WidgetPackage {
  const body = { format: "liveframe-package/1" as const, manifest: widget?.manifest, scenarios, template };
  return { ...body, hash: packageHash(body as Omit<WidgetPackage, "hash">) } as WidgetPackage;
}

test("package_requires_exactly_one_of_code_or_template", () => {
  const both = { ...templatePackage, code: "export default () => null;" };
  rejects(verifyPackage(both, install), "invalid-document", "/code");
  const { template: _, ...neither } = templatePackage;
  rejects(verifyPackage(neither, install), "invalid-document", "/code");
  expect(verifyPackage(codePackage, install).ok).toBe(true);
});

test("pack_template_returns_a_frozen_verified_package", () => {
  expect(templatePackage.code).toBeUndefined();
  expect(templatePackage.template).toEqual(agentHomeTemplate);
  expect(Object.isFrozen(templatePackage)).toBe(true);
  expect(Object.isFrozen(templatePackage.template)).toBe(true);
  expect(templatePackage.hash).toBe(packageHash(templatePackage));
  expect(verifyPackage(JSON.parse(JSON.stringify(templatePackage)), install).ok).toBe(true);
});

test("template_hash_covers_the_template", () => {
  const inbox = value(pack({ ...draft, template: mutated('"Queue"', '"Inbox"') }, install));
  expect(inbox.hash).not.toBe(templatePackage.hash);
  // A package whose template changed after packing no longer matches its hash.
  const tampered = { ...JSON.parse(JSON.stringify(templatePackage)), template: inbox.template };
  rejects(verifyPackage(tampered, install), "hash-mismatch", "/hash");
  // The hash is of {format, manifest, scenarios, template}, with no `code` member.
  const body = { format: templatePackage.format, manifest: templatePackage.manifest, scenarios };
  expect(packageHash({ ...body, template: agentHomeTemplate } as Omit<WidgetPackage, "hash">)).toBe(
    templatePackage.hash,
  );
  expect(canonicalJson({ ...body, template: agentHomeTemplate })).not.toContain('"code"');
});

test("pack_template_reports_template_errors_under_template", () => {
  const result = pack({ ...draft, template: mutated('"data.checked"', '"data.nothing"') }, install);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors.length).toBeGreaterThan(0);
    for (const error of result.errors) expect(error.pointer.startsWith("/template")).toBe(true);
    expect(result.errors.map((error) => error.kind)).toContain("unknown-name");
  }
});

test("pack_template_checks_scenarios_and_shape", () => {
  rejects(pack({ ...draft, scenarios: [] }, install), "invalid-document", "/scenarios");
  rejects(
    pack({ ...draft, template: { format: "liveframe-template/2" } }, install),
    "invalid-document",
    "/template/format",
  );
  rejects(pack({ ...draft, template: "x" }, install), "invalid-document", "/template");
});

test("template_runner_refuses_code_package", async () => {
  const result = await templateRunner().render(codePackage, first, runnerOptions);
  expect(result).toMatchObject({
    ok: false,
    errors: [{ kind: "invalid-document", pointer: "/code", message: "templateRunner renders template packages only" }],
  });
});

test("template_runner_refuses_a_tampered_package", async () => {
  const tampered = { ...templatePackage, hash: `sha256-${"0".repeat(64)}` };
  rejects(await templateRunner().render(tampered, first, runnerOptions), "hash-mismatch", "/hash");
});

test("all_runners_agree_on_template_trees", async () => {
  const worker = workerRunner();
  try {
    for (const scenario of scenarios) {
      const inputs = scenario as WidgetProps;
      const results: Result<unknown>[] = [
        await templateRunner().render(templatePackage, inputs, runnerOptions),
        await inProcessRunner().render(templatePackage, inputs, runnerOptions),
        await worker.render(templatePackage, inputs, runnerOptions),
        renderTemplatePackage(templatePackage.template as Template, inputs, {
          ...runnerOptions,
          manifest: templatePackage.manifest,
        }),
      ];
      const expected = canonicalJson(value(results[0] as Result<unknown>));
      for (const result of results) expect(canonicalJson(value(result))).toBe(expected);
    }
  } finally {
    worker.close();
  }
}, 30000);

test("worker_runs_template_packages_beyond_its_package_limit", async () => {
  const worker = workerRunner({ maxPackages: 1 });
  try {
    expect((await worker.render(codePackage, first, runnerOptions)).ok).toBe(true);
    for (let revision = 0; revision < 3; revision++)
      expect((await worker.render(templatePackage, first, { ...runnerOptions, revision })).ok).toBe(true);
    expect((await worker.render(codePackage, first, runnerOptions)).ok).toBe(true);
  } finally {
    worker.close();
  }
}, 30000);

test("in_process_template_render_loads_no_module", async () => {
  const runner = inProcessRunner({ maxModules: 0 });
  expect(runner.stats().modules).toBeGreaterThanOrEqual(0);
  expect((await runner.render(templatePackage, first, runnerOptions)).ok).toBe(true);
  // A code package whose module is not loaded is refused at the module bound; a template package is not.
  const code = `${codePackage.code}\n// not loaded`;
  const unloaded = { ...codePackage, code, hash: packageHash({ ...codePackage, code }) };
  expect(await runner.render(unloaded, first, runnerOptions)).toMatchObject({
    ok: false,
    errors: [{ kind: "limit-exceeded" }],
  });
});

test("template_runner_honours_limits_steps", async () => {
  const result = await templateRunner().render(templatePackage, first, { ...runnerOptions, limits: { steps: 50 } });
  expect(result).toMatchObject({ ok: false, errors: [{ kind: "limit-exceeded" }] });
  expect((await templateRunner().render(templatePackage, first, runnerOptions)).ok).toBe(true);
});

test("template_runner_reuses_one_validator_per_package", async () => {
  const runner = templateRunner();
  await runner.render(templatePackage, first, runnerOptions);
  const count = cachedValidatorCount(catalog, capabilities);
  for (let i = 0; i < 3; i++) await runner.render(templatePackage, first, { ...runnerOptions, revision: i });
  expect(cachedValidatorCount(catalog, capabilities)).toBe(count);
});

test("template_runner_reaches_no_globals", async () => {
  // The install check refuses a path into a global...
  for (const path of ["globalThis.process", "process.env", "constructor.constructor", "data.__proto__"]) {
    expect(pack({ ...draft, template: mutated('"data.checked"', `"${path}"`) }, install).ok).toBe(false);
  }
  // ...and a package that skips the install check (a hostile store) still reads nothing from the realm.
  const hostile = handBuilt({
    format: "liveframe-template/1",
    root: { kind: "text", props: { text: { $path: "globalThis.process.version" } } },
  } as Template);
  const result = await templateRunner().render(hostile, first, runnerOptions);
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain(process.version);
});

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function placed(store: ReturnType<typeof memoryStore>) {
  await store.putPackage(templatePackage);
  await store.putPlacement({
    id: "home",
    slot: "main",
    widget: { id: templatePackage.manifest.id, version: templatePackage.manifest.version },
    params: first.params as Json,
  });
  return loadPlacement(store, "home", install);
}

test("template_package_round_trips_through_memoryStore", async () => {
  const loaded = value(await placed(memoryStore()));
  expect(loaded.package.hash).toBe(templatePackage.hash);
  expect(loaded.package.template).toEqual(agentHomeTemplate);
  const tree = value(await templateRunner().render(loaded.package, { ...first, params: loaded.params }, runnerOptions));
  expect(tree.root).toBeDefined();
});

test("template_package_round_trips_through_fileStore", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-template-"));
  dirs.push(dir);
  const loaded = value(await placed(fileStore(dir) as ReturnType<typeof memoryStore>));
  expect(loaded.package.template).toEqual(agentHomeTemplate);
  const reopened = value(await loadPlacement(fileStore(dir), "home", install));
  expect(reopened.package.hash).toBe(templatePackage.hash);
});

test("store_refuses_a_second_template_hash_under_one_version", async () => {
  const store = memoryStore();
  await store.putPackage(templatePackage);
  const other = value(pack({ ...draft, template: mutated('"Queue"', '"Inbox"') }, install));
  await expect(store.putPackage(other)).rejects.toMatchObject({ errors: [{ kind: "version-conflict" }] });
});

test("render_key_distinguishes_template_packages", () => {
  const keyed = (hash: string) =>
    renderKey({
      hash,
      catalogId: templatePackage.manifest.catalogId,
      params: first.params,
      state: first.state ?? templatePackage.manifest.initialState,
      data: first.data,
      context: first.context,
    });
  expect(keyed(templatePackage.hash)).not.toBe(keyed(codePackage.hash));
});
