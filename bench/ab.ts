/**
 * Interleaved A/B bench driver: compares this checkout (head) with a git ref (base).
 *
 *   timeout 1800 bun bench/ab.ts <ref> <bench-file> [--runs 9] [--metric <name>…] [-- <bench args>]
 *
 * Base and head alternate, base first, so machine-load drift hits both alike, and each metric is
 * reported as the median of the paired head/base ratios. It reports; it never fails on a budget.
 * Both sides run head's `bench/` directory, so only `src/` differs between them.
 */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { loadavg, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const argv = Bun.argv.slice(2);
const split = argv.indexOf("--");
const own = split < 0 ? argv : argv.slice(0, split);
const passthrough = split < 0 ? [] : argv.slice(split + 1);
const positional: string[] = [];
const wanted: string[] = [];
let runs = 9;
for (let i = 0; i < own.length; i++) {
  const arg = own[i] as string;
  if (arg === "--runs") runs = Number(own[++i]);
  else if (arg === "--metric") while (own[i + 1] && !own[i + 1]?.startsWith("--")) wanted.push(own[++i] as string);
  else positional.push(arg);
}
const [ref, benchArg] = positional;
if (!ref || !benchArg || positional.length > 2 || !Number.isInteger(runs) || runs < 1) {
  console.error("usage: bun bench/ab.ts <ref> <bench-file> [--runs 9] [--metric <name>…] [-- <bench args>]");
  process.exit(2);
}

const head = resolve(import.meta.dir, "..");
/** Relative to the repo root, so each side runs its own copy. */
const bench = relative(head, resolve(benchArg ?? ""));
const load = () => loadavg().map((value) => value.toFixed(2));
const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

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

  const samples: Record<"base" | "head", Record<string, number>[]> = { base: [], head: [] };
  const loadBefore = load();
  for (let i = 0; i < runs; i++) {
    for (const side of ["base", "head"] as const) {
      const cwd = side === "base" ? base : head;
      const json = join(scratch, `${side}-${i}.json`);
      // --out keeps the streaming bench from rewriting tracked evidence; the others ignore it.
      const cmd = ["bun", "--conditions", "liveframe:source", bench, "--json", json, "--out", `${json}.md`];
      const { code, out } = await run([...cmd, ...passthrough], cwd);
      const file = Bun.file(json);
      if (!(await file.exists())) throw new Error(`${side} run ${i + 1} wrote no metrics (exit ${code}):\n${out}`);
      samples[side].push(await file.json());
      console.log(`run ${i + 1}/${runs} ${side}: exit ${code}; load ${load().join(" ")}`);
    }
  }
  const loadAfter = load();

  const names = wanted.length ? wanted : Object.keys(samples.head[0] ?? {});
  const rows: string[][] = [["metric", "base median", "head median", "paired ratio (head/base)"]];
  for (const name of names) {
    const pairs = samples.base.map((b, i) => [b[name], samples.head[i]?.[name]] as const);
    if (pairs.some(([b, h]) => b === undefined || h === undefined)) {
      rows.push([name, "—", "—", "missing on one side"]);
      continue;
    }
    const b = pairs.map(([x]) => x as number);
    const h = pairs.map(([, y]) => y as number);
    const ratio = median(pairs.map(([x, y]) => (y as number) / (x as number)));
    rows.push([name, median(b).toPrecision(4), median(h).toPrecision(4), ratio.toFixed(3)]);
  }
  const widths = rows[0]?.map((_, col) => Math.max(...rows.map((row) => (row[col] as string).length))) ?? [];
  console.log(`\n${bench}: ${runs} paired runs, base ${ref} vs head (checkout)`);
  for (const row of rows)
    console.log(
      row
        .map((cell, col) => cell.padEnd(widths[col] as number))
        .join("  ")
        .trimEnd(),
    );
  console.log(`load average (1/5/15 min) before: ${loadBefore.join(" ")}; after: ${loadAfter.join(" ")}`);
} finally {
  await cleanup();
}
