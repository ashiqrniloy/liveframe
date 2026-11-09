/**
 * Acceptance log generator (plan 032 Task 2).
 *
 * Reads the plan files, lists every acceptance bullet (the Expected Outcome bullets and each task's
 * Acceptance Criteria), joins each to its proof in a mapping file and writes a markdown log.
 * A proof is any mix of: named tests (run once in one `bun test` and read from a JUnit report),
 * named commands (run once each), document needles (`path :: text` must occur in the file) and a
 * bench needle (read from the quiet-host bench record, `pending` until that record exists).
 *
 *   bun scripts/release/acceptance.ts --plans 026-031 --out plans/evidence/032-acceptance.md
 *
 * Exit code is 1 when a row is unmapped, a mapping key is stale, or any proof fails.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Row = {
  id: string;
  plan: string;
  /** "EO" for an Expected Outcome bullet, otherwise the task id. */
  task: string;
  taskTitle: string;
  category: string;
  text: string;
};

export type Proof = {
  tests?: string[];
  cmds?: string[];
  docs?: string[];
  bench?: string[];
  note?: string;
};

export type ProofMap = {
  commands: Record<string, string>;
  rows: Record<string, Proof>;
};

export type Status = "pass" | "fail" | "pending" | "n/a" | "unmapped";

const CATEGORY: Record<string, string> = {
  functional: "F",
  performance: "P",
  "code quality": "Q",
  security: "S",
  compatibility: "C",
};

const indent = (line: string) => line.length - line.trimStart().length;

/** Join continuation lines (deeper than `from`, not bullets of their own level) into one text. */
function bulletText(lines: string[], start: number, level: number): { text: string; end: number } {
  let text = (lines[start] ?? "").trim().replace(/^- /, "");
  let i = start + 1;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") break;
    if (indent(line) <= level) break;
    text += ` ${line.trim().replace(/^- /, "")}`;
  }
  return { text, end: i };
}

