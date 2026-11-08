// Can Bun's Worker.terminate() stop QuickJS (wasm) stuck in one uninterruptible native call? And a subprocess SIGKILL?
import { newQuickJSWASMModuleFromVariant, RELEASE_SYNC } from "quickjs-emscripten";
if (!Bun.isMainThread) {
  const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
  postMessage("ready");
  onmessage = ({ data }: MessageEvent<string>) => {
    const rt = qjs.newRuntime();
    rt.setMemoryLimit(64 << 20);
    const dl = Date.now() + 100;
    rt.setInterruptHandler(() => Date.now() > dl);
    const cx = rt.newContext();
    const r = cx.evalCode(data, "w.js");
    if (r.error) r.error.dispose();
    else r.value.dispose();
    postMessage("done");
    cx.dispose();
    rt.dispose();
  };
} else if (process.argv[2] === "child") {
  // subprocess mode: just run the hold
  const qjs = await newQuickJSWASMModuleFromVariant(RELEASE_SYNC);
  const rt = qjs.newRuntime();
  const cx = rt.newContext();
  cx.evalCode(`'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b');`, "w.js");
  console.log("child finished (should not)");
} else {
  const hold = `'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b');`;
  const w = new Worker(import.meta.url);
  await new Promise((r) => (w.onmessage = () => r(null)));
  const start = performance.now();
  w.postMessage(hold);
  const outcome = await Promise.race([
    new Promise((r) => (w.onmessage = () => r("worker finished by itself"))),
    Bun.sleep(300).then(() => "deadline 300 ms passed; calling terminate()"),
  ]);
  console.log(outcome, `(${(performance.now() - start).toFixed(0)} ms)`);
  const t0 = performance.now();
  w.terminate();
  // does the main thread stay responsive, and does the worker actually die?
  const closed = await Promise.race([
    new Promise((r) => w.addEventListener("close", () => r("close event"))),
    Bun.sleep(3000).then(() => "NO close event within 3 s"),
  ]);
  console.log(`terminate() -> ${closed} after ${(performance.now() - t0).toFixed(0)} ms`);
  // subprocess SIGKILL
  const child = Bun.spawn([process.execPath, import.meta.path, "child"], { stdout: "pipe", stderr: "pipe" });
  await Bun.sleep(500);
  const k0 = performance.now();
  child.kill("SIGKILL");
  await child.exited;
  console.log(
    `subprocess SIGKILL -> exited ${(performance.now() - k0).toFixed(1)} ms after kill (signal ${child.signalCode})`,
  );
  process.exit(0);
}
