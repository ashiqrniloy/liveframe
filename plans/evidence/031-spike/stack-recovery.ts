// (1) After a host-side RangeError inside wasm, is the same wasm module reusable? (2) Does a 256 KiB QuickJS limit hold when
// the host call stack is already deep? (3) Does the same hold inside a Bun Worker?
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";

const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
function overflow(stack: number): string {
  const rt = qjs.newRuntime();
  rt.setMaxStackSize(stack);
  const cx = rt.newContext();
  const res = cx.evalCode(
    `let d=0; const f=()=>{d++; [1].map(()=>f())}; try{f()}catch(e){globalThis.m=String(e.message)}; globalThis.d=d;`,
    "w.js",
  );
  if (res.error) res.error.dispose();
  else res.value.dispose();
  const m = cx.dump(cx.getProp(cx.global, "m"));
  cx.dispose();
  rt.dispose();
  return String(m);
}
// (1)
let r = "";
try {
  overflow(2 << 20);
} catch (e) {
  r = `host threw: ${String(e).slice(0, 60)}`;
}
console.log("1MiB-class overflow ->", r);
try {
  const rt = qjs.newRuntime();
  const cx = rt.newContext();
  const v = cx.evalCode("1 + 1");
  console.log("same module after host throw, new runtime 1+1 ->", v.error ? "error" : cx.dump(v.value));
  cx.dispose();
  rt.dispose();
} catch (e) {
  console.log("same module after host throw: unusable:", String(e).slice(0, 100));
}

// (2) deep host stack
function deep(n: number, fn: () => string): string {
  return n === 0 ? fn() : deep(n - 1, fn) + "";
}
const fresh = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
void fresh;
for (const hostDepth of [0, 1000, 3000, 6000]) {
  let out: string;
  try {
    out = deep(hostDepth, () => overflow(256 << 10));
  } catch (e) {
    out = `HOST THROW ${String(e).slice(0, 50)}`;
  }
  console.log(`host depth ${hostDepth}, 256K ->`, out);
}
