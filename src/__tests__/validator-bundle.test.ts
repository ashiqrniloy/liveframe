import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContext, runInContext, runInNewContext, SourceTextModule } from "node:vm";
import * as liveframe from "@arnilo/liveframe";
import capabilities from "../../conformance/corpus/common/capabilities.json" with { type: "json" };
import system from "../../conformance/corpus/common/design-system.json" with { type: "json" };
import manifest from "../../conformance/corpus/common/manifest.json" with { type: "json" };
import pkg from "../../conformance/corpus/common/package.json" with { type: "json" };
import catalog from "../../conformance/corpus/common/proof-catalog.json" with { type: "json" };
import theme from "../../conformance/corpus/common/theme.json" with { type: "json" };
import tree from "../../conformance/corpus/ui-tree/docs/valid.json" with { type: "json" };
import { assertSelfContained } from "../../scripts/release/bundle-check.ts";
import { validateScenario, validateWidgetPackageShape } from "../formats/package.ts";
import { validatePlacement, validateState, validateStyleRecord } from "../formats/records.ts";
import { verifyPackage } from "../pack/verify.ts";
import { renderModule } from "../runner-kit/render.ts";

const root = new URL("../../", import.meta.url).pathname;
const bundle = join(root, "dist/validator.bundle.js");

const realmMessage =
  "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)";
const patch = {
  format: "liveframe/tree-patch/1",
  catalogId: tree.catalogId,
  surfaceId: tree.surfaceId,
  base: 1,
  revision: 2,
  ops: [],
};

test("every_entry_point_names_a_foreign_realm", async () => {
  const context = createContext({});
  const module = new SourceTextModule(await Bun.file(bundle).text(), { context });
  await module.link(() => {
    throw new Error("Unexpected bundle import");
  });
  await module.evaluate();
  const api = module.namespace as unknown as typeof liveframe;
  const inner = runInContext(
    `JSON.parse(${JSON.stringify(JSON.stringify({ catalog, capabilities, manifest, tree, theme, system, patch }))})`,
    context,
  );
  const compiled = api.compileValidator(inner);
  const calls: [string, () => unknown, string][] = [
    ["validateCatalog", () => api.validateCatalog(catalog), ""],
    ["validateVocabulary", () => api.validateVocabulary(catalog.vocabulary), ""],
    ["validateCapabilities", () => api.validateCapabilities(capabilities), ""],
    ["validateManifest", () => api.validateManifest(manifest, inner), ""],
    ["validateTheme", () => api.validateTheme(theme, inner.catalog.vocabulary), ""],
    ["validateDesignSystem", () => api.validateDesignSystem(system, { catalog: inner.catalog, registry: {} }), ""],
    ["compileValidator catalog cache hit", () => api.compileValidator({ ...inner, catalog }), "/catalog"],
    [
      "compileValidator capabilities cache hit",
      () => api.compileValidator({ ...inner, capabilities }),
      "/capabilities",
    ],
    ["compileValidator manifest", () => api.compileValidator({ ...inner, manifest }), "/manifest"],
    ["validateTree", () => compiled.validateTree(tree), ""],
    ["validateTreePatch", () => api.validateTreePatch(patch), ""],
    ...[validateScenario, validateWidgetPackageShape, validatePlacement, validateState, validateStyleRecord].map(
      (validate): [string, () => unknown, string] => [validate.name, () => validate(inner.manifest), ""],
    ),
    ["applyPatch patch", () => api.applyPatch(inner.tree, patch), ""],
    ["applyPatch base", () => api.applyPatch(tree as liveframe.UiTree, inner.patch), ""],
    ["diffTrees prev", () => api.diffTrees(tree as liveframe.UiTree, { ...inner.tree, revision: 2 }), ""],
    ["diffTrees next", () => api.diffTrees(inner.tree, { ...tree, revision: 2 } as liveframe.UiTree), ""],
    [
      "verifyPackage",
      () =>
        verifyPackage(runInNewContext(`JSON.parse(${JSON.stringify(JSON.stringify(pkg))})`), {
          catalog: catalog as liveframe.Catalog,
          capabilities: capabilities as liveframe.Capabilities,
        }),
      "",
    ],
    [
      "renderModule manifest",
      () =>
        renderModule(() => null, {} as never, {
          catalog: catalog as liveframe.Catalog,
          capabilities: capabilities as liveframe.Capabilities,
          manifest: inner.manifest,
          surfaceId: "realm",
          revision: 1,
        }),
      "/manifest",
    ],
    [
      "renderModule catalog",
      () =>
        renderModule(() => null, {} as never, {
          catalog: inner.catalog,
          capabilities: capabilities as liveframe.Capabilities,
          manifest: manifest as liveframe.Manifest,
          surfaceId: "realm",
          revision: 1,
        }),
      "/catalog",
    ],
  ];
  for (const [name, call, pointer] of calls) {
    let result: unknown;
    try {
      result = call();
    } catch (error) {
      result = { ok: false, errors: (error as liveframe.LiveframeFailure).errors };
    }
    expect(result, name).toMatchObject({
      ok: false,
      errors: [{ kind: "invalid-document", pointer, message: realmMessage }],
    });
  }
  inner.catalog.definitions[0].props = catalog.definitions[0]?.props;
  expect(() => api.compileValidator(inner)).toThrow(realmMessage);
});

