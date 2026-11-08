// Single-native-call CPU holds that no interrupt handler can stop, and the intrinsics mitigation for BigInt.
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
const shapes: Record<string, string> = {
  "indexOf quadratic (10MB x 5MB)": `'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b');`,
  "bigint toString 4.8M digits": `(2n ** 16000000n).toString().length;`,
  "bigint multiply big": `const a = 3n ** 8000000n; (a * a).toString(16).length;`,
};
async function run(label: string, intrinsics?: Record<string, boolean>) {
  for (const [name, code] of Object.entries(shapes)) {
    const rt = qjs.newRuntime();
    rt.setMemoryLimit(64 << 20);
    rt.setMaxStackSize(256 << 10);
    const dl = Date.now() + 100;
    rt.setInterruptHandler(() => Date.now() > dl);
    const cx = rt.newContext(intrinsics ? { intrinsics: intrinsics as never } : {});
    const t = performance.now();
    // hard stop: give up waiting after 20 s by running in a bounded way is impossible in-thread; limit shapes to what finishes
    const r = cx.evalCode(
      `try { ${code} ; globalThis.m = 'completed' } catch (e) { globalThis.m = e.name + ':' + e.message }`,
      "w.js",
    );
    const msg = r.error
      ? "ERR " + JSON.stringify(cx.dump(r.error)).slice(0, 60)
      : String(cx.dump(cx.getProp(cx.global, "m"))).slice(0, 60);
    if (r.error) r.error.dispose();
    else r.value.dispose();
    console.log(`${label.padEnd(16)} ${name.padEnd(32)} ${(performance.now() - t).toFixed(0).padStart(7)} ms  ${msg}`);
    cx.dispose();
    rt.dispose();
  }
}
const which = process.argv[2];
if (which === "default") await run("default");
if (which === "nobigint")
  await run("no BigInt", {
    BaseObjects: true,
    Date: true,
    Eval: true,
    StringNormalize: true,
    RegExp: true,
    RegExpCompiler: true,
    JSON: true,
    Proxy: true,
    MapSet: true,
    TypedArrays: true,
    Promise: true,
  });
