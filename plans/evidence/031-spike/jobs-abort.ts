// Does an interrupted promise-job loop (executePendingJobs) leave the runtime undisposable? Minimal, no kit.
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
import ng from "@jitl/quickjs-ng-wasmfile-release-sync";
for (const [name, variant] of [
  ["bellard", RELEASE_SYNC],
  ["ng", ng],
] as const) {
  const qjs = await newQuickJSWASMModuleFromVariant(variant as never);
  for (const mode of ["dispose-after-error", "no-pending-jobs-call"]) {
    let out = "";
    try {
      const rt = qjs.newRuntime();
      const deadline = Date.now() + 150;
      rt.setInterruptHandler(() => Date.now() > deadline);
      const cx = rt.newContext();
      const r = cx.evalCode(`const f = () => Promise.resolve().then(f); f(); globalThis.done = 1;`, "w.js");
      if (r.error) r.error.dispose();
      else r.value.dispose();
      if (mode === "dispose-after-error") {
        const jobs = rt.executePendingJobs();
        out = jobs.error ? `jobs error ${JSON.stringify(cx.dump(jobs.error))}` : `jobs ran ${jobs.value}`;
        if (jobs.error) jobs.error.dispose();
      }
      cx.dispose();
      rt.dispose();
      out += " | dispose ok";
    } catch (e) {
      out += ` | HOST THROW ${String(e).slice(0, 90)}`;
    }
    console.log(name.padEnd(8), mode.padEnd(22), out);
  }
}
