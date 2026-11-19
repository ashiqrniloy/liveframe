/**
 * Interleaved A/B bench driver: compares this checkout (head) with a git ref (base), on a host that is never idle.
 *
 *   timeout 3600 bun bench/ab.ts <ref> <bench-file> [--runs 7] [--max-runs 14] [--threshold 1.02]
 *     [--gate <metric>…] [--metric <name>…] [-- <bench args>]
 *
 * Each round runs base, head and a control (base again), alternating `base, head, control` and
 * `control, head, base`. Every row gets the median paired head/base ratio with a seeded 95% bootstrap interval;
 * the control's interval (control/base) shows how far identical code moves on this host right now.
 *
 * Gated rows (`--gate`, or by default every row whose name ends in `CpuMs`/`cpuMs`) decide the verdict:
 * `pass` when the interval lies at or below `--threshold`, `fail` when it lies wholly above, else
 * `inconclusive`. Rounds are added while a row named by `--gate` is inconclusive, up to `--max-runs` (default
 * 2 × `--runs` with `--gate`, else `--runs`: no extra rounds), and stop early once one fails. A control interval wholly outside
 * 1 ± (threshold − 1) makes the run `unusable`. Exit: 0 pass, 1 fail, 3 inconclusive or unusable, 2 usage.
 * Both sides run head's `bench/` directory, so only `src/` differs between them.
 */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { loadavg, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { bootstrap, controlUsable, type Interval, median, pairedRatios, type Verdict, verdict } from "./stats.ts";

const argv = Bun.argv.slice(2);
const split = argv.indexOf("--");
const own = split < 0 ? argv : argv.slice(0, split);
const passthrough = split < 0 ? [] : argv.slice(split + 1);
const positional: string[] = [];
const wanted: string[] = [];
const gated: string[] = [];
let runs = 7;
let maxRuns: number | undefined;
let threshold = 1.02;
for (let i = 0; i < own.length; i++) {
  const arg = own[i] as string;
  const list = (into: string[]) => {
    while (own[i + 1] && !own[i + 1]?.startsWith("--")) into.push(own[++i] as string);
  };
  if (arg === "--runs") runs = Number(own[++i]);
  else if (arg === "--max-runs") maxRuns = Number(own[++i]);
  else if (arg === "--threshold") threshold = Number(own[++i]);
  else if (arg === "--metric") list(wanted);
  else if (arg === "--gate") list(gated);
  else positional.push(arg);
}
// Extra rounds only chase the rows a task names: with every CPU row gated, one is nearly always undecided.
maxRuns ??= gated.length ? runs * 2 : runs;
const [ref, benchArg] = positional;
if (
  !ref ||
  !benchArg ||
  positional.length > 2 ||
  !Number.isInteger(runs) ||
  runs < 2 ||
  !Number.isInteger(maxRuns) ||
  maxRuns < runs ||
  !(threshold > 1)
) {
  console.error(
    "usage: bun bench/ab.ts <ref> <bench-file> [--runs 7] [--max-runs 14] [--threshold 1.02] [--gate <metric>…] [--metric <name>…] [-- <bench args>]",
  );
  process.exit(2);
}

const head = resolve(import.meta.dir, "..");
/** Relative to the repo root, so each side runs its own copy. */
const bench = relative(head, resolve(benchArg ?? ""));
const load = () => loadavg().map((value) => value.toFixed(2));

async function run(cmd: string[], cwd: string): Promise<{ code: number; out: string }> {
  const child = Bun.spawn({ cmd, cwd, stdout: "pipe", stderr: "pipe", timeout: 600_000 });
  const [out, err] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code: await child.exited, out: out + err };
}

async function must(cmd: string[], cwd: string): Promise<void> {
  const { code, out } = await run(cmd, cwd);
  if (code !== 0) throw new Error(`${cmd.join(" ")} (in ${cwd}) exited ${code}:\n${out}`);
}

const scratch = await mkdtemp(join(tmpdir(), "lf-ab-"));
const base = join(scratch, "base");
let cleaned = false;
async function cleanup(): Promise<void> {
  if (cleaned) return;
  cleaned = true;
  await run(["git", "worktree", "remove", "--force", base], head);
  await rm(scratch, { recursive: true, force: true });
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void cleanup().finally(() => process.exit(130)));

