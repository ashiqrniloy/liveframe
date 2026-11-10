#!/usr/bin/env bun
/**
 * Quiet-host benchmark record (plan 032 Task 3).
 *
 * Runs every stage of `bun run bench` one after another, each in its own process, so an early failure
 * does not hide the later stages (the `&&` chain stops at the first). A host is quiet when its whole-host
 * CPU utilisation, the benchmark itself included, stays below 10% (`--max-cpu`): it is read from
 * `/proc/stat` as the busy share of all logical CPUs over each interval, so it does not depend on the
 * lagging 1-minute load average, which the benchmark's own thread keeps near 1.0. A stage is "pass" only
 * when it exits 0 *and* the host was quiet for the whole stage; a stage that passes on a busy host is
 * recorded as "not quiet", which proves nothing.
 *
 *   bun scripts/bench-quiet.ts --out plans/evidence/032-bench.md
 *     --max-cpu 10     host CPU utilisation, in percent, that counts as quiet (default 10)
 *     --interval 5     seconds between samples (default 5)
 *     --wait 600       seconds to wait for the host to become quiet before starting (default 600)
 *     --only a,b       run only these bench files (names without `.bench.ts`), for a smoke test
 *
 * Exit status: 0 when every stage passed on a quiet host; 1 when a stage failed its budget while the host was
 * quiet (a real failure, never retried); 2 when the host never became quiet before the first stage; 3 when no stage
 * failed on a quiet host but some stage was not quiet (retry; the record proves nothing).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { cpus, loadavg, platform, release } from "node:os";

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : fallback;
};
const maxCpu = Number(arg("max-cpu", "10"));
const intervalMs = Number(arg("interval", "5")) * 1000;
const waitMs = Number(arg("wait", "600")) * 1000;
const only = arg("only", "").split(",").filter(Boolean);
const out = arg("out", "");

const run = (cmd: string[]) => Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" }).stdout.toString().trim();
const load1 = () => {
  try {
    return Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
  } catch {
    return loadavg()[0] as number;
  }
};

/** Cumulative CPU jiffies of the whole host: busy (everything but idle and iowait) and total. */
type Times = { busy: number; total: number };
const cpuTimes = (): Times => {
  const f = (readFileSync("/proc/stat", "utf8").split("\n")[0] as string).split(/\s+/).slice(1, 9).map(Number);
  const [user, nice, system, idle, iowait, irq, softirq, steal] = f as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const busy = user + nice + system + irq + softirq + steal;
  return { busy, total: busy + idle + iowait };
};
/** Busy share of the host's CPUs between two readings, in percent. */
const utilisation = (from: Times, to: Times) => (100 * (to.busy - from.busy)) / Math.max(1, to.total - from.total);
const busySeconds = (t: Times) => t.busy / 100;

// The stages are the `&&`-separated commands of the `bench` script: one source of truth.
const script = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> }).scripts.bench;
if (!script) throw new Error("package.json has no bench script");
const stages = script
  .split("&&")
  .map((command) => command.trim())
  .map((command) => ({ command, file: /(bench\/[\w-]+\.bench\.ts)/.exec(command)?.[1] ?? command }))
  .filter((stage) => only.length === 0 || only.some((name) => stage.file === `bench/${name}.bench.ts`));

// Wait for quiet: three consecutive intervals under the threshold.
let quietReads = 0;
let last = cpuTimes();
const waitStart = Date.now();
while (quietReads < 3) {
  await Bun.sleep(intervalMs);
  const now = cpuTimes();
  const cpu = utilisation(last, now);
  last = now;
  quietReads = cpu < maxCpu ? quietReads + 1 : 0;
  if (quietReads >= 3) break;
  if (Date.now() - waitStart >= waitMs) {
    console.error(
      `host not quiet: CPU ${cpu.toFixed(1)}% (needs < ${maxCpu}%); waited ${Math.round((Date.now() - waitStart) / 1000)} s`,
    );
    process.exit(2);
  }
}

// The host runs `powersave`, so an idle CPU sits at a low clock and the first measurement after a pause
// reads slow (agent-home 2.2 µs/node cold, 1.3 warm). Spin the CPU for a few seconds first; this happens
// before the sampling starts and no budget is touched.
for (const end = Date.now() + 5000; Date.now() < end; );

type Sample = { t: number; cpu: number; load: number; stage: string };
const samples: Sample[] = [];
const start = Date.now();
let current = "before";
const before = loadavg();
let mark = cpuTimes();
const sample = () => {
  const now = cpuTimes();
  samples.push({
    t: Math.round((Date.now() - start) / 1000),
    cpu: utilisation(mark, now),
    load: load1(),
    stage: current,
  });
  mark = now;
};
const timer = setInterval(sample, intervalMs);

