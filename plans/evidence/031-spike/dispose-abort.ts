// Does a caught stack overflow make runtime.dispose() abort? Variants of the engine and of the widget.
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
import ng from "@jitl/quickjs-ng-wasmfile-release-sync";

const variants: Record<string, () => Promise<any>> = {
  bellard: () => newQuickJSWASMModuleFromVariant(RELEASE_SYNC),
  ng: () => newQuickJSWASMModuleFromVariant(ng as never),
};
const cases: Record<string, string> = {
  "caught stack overflow": `const f = (n) => f(n + 1) + 1; try { f(0); } catch (e) {} globalThis.r = 1;`,
  "uncaught stack overflow": `const f = (n) => f(n + 1) + 1; f(0);`,
  "caught OOM": `const a = []; try { while (true) a.push(new Array(100000).fill(1)); } catch (e) {} globalThis.r = 1;`,
  interrupt: `while (true) {}`,
  "string bomb": `let s = 'x'; try { while (true) s += s; } catch (e) {}`,
  plain: `globalThis.r = 1;`,
};
for (const [vname, make] of Object.entries(variants)) {
  for (const [cname, code] of Object.entries(cases)) {
    let outcome = "disposed cleanly";
    const t = performance.now();
    try {
      const qjs = await make();
      const rt = qjs.newRuntime();
      rt.setMemoryLimit(32 << 20);
      rt.setMaxStackSize(1 << 20);
      const deadline = Date.now() + 300;
      rt.setInterruptHandler(() => Date.now() > deadline);
      const cx = rt.newContext();
      const res = cx.evalCode(code, "w.js");
      if (res.error) {
        const e = cx.dump(res.error);
        res.error.dispose();
        outcome = `eval error ${e?.name}: ${e?.message}; `;
      } else res.value.dispose();
      cx.dispose();
      rt.dispose();
      outcome += "disposed cleanly";
    } catch (e) {
      outcome += `HOST THROW ${String(e).slice(0, 110)}`;
    }
    console.log(
      `${vname.padEnd(8)} ${cname.padEnd(24)} ${(performance.now() - t).toFixed(0).padStart(5)} ms  ${outcome}`,
    );
  }
}
