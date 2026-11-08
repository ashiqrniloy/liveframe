// (1) host time to hit the memory limit for allocation-heavy loops, per limit; (2) memory agent-home needs (reuse vs fresh).
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
const pkg = ok<any>(pack(drafts[0] as never, { catalog, capabilities }));
const kit = readFileSync(new URL("../../../dist/runner-kit.bundle.js", import.meta.url), "utf8");
const linked = ok<string>(linkPackage(pkg.code, () => "liveframe:kit"));
const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);

const bombs: Record<string, string> = {
  "array-of-arrays": `const a = []; while (true) a.push(new Array(100000).fill(1));`,
  "array-of-objects": `const a = []; while (true) a.push({ x: a.length, y: 'v' + a.length });`,
  "string-concat": `let s = ''; const a = []; while (true) a.push(s += 'abcdefghij' + a.length);`,
};
for (const mib of [8, 16, 32, 64]) {
  for (const [name, code] of Object.entries(bombs)) {
    const rt = qjs.newRuntime();
    rt.setMemoryLimit(mib << 20);
    rt.setMaxStackSize(256 << 10);
    const dl = Date.now() + 5000;
    rt.setInterruptHandler(() => Date.now() > dl);
    const cx = rt.newContext();
    const t = performance.now();
    const r = cx.evalCode(`try { ${code} } catch (e) { globalThis.m = e.message }`, "w.js");
    const took = performance.now() - t;
    const msg = r.error ? JSON.stringify(cx.dump(r.error)) : String(cx.dump(cx.getProp(cx.global, "m")));
    if (r.error) r.error.dispose();
    else r.value.dispose();
    cx.dispose();
    rt.dispose();
    console.log(
      `${String(mib).padStart(3)} MiB ${name.padEnd(17)} ${took.toFixed(0).padStart(5)} ms  ${msg.slice(0, 60)}`,
    );
  }
}
// minimum memory for agent-home (fresh runtime incl. kit)
const request = JSON.stringify({
  inputs: proofWidgets[0]!.scenarios[0],
  options: { catalog, capabilities, manifest: pkg.manifest, surfaceId: "s", revision: 1 },
});
for (const mib of [4, 6, 8, 12, 16, 24, 32]) {
  const rt = qjs.newRuntime();
  rt.setMemoryLimit(mib << 20);
  rt.setMaxStackSize(256 << 10);
  const sources: Record<string, string> = { "liveframe:kit": kit, "liveframe:pkg": linked };
  rt.setModuleLoader((n) => sources[n] ?? { error: new Error("nf") });
  const cx = rt.newContext();
  const s = cx.newString(request);
  cx.setProp(cx.global, "__req", s);
  s.dispose();
  const r = cx.evalCode(
    `import { renderModule } from "liveframe:kit"; import w from "liveframe:pkg"; const q = JSON.parse(globalThis.__req); const out = renderModule(w, q.inputs, q.options); globalThis.__out = out.ok ? "ok" : out.errors[0].message;`,
    "e.js",
    { type: "module" },
  );
  let msg: string;
  if (r.error) {
    msg = "ERR " + JSON.stringify(cx.dump(r.error)).slice(0, 60);
    r.error.dispose();
  } else {
    r.value.dispose();
    msg = String(cx.dump(cx.getProp(cx.global, "__out")));
  }
  console.log(`agent-home at ${String(mib).padStart(2)} MiB: ${msg}`);
  cx.dispose();
  rt.dispose();
}
