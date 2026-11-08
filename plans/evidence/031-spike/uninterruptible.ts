// Which native builtins ignore the interrupt handler (host CPU held past timeoutMs)? 100 ms deadline, 32 MiB, 256 KiB stack.
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
import ng from "@jitl/quickjs-ng-wasmfile-release-sync";
const shapes: Record<string, string> = {
  "js loop": `while (true) {}`,
  "regex catastrophic": `/(a+)+$/.test('a'.repeat(34) + 'b');`,
  "regex catastrophic (alt)": `/^(([a-z])+.)+[A-Z]([a-z])+$/.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!');`,
  "array fill 1e5 x n": `const a = []; while (true) a.push(new Array(100000).fill(1));`,
  "sort 2e6 default": `const a = Array.from({ length: 2e6 }, (_, i) => (i * 7919) % 1000003); a.sort();`,
  "bigint pow": `10n ** 3000000n;`,
  "bigint to string": `(10n ** 200000n).toString().length;`,
  "string repeat+replace": `'ab'.repeat(5e6).replace(/a/g, 'xx').replace(/b/g, 'yy');`,
  "json parse big": `JSON.parse('[' + '1,'.repeat(5e6) + '1]');`,
  "array join": `new Array(3e7).join('x');`,
  "localeCompare sort": `Array.from({ length: 3e5 }, (_, i) => 'k' + ((i * 7919) % 100003)).sort((a, b) => a.localeCompare(b));`,
  "Intl-free toString radix": `(2n ** 400000n).toString(7).length;`,
};
for (const [vname, variant] of [
  ["bellard", RELEASE_SYNC],
  ["ng", ng],
] as const) {
  const qjs = await newQuickJSWASMModuleFromVariant(variant as never);
  for (const [name, code] of Object.entries(shapes)) {
    let msg = "";
    const t = performance.now();
    try {
      const rt = qjs.newRuntime();
      rt.setMemoryLimit(32 << 20);
      rt.setMaxStackSize(256 << 10);
      const dl = Date.now() + 100;
      rt.setInterruptHandler(() => Date.now() > dl);
      const cx = rt.newContext();
      const r = cx.evalCode(
        `try { ${code} ; globalThis.m = 'completed' } catch (e) { globalThis.m = e.message }`,
        "w.js",
      );
      msg = r.error
        ? "ERR " + JSON.stringify(cx.dump(r.error)).slice(0, 50)
        : String(cx.dump(cx.getProp(cx.global, "m"))).slice(0, 40);
      if (r.error) r.error.dispose();
      else r.value.dispose();
      cx.dispose();
      rt.dispose();
    } catch (e) {
      msg = "HOST THROW " + String(e).slice(0, 60);
    }
    console.log(`${vname.padEnd(8)} ${name.padEnd(26)} ${(performance.now() - t).toFixed(0).padStart(6)} ms  ${msg}`);
  }
}
