// Where does QuickJS's own stack limit fire relative to the host (Bun/JSC) stack, per setMaxStackSize and call shape?
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";

const shapes: Record<string, string> = {
  plain: `const f = () => { d++; f(); };`,
  "args+locals": `const f = (a, b, c, d1, e) => { d++; const x = [a, b, c, d1, e]; f(x, a, b, c, d1); };`,
  "map-recursion": `const f = () => { d++; [1].map(() => f()); };`,
  "json-tojson": `const o = { toJSON() { d++; return JSON.stringify(o); } }; const f = () => JSON.stringify(o);`,
  getter: `const o = { get x() { d++; return o.x; } }; const f = () => o.x;`,
  proxy: `const p = new Proxy({}, { get(t, k) { d++; return p[k]; } }); const f = () => p.x;`,
  "sort-cmp": `const f = () => { d++; [2, 1].sort(() => { f(); return 0; }); };`,
};
for (const stack of [64 << 10, 128 << 10, 256 << 10, 512 << 10, 1 << 20, 2 << 20]) {
  for (const [name, setup] of Object.entries(shapes)) {
    let outcome = "";
    try {
      const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
      const rt = qjs.newRuntime();
      rt.setMemoryLimit(32 << 20);
      rt.setMaxStackSize(stack);
      const cx = rt.newContext();
      const code = `let d = 0; ${setup}; try { f(); } catch (e) { globalThis.msg = String(e && e.message); } globalThis.depth = d;`;
      const res = cx.evalCode(code, "w.js");
      if (res.error) {
        outcome = "eval error " + JSON.stringify(cx.dump(res.error));
        res.error.dispose();
      } else res.value.dispose();
      const depth = cx.dump(cx.getProp(cx.global, "depth"));
      const msg = cx.dump(cx.getProp(cx.global, "msg"));
      outcome += ` depth=${depth} msg=${msg}`;
      cx.dispose();
      rt.dispose();
      outcome += " | dispose ok";
    } catch (e) {
      outcome += ` | HOST THROW ${String(e).slice(0, 70)}`;
    }
    console.log(`${String(stack >> 10).padStart(5)}K ${name.padEnd(14)} ${outcome}`);
  }
}
