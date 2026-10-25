import type { LiveframeError, Result } from "../../errors.ts";
import type { WidgetPackage } from "../../formats/package.ts";
import type { UiTree } from "../../formats/tree.ts";
import { compiledValidator, verifyPackageHash } from "../cache.ts";
import type { Runner, RunnerOptions } from "../runner.ts";
import type { WorkerMessage } from "./protocol.ts";

type Pending = {
  readonly id: number;
  readonly validate: (result: Result<UiTree>) => Result<UiTree>;
  readonly resolve: (result: Result<UiTree>) => void;
};

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Backend runner that bounds time and crashes, not what code can reach.
 * Not an isolation boundary. Verify packages before rendering them.
 * Requests run serially; timeoutMs defaults to 100 and render options override it.
 * Each render carries an id, and only that id's result is accepted. Every tree is
 * re-validated on the host, and a worker that answers out of turn or with a tree
 * the host rejects is terminated. A package's hash is checked once per object
 * before anything is loaded, and the worker restarts after maxPackages (64)
 * distinct hashes, since loaded modules cannot be unloaded. One worker still
 * serves every package, so hostile code needs the app's own isolated runner.
 * close() stops active work and returns render-failed for queued and future renders.
 */
export function workerRunner(defaults: { timeoutMs?: number; maxPackages?: number } = {}): Runner & { close(): void } {
  const maxPackages = defaults.maxPackages ?? 64;
  let worker: Worker | undefined;
  let configuration: Pick<RunnerOptions, "catalog" | "capabilities"> | undefined;
  /** Distinct hashes loaded into the current worker; modules cannot be unloaded. */
  let loaded = new Set<string>();
  let pending: Pending | undefined;
  let nextId = 1;
  let queue = Promise.resolve();
  let closed = false;

  function settle(result: Result<UiTree>): void {
    const active = pending;
    pending = undefined;
    active?.resolve(result);
  }

  function recycle(): void {
    worker?.terminate();
    worker = undefined;
    configuration = undefined;
    loaded = new Set();
  }

  function stop(kind: LiveframeError["kind"], message: string, expected?: string): void {
    recycle();
    settle({ ok: false, errors: [{ kind, pointer: "", message, ...(expected === undefined ? {} : { expected }) }] });
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
            if (!verifyPackageHash(pkg)) {
              resolve({
                ok: false,
                errors: [
                  { kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" },
                ],
              });
              return;
            }
            const id = nextId++;
            const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? 100;
            const timer = setTimeout(() => stop("limit-exceeded", `Render exceeded ${timeoutMs} ms`), timeoutMs);
            pending = {
              id,
              resolve: (result) => {
                clearTimeout(timer);
                resolve(result);
              },
              validate: (result) => {
                if (!result.ok) return result;
                try {
                  const validator = compiledValidator({ ...options, manifest: pkg.manifest }, pkg.hash);
                  return validator.validateTree(result.value, options.limits ? { limits: options.limits } : undefined);
                } catch (error) {
                  return { ok: false, errors: [{ kind: "render-failed", pointer: "", message: reason(error) }] };
                }
              },
            };
            try {
              if (!loaded.has(pkg.hash) && loaded.size >= maxPackages) recycle();
              loaded.add(pkg.hash);
              if (!worker) {
                const current = new Worker(new URL("./entry.ts", import.meta.url));
                worker = current;
                current.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
                  if (worker !== current || data.type !== "result") return;
                  const active = pending;
                  if (!active || data.id !== active.id) {
                    stop(
                      "render-failed",
                      "Worker answered a render it was not asked for",
                      "one result for the pending render id",
                    );
                    return;
                  }
                  const validated = active.validate(data.result);
                  // A crashed realm or a tree the host rejects is not reused.
                  if (
                    (data.result.ok && !validated.ok) ||
                    (!data.result.ok && data.result.errors.some((error) => error.kind === "render-failed"))
                  )
                    recycle();
                  settle(validated);
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
              worker.postMessage({ type: "render", id, pkg, inputs, options: renderOptions } satisfies WorkerMessage);
            } catch (error) {
              stop("render-failed", reason(error));
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