test("foreign_realm_nested_values_and_accessors_are_rejected", () => {
  const foreign = runInNewContext("({})");
  expect(liveframe.validateCatalog({ ...catalog, vocabulary: foreign })).toMatchObject({
    ok: false,
    errors: [{ pointer: "/vocabulary", kind: "invalid-document", message: realmMessage }],
  });
  const validator = liveframe.compileValidator({ catalog, capabilities, manifest });
  for (const candidate of [
    { ...tree, root: foreign },
    { ...tree, root: { ...tree.root, props: foreign } },
    { ...tree, root: { ...tree.root, children: [{ id: "root/button", kind: "button", props: foreign }] } },
  ]) {
    const result = validator.validateTree(candidate);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ kind: "invalid-document", message: realmMessage }),
      );
  }
  const unreadable = runInNewContext('({ get format() { throw new Error("must not read"); } })');
  expect(liveframe.validateCatalog(unreadable)).toMatchObject({
    ok: false,
    errors: [{ pointer: "", kind: "invalid-document", message: realmMessage }],
  });
  expect(() => liveframe.compileValidator({ catalog: unreadable, capabilities, manifest })).toThrow(realmMessage);
});

test("same_realm_documents_unchanged", () => {
  const before = JSON.stringify({ catalog, capabilities, manifest, tree });
  const options = { catalog: catalog as liveframe.Catalog, capabilities: capabilities as liveframe.Capabilities };
  for (const result of [
    liveframe.validateCatalog(catalog),
    liveframe.validateCapabilities(capabilities),
    liveframe.validateManifest(manifest, options),
    liveframe.compileValidator({ ...options, manifest }).validateTree(tree),
  ])
    expect(result.ok).toBe(true);
  expect(JSON.stringify({ catalog, capabilities, manifest, tree })).toBe(before);
  const nullPrototype = Object.assign(Object.create(null), catalog);
  expect(liveframe.validateCatalog(nullPrototype)).toEqual({ ok: true, value: nullPrototype });
});

test("validator_bundle_is_self_contained", async () => {
  assertSelfContained(await Bun.file(bundle).text());
  expect(Object.keys(await import(bundle)).sort()).toEqual(Object.keys(liveframe).sort());
});

test("validator_bundle_omits_the_render_path", async () => {
  const names = Object.keys(await import(bundle));
  for (const name of ["renderModule", "render", "linkPackage"]) expect(names).not.toContain(name);
});

test("validator_bundle_validates_under_bare_vm", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("Node is required for the bare VM validator test");
  const validator = liveframe.compileValidator({ catalog, capabilities, manifest });
  const origin = { surfaceId: tree.surfaceId, revision: tree.revision, nodeId: "root/button", event: "onPress" };
  const intent = { type: "action", name: "tasks.claim", args: { id: "task:1" } } as const;
  const validated = validator.validateTree(tree);
  if (!validated.ok) throw new Error(JSON.stringify(validated.errors));
  const accepted = liveframe.checkOffered(validated.value, origin, intent, validator);
  const forged = liveframe.checkOffered(validated.value, { ...origin, revision: 0 }, intent, validator);
  expect(accepted.ok).toBe(true);
  expect(forged.ok).toBe(false);
  const dir = await mkdtemp(join(tmpdir(), "liveframe-validator-"));
  try {
    const request = join(dir, "request.json");
    await Bun.write(request, JSON.stringify({ catalog, capabilities, manifest, tree, origin, intent }));
    const proc = Bun.spawnSync(
      [
        node,
        "--experimental-vm-modules",
        "--no-warnings",
        join(root, "scripts/release/fixtures/vm-validator.mjs"),
        bundle,
        request,
      ],
      { stdout: "pipe", stderr: "pipe", timeout: 30_000 },
    );
    if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
    expect(JSON.parse(proc.stdout.toString())).toEqual(JSON.parse(JSON.stringify({ validated, accepted, forged })));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
