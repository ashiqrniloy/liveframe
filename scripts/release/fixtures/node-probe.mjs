import { createAuthoring } from "@arnilo/liveframe/authoring";
import { capture, playwrightBackend } from "@arnilo/liveframe/preview/capture";
// Gate step 7: the host-API-free subpaths run under plain Node, from another directory.
import { readFileSync } from "node:fs";
import { applyPatch, diffTrees, validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import { baseCss } from "@arnilo/liveframe/css";
import { catalogSuite } from "@arnilo/liveframe/conformance";
import { canonicalJson, pack } from "@arnilo/liveframe/pack";
import { createPreview, inProcessRunner } from "@arnilo/liveframe/preview";
import { linkPackage, renderModule } from "@arnilo/liveframe/runner-kit";
import { jsx, primitive } from "@arnilo/liveframe/sdk";
import { generate, generateDefinitions } from "@arnilo/liveframe/sdk/gen";
import { memoryStore } from "@arnilo/liveframe/store";

const read = (name) => JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), "utf8"));
// Gate step 8: package metadata and conformance data resolve through `exports`.
const resolveJson = (specifier) => JSON.parse(readFileSync(new URL(import.meta.resolve(specifier)), "utf8"));
const ownManifest = resolveJson("@arnilo/liveframe/package.json");
const corpusTree = resolveJson("@arnilo/liveframe/conformance/corpus/ui-tree/docs/valid.json");
const packageVectors = resolveJson("@arnilo/liveframe/conformance/hash/packages.json");
const patchVectors = resolveJson("@arnilo/liveframe/conformance/patch/diff.json");
for (const { prev, next, patch } of patchVectors) {
  const diff = diffTrees(prev, next);
  const applied = applyPatch(prev, patch);
  if (
    !diff.ok ||
    !applied.ok ||
    canonicalJson(diff.value) !== canonicalJson(patch) ||
    canonicalJson(applied.value) !== canonicalJson(next)
  )
    throw new Error("Patch vector failed through installed public exports");
}
const catalog = validateCatalog(read("catalog"));
const capabilities = validateCapabilities(read("capabilities"));
if (!catalog.ok || !capabilities.ok) throw new Error("The fixture documents do not validate");

const files = Object.fromEntries(
  ["entry.tsx", "card.tsx"].map((name) => [name, readFileSync(new URL(`./widget/${name}`, import.meta.url), "utf8")]),
);
const options = { catalog: catalog.value, capabilities: capabilities.value, surfaceId: "node", revision: 1 };
const packed = pack({ files, entry: "entry.tsx", manifest: read("manifest"), scenarios: [read("scenario")] }, options);
if (!packed.ok) throw new Error(JSON.stringify(packed.errors));

const authoring = createAuthoring({
  ...options,
  runner: {
    render() {
      throw new Error("Catalog reads must not render");
    },
  },
});
const vocabulary = await authoring.listVocabulary();
await authoring.close();

const linked = linkPackage(packed.value.code, (specifier) => `sandbox:${specifier}`);
const rendered = renderModule(() => jsx(primitive("text"), { text: "ok" }), read("scenario"), {
  ...options,
  manifest: packed.value.manifest,
});

const runner = inProcessRunner();
const executed = await runner.render(packed.value, read("scenario"), options);
const preview = createPreview({ catalog: catalog.value, capabilities: capabilities.value, runner });

const checks = {
  "runner-kit.linkPackage":
    linked.ok && linked.value.startsWith('import * as __lf_sdk0 from "sandbox:@arnilo/liveframe/sdk'),
  "runner-kit.renderModule": rendered.ok && rendered.value.root.props.text === "ok",
  "authoring.createAuthoring": vocabulary.ok && vocabulary.value.catalogId === catalog.value.catalogId,
  validateCatalog: catalog.ok,
  "sdk.primitive": jsx(primitive("text"), { text: "ok" }).type !== undefined,
  "preview.inProcessRunner": executed.ok && runner.stats().modules > 0,
  "preview.createPreview": typeof preview.render === "function",
  "preview/capture": typeof capture === "function" && typeof playwrightBackend === "function",
  "sdk/gen.generate": generate(catalog.value).includes("export const Button"),
  "sdk/gen.generateDefinitions": generateDefinitions(catalog.value).includes("as const satisfies Definition"),
  "css.baseCss": baseCss(catalog.value).ok,
  "pack.pack": packed.ok,
  "store.memoryStore": (await memoryStore().getPlacement("missing")) === undefined,
  "conformance.catalogSuite":
    catalogSuite({
      ...options,
      manifest: read("manifest"),
      examples: [],
      published: catalog.value,
    }).length > 0,
  "exports.package.json": ownManifest.name === "@arnilo/liveframe",
  "exports.conformance.corpus": corpusTree.surfaceId === "corpus" && corpusTree.format === "liveframe/1",
  "exports.conformance.hash":
    packageVectors.length > 0 && packageVectors.every((vector) => typeof vector.hash === "string"),
};
for (const [name, passed] of Object.entries(checks)) if (!passed) throw new Error(`${name} failed`);
console.log(`node ${process.version} ran ${Object.keys(checks).length} entry points`);
