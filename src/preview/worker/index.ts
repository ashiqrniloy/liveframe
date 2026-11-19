import type { Runner } from "../runner.ts";
import { createWorkerRunner } from "./runner.ts";

/**
 * Backend runner that bounds time and crashes, not what code can reach.
 * Not an isolation boundary. Verify packages before rendering them.
 * Requests run serially; timeoutMs defaults to 100 (render options override it)
 * and starts when the render is posted to a ready worker. Worker startup is
 * bounded separately by startTimeoutMs (default 5,000, failing with render-failed).
 * Each render carries an id, and only that id's result is accepted. Every tree is
 * re-validated on the host, and a worker that answers out of turn or with a tree
 * the host rejects is terminated. A package's hash is checked once per object
 * before anything is loaded, and the worker restarts after maxPackages (64)
 * distinct hashes, since loaded modules cannot be unloaded. One worker still
 * serves every package, so hostile code needs the app's own isolated runner.
 * close() stops active work and returns render-failed for queued and future renders.
 */
export function workerRunner(
  defaults: { timeoutMs?: number; maxPackages?: number; startTimeoutMs?: number } = {},
): Runner & { close(): void } {
  return createWorkerRunner(defaults);
}
