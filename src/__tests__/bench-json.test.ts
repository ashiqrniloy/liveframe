import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;

/** Each JSON key with the printed line it must agree with; the first capture is the printed figure. */
const printed: Record<string, RegExp> = {
  "styleDeclarations.usPerNode": /^style_declarations_per_node: ([\d.]+) µs\/node/m,
  "styleDeclarations.msPerTree": /^style_declarations_per_node: [\d.]+ µs\/node; ([\d.]+) ms\/tree/m,
  "base.msPerSheet": /^base: ([\d.]+) ms\/sheet/m,
  "certified-theme.msPerSheet": /^certified theme: ([\d.]+) ms\/sheet/m,
  "certified-design-system.msPerSheet": /^certified design system: ([\d.]+) ms\/sheet/m,
  "rack-theme.msPerSheet": /^rack theme: ([\d.]+) ms\/sheet/m,
  "rack-design-system.msPerSheet": /^rack design system: ([\d.]+) ms\/sheet/m,
};

test("bench_json_flag_writes_the_printed_metrics", () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-bench-json-"));
  try {
    const file = join(dir, "css.json");
    const run = Bun.spawnSync(
      ["bun", "--conditions", "liveframe:source", "bench/css.bench.ts", "--runs", "5", "--json", file],
      {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const metrics = JSON.parse(readFileSync(file, "utf8")) as Record<string, number>;
    expect(Object.keys(metrics).sort()).toEqual(Object.keys(printed).sort());
    const stdout = run.stdout.toString();
    for (const [key, pattern] of Object.entries(printed)) {
      const line = pattern.exec(stdout)?.[1];
      expect(line, `${key} not printed`).toBeDefined();
      expect(Number(line)).toBeCloseTo(metrics[key] as number, 3);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);
