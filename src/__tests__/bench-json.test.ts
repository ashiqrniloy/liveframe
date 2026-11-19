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

const codeSplitMetrics: Record<string, string> = {
  storeReadMs: "code_split_store_read_ms",
  fileStoreReadMs: "code_split_file_store_read_ms",
  verifyUncachedMs: "code_split_verify_uncached_ms",
  verifyVerifiedMs: "code_split_verify_verified_ms",
  equalityMs: "code_split_equality_ms",
  bindAndFitMs: "code_split_bind_and_fit_ms",
  renderKeyMs: "code_split_render_key_ms",
  runnerMs: "code_split_runner_ms",
  validateTreeMs: "code_split_validate_tree_ms",
  diffTreesMs: "code_split_diff_trees_ms",
};

const codeStoreMetrics: Record<"memoryStore" | "fileStore", Record<string, string>> = {
  memoryStore: {
    renderUncachedMs: "code_render_uncached_ms",
    renderVerifiedMs: "code_render_verified_ms",
    skippedMs: "code_skipped_ms",
    loadUncachedMs: "code_load_uncached_ms",
    loadVerifiedMs: "code_load_verified_ms",
  },
  fileStore: {
    renderUncachedMs: "code_file_render_uncached_ms",
    renderVerifiedMs: "code_file_render_verified_ms",
    skippedMs: "code_file_skipped_ms",
    loadUncachedMs: "code_file_load_uncached_ms",
    loadVerifiedMs: "code_file_load_verified_ms",
  },
};

test("bench_json_reports_the_code_package_split", () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-bench-host-json-"));
  try {
    const file = join(dir, "host.json");
    const run = Bun.spawnSync(
      ["bun", "--conditions", "liveframe:source", "bench/host.bench.ts", "--runs", "3", "--json", file],
      {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const lines = run.stdout
      .toString()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const codeLine = lines.find((line) => line.subject === "agent-home") as
      | {
          memoryStore: Record<string, number>;
          fileStore: Record<string, number>;
          split: Record<string, number>;
        }
      | undefined;
    expect(codeLine, "agent-home JSON line not printed").toBeDefined();
    const metrics = JSON.parse(readFileSync(file, "utf8")) as Record<string, number>;

    expect(Object.keys(codeLine?.split ?? {}).sort()).toEqual(Object.keys(codeSplitMetrics).sort());
    for (const [row, metricKey] of Object.entries(codeSplitMetrics)) {
      const value = codeLine?.split[row];
      expect(typeof value).toBe("number");
      expect(Number.isFinite(value) && (value as number) > 0, `split.${row} must be > 0`).toBe(true);
      expect(metrics[metricKey]).toBe(value);
    }

    for (const storeName of ["memoryStore", "fileStore"] as const) {
      const storeRows = codeLine?.[storeName] ?? {};
      const expected = codeStoreMetrics[storeName];
      expect(Object.keys(storeRows).sort()).toEqual(Object.keys(expected).sort());
      for (const [row, metricKey] of Object.entries(expected)) {
        const value = storeRows[row];
        expect(typeof value).toBe("number");
        expect(Number.isFinite(value) && (value as number) > 0, `${storeName}.${row} must be > 0`).toBe(true);
        expect(metrics[metricKey]).toBe(value);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);

const mountMetrics = [
  "mount.createRoot.renders",
  "mount.createRoot.pass1Renders",
  "mount.createRoot.pass2Renders",
  "mount.createRoot.wallMs",
  "mount.createRoot.pass1Ms",
  "mount.createRoot.pass2Ms",
  "mount.createRoot.secondPassShare",
  "mount.hydrateRoot.renders",
  "mount.hydrateRoot.pass1Renders",
  "mount.hydrateRoot.pass2Renders",
  "mount.hydrateRoot.wallMs",
  "mount.hydrateRoot.pass1Ms",
  "mount.hydrateRoot.pass2Ms",
  "mount.hydrateRoot.secondPassShare",
] as const;

const focusMetrics = [
  "focus.host0.on.commitMs",
  "focus.host0.off.commitMs",
  "focus.host0.diffMs",
  "focus.host1000.on.commitMs",
  "focus.host1000.off.commitMs",
  "focus.host1000.diffMs",
  "focus.host5000.on.commitMs",
  "focus.host5000.off.commitMs",
  "focus.host5000.diffMs",
] as const;

test("bench_json_reports_mount_and_focus_rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "lf-bench-stream-json-"));
  try {
    const file = join(dir, "streaming.json");
    const run = Bun.spawnSync(
      [
        "bun",
        "--conditions",
        "liveframe:source",
        "bench/streaming.bench.ts",
        "--production",
        "--runs",
        "2",
        "--json",
        file,
      ],
      {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const stdout = run.stdout.toString();
    expect(stdout).toContain("mount createRoot:");
    expect(stdout).toContain("mount hydrateRoot:");
    expect(stdout).toContain("focus host=0:");
    expect(stdout).toContain("focus host=1000:");
    expect(stdout).toContain("focus host=5000:");

    const metrics = JSON.parse(readFileSync(file, "utf8")) as Record<string, number>;
    for (const key of mountMetrics) {
      const value = metrics[key];
      expect(typeof value, `${key} missing`).toBe("number");
      expect(Number.isFinite(value), `${key} must be finite`).toBe(true);
    }
    expect(metrics["mount.createRoot.renders"]).toBeGreaterThanOrEqual(679);
    expect(metrics["mount.hydrateRoot.renders"]).toBeGreaterThanOrEqual(679);

    for (const key of focusMetrics) {
      const value = metrics[key];
      expect(typeof value, `${key} missing`).toBe("number");
      expect(Number.isFinite(value), `${key} must be finite`).toBe(true);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);
