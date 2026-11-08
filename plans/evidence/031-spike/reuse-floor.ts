// Fixed cost of a reused (reuse:"package") runtime vs a fresh one, on the smallest proof surfaces, plus agent-home with catalog objects kept.
import { readFileSync } from "node:fs";
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
import { validateCapabilities, validateCatalog } from "../../../src/index.ts";
import { pack } from "../../../src/pack/index.ts";
import { linkPackage } from "../../../src/runner-kit/index.ts";
import catalogDoc from "../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "../../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../../src/__tests__/fixtures/widgets/index.ts";
const ok = <T>(r: any): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const catalog = ok<any>(validateCatalog(catalogDoc)),
  capabilities = ok<any>(validateCapabilities(capabilitiesDoc));
const kit = readFileSync(new URL("../../../dist/runner-kit.bundle.js", import.meta.url), "utf8");
const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
for (const [fi, si] of [
  [2, 1],
  [0, 0],
  [1, 1],
] as const) {
  const fx = proofWidgets[fi]!,
    sc = fx.scenarios[si]!;
  const pkg = ok<any>(pack(drafts[fi] as never, { catalog, capabilities }));
  const linked = ok<string>(linkPackage(pkg.code, () => "liveframe:kit"));
  const reqObj = {
    inputs: sc,
    options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "s", revision: 1 },
  };
  const request = JSON.stringify(reqObj);
  const sources: Record<string, string> = { "liveframe:kit": kit, "liveframe:pkg": linked };
  const setup = () => {
    const rt = qjs.newRuntime();
    rt.setMemoryLimit(32 << 20);
    rt.setMaxStackSize(256 << 10);
    rt.setModuleLoader((n) => sources[n] ?? { error: new Error("nf") });
    return rt;
  };
  const evalIn = (cx: any, code: string) => {
    const r = cx.evalCode(code, "e.js", { type: "module" });
    if (r.error) throw new Error(JSON.stringify(cx.dump(r.error)));
    r.value.dispose();
  };
  const setReq = (cx: any) => {
    const s = cx.newString(request);
    cx.setProp(cx.global, "__req", s);
    s.dispose();
  };
  const entryParse = `import { renderModule } from "liveframe:kit"; import w from "liveframe:pkg"; const q = JSON.parse(globalThis.__req); globalThis.__out = JSON.stringify(renderModule(w, q.inputs, q.options));`;
  const entryKept = `import { renderModule } from "liveframe:kit"; import w from "liveframe:pkg"; globalThis.__q ??= JSON.parse(globalThis.__req); globalThis.__out = JSON.stringify(renderModule(w, globalThis.__q.inputs, globalThis.__q.options));`;
  const fresh: number[] = [],
    reuseParse: number[] = [],
    reuseKept: number[] = [];
  for (let i = 0; i < 25; i++) {
    const s = performance.now();
    const rt = setup();
    const cx = rt.newContext();
    setReq(cx);
    evalIn(cx, entryParse);
    cx.dispose();
    rt.dispose();
    fresh.push(performance.now() - s);
  }
  for (const [entry, out] of [
    [entryParse, reuseParse],
    [entryKept, reuseKept],
  ] as const) {
    const rt = setup();
    const cx = rt.newContext();
    setReq(cx);
    evalIn(cx, entry);
    for (let i = 0; i < 40; i++) {
      const s = performance.now();
      setReq(cx);
      evalIn(cx, entry);
      out.push(performance.now() - s);
    }
    cx.dispose();
    rt.dispose();
  }
  console.log(
    `${fx.name}/${sc.name}: fresh ${median(fresh).toFixed(1)} ms | reuse, request re-parsed ${median(reuseParse).toFixed(1)} ms | reuse, catalog objects kept ${median(reuseKept).toFixed(1)} ms`,
  );
}
