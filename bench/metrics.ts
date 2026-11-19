import { strict as assert } from "node:assert";
import { writeFileSync } from "node:fs";

const flag = Bun.argv.indexOf("--json");
const file = flag >= 0 ? Bun.argv[flag + 1] : undefined;
if (flag >= 0 && !file) throw new Error("--json needs a file path");

/** True under `--json <file>`: the figures are also written there, and a missed budget is reported, not thrown. */
export const jsonMode = file !== undefined;

const metrics: Record<string, number> = {};

/** Records one printed figure under a stable key; a no-op unless `--json` was given. */
export function metric(name: string, value: number): void {
  metrics[name] = value;
}

/**
 * Runs `run` `iterations` times; returns wall and process-CPU milliseconds per iteration. CPU time counts only
 * the cycles this process ran, so a busy host moves it far less than wall time (`bench/ab.ts` gates on it).
 */
export function timed(run: (i: number) => unknown, iterations: number): { wallMs: number; cpuMs: number } {
  const cpu = process.cpuUsage();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) run(i);
  const wallMs = performance.now() - start;
  const used = process.cpuUsage(cpu);
  return { wallMs: wallMs / iterations, cpuMs: (used.user + used.system) / 1_000 / iterations };
}

/** A hard budget: throws normally, and only reports under `--json` so `bench/ab.ts` still gets every figure. */
export function budget(ok: boolean, message: string): void {
  if (jsonMode && !ok) console.error(message);
  else assert(ok, message);
}

// A synchronous exit handler writes the file even when a later gate throws.
if (file) process.on("exit", () => writeFileSync(file, `${JSON.stringify(metrics, null, 2)}\n`));
