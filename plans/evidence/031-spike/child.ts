// The child process of the process-hosted design: QuickJS inside a Bun subprocess the parent can SIGKILL.
// Messages (Bun IPC, json): {type:"init", kit} then {type:"render", id, code, request, limits, freshWasm}.
import { readFileSync } from "node:fs";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  RELEASE_SYNC,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten";

const wasmPath = new URL(
  "./node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm",
  import.meta.url,
);
const compiled = await WebAssembly.compile(readFileSync(wasmPath));
const variant = newVariant(RELEASE_SYNC, { wasmModule: compiled } as never);
let shared = await newQuickJSWASMModuleFromVariant(variant);
let kit = "";
const entry = `import { renderModule } from "liveframe:kit";
import widget from "liveframe:pkg";
const q = JSON.parse(globalThis.__req);
globalThis.__out = JSON.stringify(renderModule(widget, q.inputs, q.options));`;

process.on("message", async (m: any) => {
  if (m.type === "init") {
    kit = m.kit;
    process.send!({ type: "ready" });
    return;
  }
  const qjs = m.freshWasm ? await newQuickJSWASMModuleFromVariant(variant) : shared;
  let reply: unknown;
  const rt = qjs.newRuntime();
  try {
    rt.setMemoryLimit(m.limits.memoryBytes);
    rt.setMaxStackSize(m.limits.stackBytes);
    rt.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + m.limits.timeoutMs));
    const sources: Record<string, string> = { "liveframe:kit": kit, "liveframe:pkg": m.code };
    rt.setModuleLoader((n) => sources[n] ?? { error: new Error("module not found") });
    const cx = rt.newContext();
    const s = cx.newString(m.request);
    cx.setProp(cx.global, "__req", s);
    s.dispose();
    const r = cx.evalCode(entry, "entry.js", { type: "module" });
    if (r.error) {
      const e = cx.dump(r.error);
      r.error.dispose();
      reply = { error: String(e?.message ?? e) };
    } else {
      r.value.dispose();
      const out = cx.getProp(cx.global, "__out");
      reply = cx.typeof(out) === "string" ? { json: cx.getString(out) } : { error: "no result" };
      out.dispose();
    }
    cx.dispose();
  } catch (e) {
    reply = { error: "host:" + String(e).slice(0, 100) };
  }
  try {
    rt.dispose();
  } catch (e) {
    reply = { error: "dispose-abort", prior: reply };
    shared = await newQuickJSWASMModuleFromVariant(variant);
  }
  process.send!({ type: "result", id: m.id, ...(reply as object) });
});
process.send!({ type: "spawned" });
