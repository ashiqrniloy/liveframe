import { expect, test } from "bun:test";
import { type ConformanceCase, ConformanceFailure, runnerSuite } from "@arnilo/liveframe/conformance";
import { pack } from "@arnilo/liveframe/pack";
import { inProcessRunner, templateRunner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import type { Result } from "../index.ts";
import { validateCapabilities, validateCatalog } from "../index.ts";
import { runnerFixtureDocument } from "../conformance/runner-fixtures.ts";
import type { Runner } from "../preview/runner.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const install = { catalog, capabilities };
const widget = proofWidgets[0];
const draft = drafts[0];
if (!widget || !draft) throw new Error("Missing agent-home fixture");
const packages = [
  value(pack(draft, install)),
  value(pack({ template: agentHomeTemplate, manifest: widget.manifest, scenarios: widget.scenarios }, install)),
];

async function run(cases: readonly ConformanceCase[], names?: readonly string[]) {
  const outcomes = new Map<string, unknown>();
  for (const c of cases) {
    if (names && !names.includes(c.name)) continue;
    try {
      await c.run();
      outcomes.set(c.name, "pass");
    } catch (error) {
      outcomes.set(c.name, error);
    }
  }
  return outcomes;
}

const passes = (outcomes: Map<string, unknown>) =>
  [...outcomes].filter(([, outcome]) => outcome !== "pass").map(([name, outcome]) => `${name}: ${String(outcome)}`);

test("reference_runners_pass_contract_cases", async () => {
  const subjects: [string, () => Runner, "both" | "template"][] = [
    ["in-process", () => inProcessRunner(), "both"],
    ["worker", () => workerRunner(), "both"],
    ["template", () => templateRunner(), "template"],
  ];
  for (const [name, runner, accepts] of subjects) {
    const start = performance.now();
    const cases = runnerSuite({ runner, ...install, packages, accepts });
    const outcomes = await run(cases);
    expect(passes(outcomes), name).toEqual([]);
    expect(outcomes.has("runner_returns_render_tree_for_supplied_packages")).toBe(true);
    expect(outcomes.has("runner_bounds_time")).toBe(accepts === "both");
    expect(outcomes.has("runner_isolation_no_host_globals")).toBe(false);
    console.log(`runner suite ${name}: ${cases.length} cases, ${Math.round(performance.now() - start)} ms`);
  }
}, 120000);

test("broken_runner_fails_named_rule", async () => {
  const wrong: Runner = {
    // Renders a tree no validator accepted, never checks a hash, never bounds time.
    async render(_pkg, _inputs, options) {
      const limit = options.timeoutMs ?? 0;
      if (limit <= 200) await new Promise((resolve) => setTimeout(resolve, limit + 300));
      return { ok: true, value: { format: "liveframe-tree/1", wrong: "tree" } as never };
    },
  };
  const outcomes = await run(runnerSuite({ runner: () => wrong, ...install, packages }));
  for (const rule of [
    "runner_returns_render_tree",
    "runner_refuses_hash_mismatch",
    "runner_bounds_time",
    "runner_never_accepts_invalid_tree",
    "runner_returns_render_tree_for_supplied_packages",
  ]) {
    const outcome = outcomes.get(rule);
    expect(outcome, rule).toBeInstanceOf(ConformanceFailure);
    expect(outcome).toMatchObject({ rule, spec: "§7.5" });
  }
}, 30000);

test("isolation_cases_fail_for_in_process_runner", async () => {
  const cases = runnerSuite({ runner: () => inProcessRunner(), ...install, packages, isolation: true });
  const names = cases.map((c) => c.name);
  for (const rule of [
    "runner_isolation_no_host_globals",
    "runner_isolation_no_state_between_renders",
    "runner_isolation_infinite_loop",
    "runner_isolation_memory_bomb",
    "runner_isolation_deep_recursion",
    "runner_isolation_native_hold",
    "runner_isolation_channel_is_not_writable",
    "runner_isolation_render_cannot_answer_another",
  ])
    expect(names).toContain(rule);
  // The hostile loops would hang a same-thread runner, which is the point of the case: run the ones it can answer.
  const outcomes = await run(cases, ["runner_isolation_no_host_globals", "runner_isolation_no_state_between_renders"]);
  for (const [rule, outcome] of outcomes) {
    expect(outcome, rule).toBeInstanceOf(ConformanceFailure);
    expect(outcome).toMatchObject({ rule, spec: "§7.5" });
  }
  expect(outcomes.size).toBe(2);
});

test("runner_fixture_document_matches_the_suite", async () => {
  const shipped = await Bun.file(new URL("../../conformance/runner/fixtures.json", import.meta.url)).json();
  expect(shipped).toEqual(JSON.parse(JSON.stringify(runnerFixtureDocument())));
  expect(import.meta.resolve("@arnilo/liveframe/conformance/runner/fixtures.json")).toBe(
    new URL("../../conformance/runner/fixtures.json", import.meta.url).href,
  );
  // Every probe names a package the document holds, and every library it needs.
  for (const probe of shipped.probes) {
    expect(shipped.packages[probe.package], probe.package).toBeDefined();
    for (const id of probe.libraries ?? []) expect(shipped.libraries[id], id).toBeDefined();
  }
});