try {
  console.log(`base ${ref}: creating worktree and installing`);
  await must(["git", "worktree", "add", "--detach", base, ref], head);
  await must(["bun", "install", "--frozen-lockfile"], base);
  // The same bench code on both sides; only src/ differs.
  await cp(join(head, "bench"), join(base, "bench"), { recursive: true });

  type Side = "base" | "head" | "control";
  const samples: Record<Side, Record<string, number>[]> = { base: [], head: [], control: [] };
  const loadBefore = load();
  async function round(i: number): Promise<void> {
    const order: Side[] = i % 2 ? ["control", "head", "base"] : ["base", "head", "control"];
    for (const side of order) {
      const cwd = side === "head" ? head : base;
      const json = join(scratch, `${side}-${i}.json`);
      // --out keeps the streaming bench from rewriting tracked evidence; the others ignore it.
      const cmd = ["bun", "--conditions", "liveframe:source", bench, "--json", json, "--out", `${json}.md`];
      const { code, out } = await run([...cmd, ...passthrough], cwd);
      const file = Bun.file(json);
      if (!(await file.exists())) throw new Error(`${side} run ${i + 1} wrote no metrics (exit ${code}):\n${out}`);
      samples[side].push(await file.json());
      console.log(`run ${i + 1} ${side}: exit ${code}; load ${load().join(" ")}`);
    }
  }

  const series = (side: Side, name: string) => samples[side].map((sample) => sample[name]);
  const complete = (name: string) =>
    (["base", "head", "control"] as const).every((side) => series(side, name).every((v) => typeof v === "number"));
  const intervalOf = (side: "head" | "control", name: string): Interval =>
    bootstrap(pairedRatios(series("base", name) as number[], series(side, name) as number[]));
  const allNames = () => Object.keys(samples.head[0] ?? {});
  const gates = () => (gated.length ? gated : allNames().filter((name) => /cpuMs$/i.test(name)));
  const decide = (name: string): Verdict | "unusable" | "missing" => {
    if (!complete(name)) return "missing";
    if (!controlUsable(intervalOf("control", name), threshold)) return "unusable";
    return verdict(intervalOf("head", name), threshold);
  };

  let rounds = 0;
  while (rounds < runs) await round(rounds++);
  for (;;) {
    const open = gates().filter((name) => decide(name) === "inconclusive");
    const failed = gates().some((name) => decide(name) === "fail");
    if (!open.length || failed || rounds >= (maxRuns as number)) break;
    console.log(
      `after ${rounds} rounds: ${open.length} gated row(s) inconclusive (${open.join(", ")}); adding a round`,
    );
    await round(rounds++);
  }
  const loadAfter = load();

  const fmt = (interval: Interval) =>
    `${interval.median.toFixed(3)} [${interval.low.toFixed(3)}, ${interval.high.toFixed(3)}]`;
  const gateSet = new Set(gates());
  const names = wanted.length ? wanted : allNames();
  const rows: string[][] = [
    ["metric", "base median", "head median", "head/base [95%]", "control/base [95%]", "verdict"],
  ];
  for (const name of names) {
    if (!complete(name)) {
      rows.push([name, "—", "—", "missing on one side", "", gateSet.has(name) ? "missing" : ""]);
      continue;
    }
    rows.push([
      name,
      median(series("base", name) as number[]).toPrecision(4),
      median(series("head", name) as number[]).toPrecision(4),
      fmt(intervalOf("head", name)),
      fmt(intervalOf("control", name)),
      gateSet.has(name) ? decide(name) : "",
    ]);
  }
  const widths = rows[0]?.map((_, col) => Math.max(...rows.map((row) => (row[col] as string).length))) ?? [];
  console.log(
    `\n${bench}: ${rounds} rounds (base, head, control), base ${ref} vs head (checkout); threshold ${threshold}`,
  );
  for (const row of rows)
    console.log(
      row
        .map((cell, col) => cell.padEnd(widths[col] as number))
        .join("  ")
        .trimEnd(),
    );
  console.log(`load average (1/5/15 min) before: ${loadBefore.join(" ")}; after: ${loadAfter.join(" ")}`);
  const verdicts = [...gateSet].map(decide);
  const overall = !verdicts.length
    ? "no gated rows"
    : verdicts.includes("fail")
      ? "fail"
      : verdicts.every((v) => v === "pass")
        ? "pass"
        : "inconclusive";
  console.log(`verdict: ${overall} (gated: ${[...gateSet].join(", ") || "none"})`);
  process.exitCode = overall === "pass" ? 0 : overall === "fail" ? 1 : 3;
} finally {
  await cleanup();
}