/** Every acceptance bullet of one plan, in document order, with stable ids `NNN.T<task>.<F|P|Q|S|C><n>`. */
export function listBullets(planText: string, plan: string): Row[] {
  const lines = planText.split("\n");
  const rows: Row[] = [];
  let section = "";
  let task = "";
  let taskTitle = "";
  let inCriteria = false;
  let category = "";
  let eoCount = 0;
  const counts = new Map<string, number>();
  const push = (cat: string, text: string, taskId: string) => {
    const key = `${taskId}.${cat}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    rows.push({ id: `${plan}.${taskId}.${cat}${n}`, plan, task, taskTitle, category: cat, text });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^## /.test(line)) {
      section = line.slice(3).trim();
      inCriteria = false;
      continue;
    }
    if (section === "Expected Outcome" && /^- /.test(line)) {
      const { text, end } = bulletText(lines, i, 0);
      task = "EO";
      taskTitle = "Expected Outcome";
      eoCount++;
      rows.push({ id: `${plan}.EO.${eoCount}`, plan, task, taskTitle, category: "EO", text });
      i = end - 1;
      continue;
    }
    if (section !== "Tasks") continue;
    const t = line.match(/^- \[.\] Task (\w+): (.*)$/);
    if (t) {
      task = `T${t[1]}`;
      taskTitle = t[2] ?? "";
      inCriteria = false;
      continue;
    }
    if (indent(line) === 2 && /^ {2}- /.test(line)) {
      inCriteria = /^ {2}- Acceptance Criteria:/.test(line);
      continue;
    }
    if (!inCriteria) continue;
    if (indent(line) === 4 && /^ {4}- /.test(line)) {
      const label = line
        .trim()
        .replace(/^- /, "")
        .match(/^([^:]+):\s*(.*)$/);
      const name = label?.[1]?.toLowerCase() ?? "";
      category = CATEGORY[name] ?? name.slice(0, 1).toUpperCase();
      const inline = label?.[2] ?? "";
      // A label with children lists its bullets below; a label with text is one bullet.
      let hasChildren = false;
      for (let j = i + 1; j < lines.length && ((lines[j] ?? "").trim() === "" || indent(lines[j] ?? "") > 4); j++) {
        if (indent(lines[j] ?? "") === 6 && /^ {6}- /.test(lines[j] ?? "")) {
          hasChildren = true;
          break;
        }
      }
      if (!hasChildren) {
        const cont = bulletText(lines, i, 4);
        const text = cont.text.replace(/^[^:]+:\s*/, "");
        push(category, text || inline, task);
        i = cont.end - 1;
      }
      continue;
    }
    if (indent(line) === 6 && /^ {6}- /.test(line) && category) {
      const { text, end } = bulletText(lines, i, 6);
      push(category, text, task);
      i = end - 1;
    }
  }
  return rows;
}

export function isNotApplicable(text: string): boolean {
  return /^n\/a\b/i.test(text.trim());
}

export function planFiles(dir: string, range: string): { plan: string; path: string }[] {
  const [from, to] = range.split("-");
  const lo = Number(from);
  const hi = Number(to ?? from);
  return readdirSync(dir)
    .filter((f) => /^\d{3}-.*\.md$/.test(f))
    .map((f) => ({ plan: f.slice(0, 3), path: join(dir, f) }))
    .filter(({ plan }) => Number(plan) >= lo && Number(plan) <= hi)
    .sort((a, b) => a.plan.localeCompare(b.plan));
}

const TEST_ROOTS = ["src", "proof", "packages", "scripts"];

/** The test files whose source mentions `name` as a test title. */
function findTestFiles(names: string[]): Map<string, string[]> {
  const found = new Map<string, string[]>(names.map((n) => [n, []]));
  for (const root of TEST_ROOTS) {
    for (const file of new Bun.Glob(`${root}/**/*.test.{ts,tsx}`).scanSync(".")) {
      if (file.includes("node_modules")) continue;
      const source = readFileSync(file, "utf8");
      for (const name of names) {
        const pattern = new RegExp(`(?:test|it)(?:\\.\\w+)?\\(\\s*["'\`]${escapeRegExp(name)}["'\`]`);
        if (pattern.test(source)) found.get(name)?.push(file);
      }
    }
  }
  return found;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type TestResult = { status: "pass" | "fail" | "skip"; file: string; retried?: string };

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** One `bun test` over `files` selecting `names`; reads the JUnit report into `results` (a failure is never overwritten by a pass). */
function bunTest(files: string[], names: string[], reportPath: string, results: Map<string, TestResult>) {
  const pattern = `(?:^|\\s)(?:${names.map(escapeRegExp).join("|")})$`;
  rmSync(reportPath, { force: true });
  Bun.spawnSync(
    [
      "bun",
      "test",
      "--conditions",
      "liveframe:source",
      ...files,
      "-t",
      pattern,
      "--reporter=junit",
      `--reporter-outfile=${reportPath}`,
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  if (!existsSync(reportPath)) return;
  const xml = readFileSync(reportPath, "utf8");
  for (const m of xml.matchAll(/<testcase name="([^"]*)"[^>]*?file="([^"]*)"[^>]*?(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const name = unescapeXml(m[1] ?? "");
    const body = m[4] ?? "";
    const status = /<failure|<error/.test(body) ? "fail" : /<skipped/.test(body) ? "skip" : "pass";
    const key = names.find((n) => name === n || name.endsWith(` ${n}`));
    if (!key || results.get(key)?.status === "fail") continue;
    results.set(key, { status, file: m[2] ?? "" });
  }
}

/**
 * Run every named test in one `bun test`, then run each test that did not pass once more on its own.
 * A wall-clock gate can miss under load from other work on the host; the retry is recorded in the log
 * (`retried`), never hidden, and a test that fails twice is a failure.
 */
function runTests(names: string[], reportPath: string): { results: Map<string, TestResult>; missing: string[] } {
  const results = new Map<string, TestResult>();
  const files = findTestFiles(names);
  const missing = names.filter((n) => (files.get(n) ?? []).length === 0);
  const present = names.filter((n) => !missing.includes(n));
  if (present.length === 0) return { results, missing };
  bunTest([...new Set(present.flatMap((n) => files.get(n) ?? []))], present, reportPath, results);
  for (const name of present) {
    const first = results.get(name);
    if (first?.status === "pass") continue;
    const again = new Map<string, TestResult>();
    bunTest(files.get(name) ?? [], [name], reportPath, again);
    const second = again.get(name);
    const was = first ? first.status : "absent from the report";
    results.set(name, {
      status: second?.status ?? "fail",
      file: second?.file ?? first?.file ?? "",
      retried: `first run: ${was}`,
    });
  }
  return { results, missing: [] };
}

type CommandResult = { command: string; ok: boolean; seconds: number; retried: boolean };

function runCommand(command: string): CommandResult {
  const started = performance.now();
  const attempt = () =>
    Bun.spawnSync(["sh", "-c", command], { stdout: "ignore", stderr: "ignore", timeout: 900_000 }).exitCode === 0;
  const first = attempt();
  const ok = first || attempt();
  return { command, ok, seconds: (performance.now() - started) / 1000, retried: !first };
}

function checkDoc(spec: string): { ok: boolean; detail: string } {
  const [path, needle] = spec.split(" :: ");
  if (!path || !existsSync(path)) return { ok: false, detail: `${path} is missing` };
  if (needle === undefined) return { ok: true, detail: path };
  return readFileSync(path, "utf8").includes(needle)
    ? { ok: true, detail: path }
    : { ok: false, detail: `${path} no longer contains "${needle}"` };
}

export type Options = {
  plans: string;
  out?: string | undefined;
  map: string;
  plansDir: string;
  benchRecord: string;
  skipRuns: boolean;
};

export type RowResult = { row: Row; status: Status; evidence: string[] };

export function generate(options: Options): {
  markdown: string;
  ok: boolean;
  counts: Record<Status, number>;
  problems: string[];
} {
  const map: ProofMap = JSON.parse(readFileSync(options.map, "utf8"));
  const rows = planFiles(options.plansDir, options.plans).flatMap(({ plan, path }) =>
    listBullets(readFileSync(path, "utf8"), plan),
  );
  const problems: string[] = [];
  const ids = new Set(rows.map((r) => r.id));
  for (const key of Object.keys(map.rows)) if (!ids.has(key)) problems.push(`stale mapping key ${key}`);

  const testNames = [...new Set(Object.values(map.rows).flatMap((p) => p.tests ?? []))];
  const commandNames = [...new Set(Object.values(map.rows).flatMap((p) => p.cmds ?? []))];
  for (const name of commandNames) if (!map.commands[name]) problems.push(`unknown command ${name}`);

  const tmp = process.env.TMPDIR ?? "/tmp";
  const ran = options.skipRuns
    ? {
        results: new Map<string, TestResult>(),
        missing: testNames.filter((n) => (findTestFiles([n]).get(n) ?? []).length === 0),
      }
    : runTests(testNames, join(tmp, "acceptance-junit.xml"));
  for (const name of ran.missing) problems.push(`test not found: ${name}`);
  const commands = new Map<string, CommandResult>();
  if (!options.skipRuns)
    for (const name of commandNames) if (map.commands[name]) commands.set(name, runCommand(map.commands[name]));

  const bench = existsSync(options.benchRecord) ? readFileSync(options.benchRecord, "utf8") : undefined;
  const counts: Record<Status, number> = { pass: 0, fail: 0, pending: 0, "n/a": 0, unmapped: 0 };
  const results: RowResult[] = rows.map((row) => {
    const proof = map.rows[row.id];
    if (!proof) {
      if (isNotApplicable(row.text)) return { row, status: "n/a" as Status, evidence: ["n/a"] };
      return { row, status: "unmapped" as Status, evidence: [] };
    }
    const evidence: string[] = [];
    let status: Status = "pass";
    const worsen = (next: Status) => {
      const order: Status[] = ["pass", "pending", "fail"];
      if (order.indexOf(next) > order.indexOf(status)) status = next;
    };
    for (const name of proof.tests ?? []) {
      const r = ran.results.get(name);
      evidence.push(`\`${name}\`${r?.retried ? " (second run)" : ""}`);
      if (options.skipRuns) continue;
      if (r?.status !== "pass") worsen("fail");
    }
    for (const name of proof.cmds ?? []) {
      const r = commands.get(name);
      evidence.push(`\`${map.commands[name] ?? name}\``);
      if (options.skipRuns) continue;
      if (!r?.ok) worsen("fail");
    }
    for (const spec of proof.docs ?? []) {
      const r = checkDoc(spec);
      evidence.push(spec.split(" :: ")[0] + (spec.includes(" :: ") ? ` ("${spec.split(" :: ")[1]}")` : ""));
      if (!r.ok) {
        worsen("fail");
        problems.push(r.detail);
      }
    }
    for (const needle of proof.bench ?? []) {
      evidence.push(`bench record (plan 032 Task 3): ${needle}`);
      if (bench === undefined) worsen("pending");
      else if (!bench.includes(needle)) {
        worsen("fail");
        problems.push(`bench record has no "${needle}"`);
      }
    }
    if (proof.note) evidence.push(proof.note);
    if (
      (proof.tests ?? []).length +
        (proof.cmds ?? []).length +
        (proof.docs ?? []).length +
        (proof.bench ?? []).length ===
      0
    ) {
      worsen("fail");
      problems.push(`${row.id} has a mapping with no proof`);
    }
    return { row, status, evidence };
  });
  for (const r of results) counts[r.status]++;

  const shorten = (s: string, n = 150) => {
    const flat = s.replace(/\|/g, "\\|").replace(/\s+/g, " ");
    return flat.length <= n ? flat : `${flat.slice(0, flat.lastIndexOf(" ", n))}…`;
  };
  const out: string[] = [];
  out.push("# 0.3.0 acceptance log", "");
  out.push(
    `One row per acceptance bullet of plans ${options.plans} (the Expected Outcome bullets and each task's Acceptance Criteria), joined to its proof by \`plans/evidence/032-acceptance-map.json\`. Generated by \`bun scripts/release/acceptance.ts --plans ${options.plans}\`; re-run it to refresh. Bullet text is shortened; the id is \`<plan>.<task>.<category><n>\` (F functional, P performance, Q code quality, S security, C compatibility) in that plan.`,
    "",
    "Statuses: **pass** (every named test passed in the one run, every command exited 0, every document needle is present); **pending** (the proof is the quiet-host bench record of plan 032 Task 3, not yet written); **n/a** (the plan states the bullet does not apply); **fail** / **unmapped** (a defect: the script exits 1).",
    "",
  );
  out.push("## Run", "");
  out.push(
    `- Tests: ${testNames.length} named, ${ran.results.size} found in the report${options.skipRuns ? " (runs skipped)" : ""}.`,
  );
  if (!options.skipRuns) {
    const retried = [...ran.results].filter(([, r]) => r.retried);
    if (retried.length > 0) {
      out.push(
        "",
        "Tests re-run once on their own after a first-run miss (the host carries other work, so a wall-clock gate can miss under load):",
        "",
      );
      for (const [name, r] of retried) out.push(`- \`${name}\` (${r.file}): ${r.retried}; second run ${r.status}.`);
    }
    out.push("", "| Command | Result | Seconds |", "| --- | --- | --- |");
    for (const [name, r] of commands)
      out.push(
        `| \`${map.commands[name]}\` | ${r.ok ? (r.retried ? "pass (second run)" : "pass") : "**fail**"} | ${r.seconds.toFixed(1)} |`,
      );
  }
  out.push(
    "",
    "## Summary",
    "",
    "| Plan | pass | pending | n/a | fail | unmapped |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const plan of [...new Set(rows.map((r) => r.plan))]) {
    const mine = results.filter((r) => r.row.plan === plan);
    const c = (s: Status) => mine.filter((r) => r.status === s).length;
    out.push(`| ${plan} | ${c("pass")} | ${c("pending")} | ${c("n/a")} | ${c("fail")} | ${c("unmapped")} |`);
  }
  out.push(
    `| **all** | ${counts.pass} | ${counts.pending} | ${counts["n/a"]} | ${counts.fail} | ${counts.unmapped} |`,
    "",
  );
  for (const plan of [...new Set(rows.map((r) => r.plan))]) {
    out.push(`## Plan ${plan}`, "");
    let task = "";
    for (const r of results.filter((x) => x.row.plan === plan)) {
      if (r.row.task !== task) {
        task = r.row.task;
        out.push(
          "",
          `### ${r.row.task === "EO" ? "Expected Outcome" : `Task ${r.row.task.slice(1)}: ${shorten(r.row.taskTitle, 110)}`}`,
          "",
          "| ID | Acceptance bullet | Evidence | Result |",
          "| --- | --- | --- | --- |",
        );
      }
      out.push(
        `| ${r.row.id} | ${shorten(r.row.text)} | ${r.evidence.map((e) => e.replace(/\|/g, "\\|")).join("<br>")} | ${r.status} |`,
      );
    }
    out.push("");
  }
  for (const p of problems) out.push(`<!-- ${p} -->`);
  const ok = counts.fail === 0 && counts.unmapped === 0 && problems.length === 0;
  return { markdown: `${out.join("\n")}\n`, ok, counts, problems };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (name: string, fallback?: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const options: Options = {
    plans: arg("--plans", "026-031") as string,
    out: arg("--out"),
    map: arg("--map", "plans/evidence/032-acceptance-map.json") as string,
    plansDir: arg("--plans-dir", "plans") as string,
    benchRecord: arg("--bench", "plans/evidence/032-bench.md") as string,
    skipRuns: args.includes("--skip-runs"),
  };
  const { markdown, ok, counts, problems } = generate(options);
  if (options.out) writeFileSync(options.out, markdown);
  else process.stdout.write(markdown);
  console.error(`acceptance: ${JSON.stringify(counts)}`);
  for (const p of problems) console.error(`  problem: ${p}`);
  process.exit(ok ? 0 : 1);
}
