// After a wasm abort, is the module reusable? And is a fresh module cheap enough to be the recovery path (and does reuse of the compiled WebAssembly.Module help)?
import { newQuickJSWASMModuleFromVariant, newVariant, RELEASE_SYNC } from "quickjs-emscripten";
const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
const rt = qjs.newRuntime();
rt.setInterruptHandler(() => false);
const cx = rt.newContext();
cx.evalCode(`const f = () => Promise.resolve().then(f); f();`, "w.js").value?.dispose();
const dl = Date.now() + 100;
rt.setInterruptHandler(() => Date.now() > dl);
rt.executePendingJobs();
try {
  cx.dispose();
  rt.dispose();
} catch (e) {
  console.log("abort:", String(e).slice(0, 70));
}
try {
  const r2 = qjs.newRuntime();
  const c2 = r2.newContext();
  console.log("same module after abort, 1+1 ->", c2.dump(c2.unwrapResult(c2.evalCode("1+1"))));
  c2.dispose();
  r2.dispose();
} catch (e) {
  console.log("same module after abort unusable:", String(e).slice(0, 90));
}

// compiled-module reuse
const bytes = await Bun.file(
  new URL("./node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm", import.meta.url),
).arrayBuffer();
let t = performance.now();
const compiled = await WebAssembly.compile(bytes);
console.log(`WebAssembly.compile 503 KiB: ${(performance.now() - t).toFixed(1)} ms`);
const times: number[] = [];
for (let i = 0; i < 15; i++) {
  t = performance.now();
  await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
  times.push(performance.now() - t);
}
console.log("newQuickJSWASMModule(RELEASE_SYNC) repeated:", times.map((x) => x.toFixed(1)).join(" "));
try {
  const v = newVariant(RELEASE_SYNC, { wasmModule: compiled } as never);
  const ts: number[] = [];
  for (let i = 0; i < 15; i++) {
    t = performance.now();
    const m = await newQuickJSWASMModuleFromVariant(v);
    ts.push(performance.now() - t);
    const r = m.newRuntime();
    const c = r.newContext();
    c.dispose();
    r.dispose();
  }
  console.log("with shared compiled WebAssembly.Module:", ts.map((x) => x.toFixed(1)).join(" "));
} catch (e) {
  console.log("newVariant wasmModule failed:", String(e).slice(0, 120));
}
