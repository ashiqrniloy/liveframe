import type { LiveframeError, Result } from "../../errors.ts";
import type { UiTree } from "../../formats/tree.ts";
import type { Runner, RunnerOptions } from "../runner.ts";
import type { WorkerMessage } from "./protocol.ts";

/**
 * Backend runner that bounds time and crashes, not what code can reach.
 * Not an isolation boundary. Verify packages before rendering them.
 * Requests run serially; timeoutMs defaults to 100 and render options override it.
 * close() stops active work and returns render-failed for queued and future renders.
 */
export function workerRunner(defaults: { timeoutMs?: number } = {}): Runner & { close(): void } {
  let worker: Worker | undefined;
  let configuration: Pick<RunnerOptions, "catalog" | "capabilities"> | undefined;
  let pending: ((result: Result<UiTree>) => void) | undefined;
  let queue = Promise.resolve();
  let closed = false;

  function stop(kind: LiveframeError["kind"], message: string): void {
    const previous = worker;
    worker = undefined;
    configuration = undefined;
    previous?.terminate();
    pending?.({ ok: false, errors: [{ kind, pointer: "", message }] });
  }

  return {
    render(pkg, inputs, options) {
      const result = queue.then(
        () =>
          new Promise<Result<UiTree>>((resolve) => {
            if (closed) {
              resolve({ ok: false, errors: [{ kind: "render-failed", pointer: "", message: "Runner closed" }] });
              return;
            }
            const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? 100;
            const timer = setTimeout(() => stop("limit-exceeded", `Render exceeded ${timeoutMs} ms`), timeoutMs);
            pending = (result) => {
              clearTimeout(timer);
              pending = undefined;
              resolve(result);
            };
            try {
              if (!worker) {
                const current = new Worker(new URL("./entry.ts", import.meta.url));
                worker = current;
                current.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
                  if (worker !== current || data.type !== "result") return;
                  if (!data.result.ok && data.result.errors.some((error) => error.kind === "render-failed")) {
                    current.terminate();
                    worker = undefined;
                    configuration = undefined;
                  }
                  pending?.(data.result);
                };
                current.onerror = (event) => {
                  event.preventDefault();
                  if (worker === current) stop("render-failed", event.message || "Worker error");
                };
                current.addEventListener("close", () => {
                  if (worker === current) stop("render-failed", "Worker exited");
                });
              }
              const { catalog, capabilities, ...renderOptions } = options;
              if (configuration?.catalog !== catalog || configuration?.capabilities !== capabilities) {
                worker.postMessage({ type: "configure", catalog, capabilities } satisfies WorkerMessage);
                configuration = { catalog, capabilities };
              }
              worker.postMessage({ type: "render", pkg, inputs, options: renderOptions } satisfies WorkerMessage);
            } catch (error) {
              stop("render-failed", error instanceof Error ? error.message : String(error));
            }
          }),
      );
      queue = result.then(() => {});
      return result;
    },
    close() {
      closed = true;
      stop("render-failed", "Runner closed");
    },
  };
}
