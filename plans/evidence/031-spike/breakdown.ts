// Where do the QuickJS render milliseconds go? Timed inside the sandbox with Date.now() over repeated steps.
import { readFileSync } from "node:fs";
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
import { validateCapabilities, validateCatalog } from "../../../src/index.ts";
import { pack } from "../../../src/pack/index.ts";
import { linkPackage } from "../../../src/runner-kit/index.ts";
import catalogDoc from "../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "../../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../../src/__tests__/fixtures/widgets/index.ts";

const ok = <T>(r: { ok: boolean; value?: T; errors?: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value as T;
};
const catalog = ok(validateCatalog(catalogDoc) as never);
const capabilities = ok(validateCapabilities(capabilitiesDoc) as never);
const options = { catalog, capabilities, surfaceId: "spike", revision: 1 };
const pkg = ok(pack(drafts[0] as never, options as never) as never) as { code: string; manifest: unknown };
const scenario = proofWidgets[0]!.scenarios[0];
const kitText = readFileSync(new URL("../../../dist/runner-kit.bundle.js", import.meta.url), "utf8");
const linked = ok(linkPackage(pkg.code, () => "liveframe:kit") as never) as string;
const request = JSON.stringify({
  inputs: scenario,
  options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "spike", revision: 1 },
});
const catalogText = JSON.stringify(catalog),
  capText = JSON.stringify(capabilities);

const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
const N = 20;
const rt = qjs.newRuntime();
rt.setMemoryLimit(64 << 20);
rt.setMaxStackSize(256 << 10);
const sources: Record<string, string> = { "liveframe:kit": kitText, "liveframe:pkg": linked };
rt.setModuleLoader((name) => sources[name] ?? { error: new Error("nf") });
const cx = rt.newContext();
const run = (code: string) => {
  const r = cx.evalCode(code, "x.js", { type: "module" });
  if (r.error) throw new Error(JSON.stringify(cx.dump(r.error)));
  r.value.dispose();
};
const get = (n: string) => cx.dump(cx.getProp(cx.global, n));
const set = (n: string, v: string) => {
  const s = cx.newString(v);
  cx.setProp(cx.global, n, s);
  s.dispose();
};
set("__req", request);
set("__cat", catalogText);
set("__cap", capText);
let t = performance.now();
run(`import * as k from "liveframe:kit"; import w from "liveframe:pkg"; globalThis.k = k; globalThis.w = w;`);
console.log(`kit+package module load/eval (in a runtime): ${(performance.now() - t).toFixed(1)} ms`);
run(`
const T = (f) => { const s = Date.now(); for (let i = 0; i < ${N}; i++) f(); return (Date.now() - s) / ${N}; };
const out = {};
out.parseRequest = T(() => JSON.parse(globalThis.__req));
out.parseCatalog = T(() => JSON.parse(globalThis.__cat));
const q = JSON.parse(globalThis.__req);
// every iteration re-parses catalog/capabilities (new identities), as a stateless entry would
out.renderFreshObjects = T(() => { const o = JSON.parse(globalThis.__req); globalThis.k.renderModule(globalThis.w, o.inputs, o.options); });
// identities kept: validator cache hits
out.renderSameObjects = T(() => globalThis.k.renderModule(globalThis.w, q.inputs, q.options));
const r = globalThis.k.renderModule(globalThis.w, q.inputs, q.options);
out.stringifyResult = T(() => JSON.stringify(r));
out.resultBytes = JSON.stringify(r).length;
globalThis.__timing = JSON.stringify(out);
`);
console.log("in-sandbox ms per step (avg of", N, "):", get("__timing"));
cx.dispose();
rt.dispose();
