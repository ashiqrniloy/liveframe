import { inProcessRunner } from "../in-process.ts";
import type { RunnerOptions } from "../runner.ts";
import type { WorkerMessage } from "./protocol.ts";

declare const self: Worker;

const runner = inProcessRunner();
let configuration: Pick<RunnerOptions, "catalog" | "capabilities">;
self.onmessage = async ({ data }: MessageEvent<WorkerMessage>) => {
  if (data.type === "configure") {
    // Keep cloned objects stable so the runner can reuse its compiled validators.
    configuration = { catalog: data.catalog, capabilities: data.capabilities };
  } else if (data.type === "render") {
    const result = await runner.render(data.pkg, data.inputs, { ...configuration, ...data.options });
    self.postMessage({ type: "result", id: data.id, result } satisfies WorkerMessage);
  }
};