type Result = {
  file: string;
  command: string;
  exit: number;
  seconds: number;
  output: string;
  /** Host CPU utilisation over the whole stage, in percent. */
  cpu: number;
  /** CPU the other processes used during the stage, in cores. */
  foreign: number;
};
const results: Result[] = [];
for (const stage of stages) {
  current = stage.file;
  console.error(`[bench-quiet] ${stage.file} (host CPU ${utilisation(mark, cpuTimes()).toFixed(1)}%)`);
  const t0 = Date.now();
  const at0 = cpuTimes();
  const proc = Bun.spawn(["sh", "-c", stage.command], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const exit = await proc.exited;
  const seconds = (Date.now() - t0) / 1000;
  const at1 = cpuTimes();
  const own = proc.resourceUsage();
  // Other processes' CPU: host busy time minus this stage's own (user + system), in cores over the stage.
  const foreign =
    Math.max(
      0,
      busySeconds(at1) - busySeconds(at0) - Number((own?.cpuTime.user ?? 0) + (own?.cpuTime.system ?? 0)) / 1e6,
    ) / seconds;
  results.push({ ...stage, exit, seconds, output: (stdout + stderr).trimEnd(), cpu: utilisation(at0, at1), foreign });
}
clearInterval(timer);
current = "end";
const after = loadavg();

const peakCpu = (stage: string) => Math.max(0, ...samples.filter((s) => s.stage === stage).map((s) => s.cpu));
const peakLoad = (stage: string) => Math.max(0, ...samples.filter((s) => s.stage === stage).map((s) => s.load));
// Quiet for a stage: its own average and every periodic sample taken inside it stay under the threshold.
const quiet = (r: Result) => r.cpu < maxCpu && peakCpu(r.file) < maxCpu;
// A stage that failed on a busy host is not evidence either way, so it reads "not quiet", never "fail".
const status = (r: Result) =>
  !quiet(r)
    ? r.exit === 0
      ? "not quiet"
      : `not quiet (exit ${r.exit})`
    : r.exit === 0
      ? "pass"
      : `fail (exit ${r.exit})`;
const failedOnQuiet = results.some((r) => quiet(r) && r.exit !== 0);
const allPass = results.every((r) => quiet(r) && r.exit === 0);
const peakAll = Math.max(...results.map((r) => Math.max(r.cpu, peakCpu(r.file))));

const lines: string[] = [
  "# Plan 032 Task 3: quiet-host benchmark record",
  "",
  `Generated by \`bun scripts/bench-quiet.ts\` on ${new Date().toISOString()}.`,
  "",
  `- Commit: ${run(["git", "rev-parse", "--short", "HEAD"])}${run(["git", "status", "--porcelain"]) ? " (dirty tree)" : ""}`,
  `- Host: Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; ${cpus().length} logical CPUs`,
  `- Quiet means whole-host CPU utilisation, the benchmark included, below ${maxCpu}% (the owner's definition): the busy share of all logical CPUs from \`/proc/stat\`, over each stage and over every ${intervalMs / 1000} s interval (${samples.length} samples). The host also had to stay under it for three consecutive intervals before the first stage.`,
  `- Peak host CPU: **${peakAll.toFixed(1)}%**. Verdict: **${allPass ? "every stage passed on a quiet host" : "NOT a clean quiet-host pass"}**.`,
  `- Load average before / after (information only; the benchmark's own thread keeps it near 1.0): ${before.map((n) => n.toFixed(2)).join(" / ")} → ${after.map((n) => n.toFixed(2)).join(" / ")} (1/5/15 min).`,
  '- "Other processes" is the CPU everything but the stage used during it (host busy time minus the stage\'s own user + system time), in cores.',
  "- Before the first stage the harness spins the CPU for 5 s: the host's `powersave` governor leaves an idle CPU at a low clock, which made the first measurement after a pause read about 1.7× slow (agent-home 2.2 against 1.3 µs/node). No budget is changed.",
  "- A stage reads `pass` only when it exited 0 and the host stayed quiet during it; `not quiet` means it exited 0 on a busy host, which proves nothing.",
  "",
  "| Stage | Result | Seconds | Host CPU avg % | Host CPU peak % | Other processes (cores) | Peak load |",
  "|---|---|---:|---:|---:|---:|---:|",
  ...results.map(
    (r) =>
      `| \`${r.file}\` | ${status(r)} | ${r.seconds.toFixed(0)} | ${r.cpu.toFixed(1)} | ${Math.max(r.cpu, peakCpu(r.file)).toFixed(1)} | ${r.foreign.toFixed(2)} | ${peakLoad(r.file).toFixed(2)} |`,
  ),
  "",
];
for (const r of results) {
  lines.push(`### ${r.file} — ${status(r)}`, "", `\`${r.command}\``, "", "```text", r.output, "```", "");
}
lines.push(
  "## Samples",
  "",
  "```text",
  ...samples.map(
    (s) => `${String(s.t).padStart(5)} s  cpu ${s.cpu.toFixed(1).padStart(5)}%  load ${s.load.toFixed(2)}  ${s.stage}`,
  ),
  "```",
  "",
);
const text = lines.join("\n");
if (out) writeFileSync(out, text);
else console.log(text);
console.error(`[bench-quiet] ${allPass ? "pass" : "NOT a clean pass"}; peak host CPU ${peakAll.toFixed(1)}%`);
// 0: clean pass; 1: a stage failed its budget on a quiet host; 3: no failure on a quiet host, but some stage was not quiet (retry).
process.exit(allPass ? 0 : failedOnQuiet ? 1 : 3);
