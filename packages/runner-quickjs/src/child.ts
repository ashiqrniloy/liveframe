// The child process entry: it holds the QuickJS wasm module and renders what its parent sends.
// Run only by `quickjsRunner()`; the parent owns the channel, the deadline and `SIGKILL`.
import { fileURLToPath } from "node:url";
import type { ChildMessage, RenderRequest } from "./protocol.ts";
import { createEngine } from "./runtime.ts";

const send = (message: ChildMessage): void => {
  process.send?.(message);
};

const wasm = await WebAssembly.compile(
  await Bun.file(fileURLToPath(import.meta.resolve("@jitl/quickjs-wasmfile-release-sync/wasm"))).arrayBuffer(),
);
const kit = await Bun.file(fileURLToPath(import.meta.resolve("@arnilo/liveframe/runner-kit.bundle.js"))).text();
const engine = createEngine(wasm, kit, { maxRuntimes: Number(Bun.argv[2]) || 16 });

process.on("disconnect", () => process.exit(0));
process.on("message", async (message) => {
  const request = message as RenderRequest;
  if (request.type !== "render") return;
  send({ type: "result", id: request.id, ...(await engine.render(request)) });
});
send({ type: "ready" });
