import type { Result } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { canonicalJson } from "../pack/hash.ts";
import { inProcessRunner } from "../preview/in-process.ts";
import type { Runner, RunnerOptions } from "../preview/runner.ts";
import { templateRunner } from "../preview/template.ts";
import { type ConformanceCase, ConformanceFailure, check } from "./case.ts";
import { type Probe, runnerFixtures } from "./runner-fixtures.ts";

export type RunnerSuiteOptions = {
  /** Called once per case: each case gets a fresh runner, closed afterwards when it has `close()`. */
  runner(): Runner | Promise<Runner>;
  /** The install the supplied `packages` were packed against. */
  catalog: Catalog;
  capabilities: Capabilities;
  /** Verified packages: every scenario must render the tree the reference renderer produces. */
  packages: readonly WidgetPackage[];
  /** Adds the isolation cases: hostile code, the limits and a hold in one native call. */
  isolation?: boolean;
  /** The package kinds the runner renders; the other kind must be refused with `invalid-document`. */
  accepts?: "code" | "template" | "both";
  /** The limit handed to the probes that must be stopped (default 100, at most 200). */
  timeoutMs?: number;
  /** How long past `timeoutMs` a runner may take to report a stopped probe (default 1000). */
  slackMs?: number;
};

const SPEC = "§7.5";
/** Time for the renders that must succeed: they include a worker's or child's start. */
const OK_TIMEOUT_MS = 5000;
const CASE_TIMEOUT_MS = 30000;

function firstError(result: Result<unknown>): string {
  return result.ok ? "ok" : `${result.errors[0]?.kind}: ${result.errors[0]?.message}`;
}

/** Whether the tree holds this text; trees are JSON, so the quoted string is the node's text. */
function hasText(result: Result<unknown>, text: string): boolean {
  return result.ok && JSON.stringify(result.value).includes(JSON.stringify(text));
}

/**
 * Conformance cases for a `Runner` (spec §7.5): the contract every runner meets, and with
 * `isolation: true` the claims of a runner that says it contains hostile widget code. Each case
 * builds its own runner, so a case that kills one leaves the next unaffected.
 */
export function runnerSuite(options: RunnerSuiteOptions): ConformanceCase[] {
  const accepts = options.accepts ?? "both";
  const timeoutMs = options.timeoutMs ?? 100;
  const slackMs = options.slackMs ?? 1000;
  if (!(timeoutMs > 0 && timeoutMs <= 200)) throw new RangeError("runnerSuite timeoutMs must be in (0, 200]");
  const fixtures = runnerFixtures();
  const accepted = (kind: Probe["kind"]) => accepts === "both" || accepts === kind;
  const cases: ConformanceCase[] = [];

  function add(name: string, run: (runner: Runner) => Promise<void>) {
    cases.push({
      name,
      timeout: CASE_TIMEOUT_MS,
      async run() {
        let runner: Runner | undefined;
        try {
          runner = await options.runner();
          await run(runner);
        } catch (error) {
          if (error instanceof ConformanceFailure) throw error;
          throw new ConformanceFailure(name, SPEC, [error instanceof Error ? error.message : "Runner rejected"]);
        } finally {
          (runner as { close?: () => void } | undefined)?.close?.();
        }
      },
    });
  }

  const probeOptions = (limit: number, libraries?: readonly WidgetPackage[]): RunnerOptions => ({
    catalog: fixtures.catalog,
    capabilities: fixtures.capabilities,
    surfaceId: "runner",
    revision: 1,
    timeoutMs: limit,
    ...(libraries ? { libraries } : {}),
  });
  const package_ = (name: string) => fixtures.packages[name] as WidgetPackage;
  const renderOk = (runner: Runner, name: string) =>
    runner.render(package_(name), fixtures.inputs, probeOptions(OK_TIMEOUT_MS));
  const okName = accepted("code") ? "ok" : "templateOk";

  /** After a stopped probe the same runner must render again. */
  async function recovers(runner: Runner, rule: string) {
    const next = await renderOk(runner, okName);
    check(hasText(next, "ok"), rule, SPEC, [`The render after a stopped probe must succeed: ${firstError(next)}`]);
  }

  async function runProbe(runner: Runner, probe: Probe) {
    const libraries = probe.libraries?.map((id) => fixtures.libraries[id as keyof typeof fixtures.libraries]);
    const limit = probe.timed ? timeoutMs : OK_TIMEOUT_MS;
    const start = Date.now();
    const result = await runner.render(
      package_(probe.package),
      fixtures.inputs,
      probeOptions(limit, libraries as WidgetPackage[] | undefined),
    );
    const elapsed = Date.now() - start;
    const label = `${probe.package} (${probe.note})`;
    if (probe.expect.ok) {
      check(hasText(result, probe.expect.text), probe.rule, SPEC, [
        `${label}: expected a tree with the text ${JSON.stringify(probe.expect.text)}, got ${firstError(result)}`,
      ]);
      return;
    }
    check(!result.ok, probe.rule, SPEC, [`${label}: expected a failure, got a tree`]);
    if (probe.expect.kind)
      check(result.errors[0]?.kind === probe.expect.kind, probe.rule, SPEC, [
        `${label}: expected ${probe.expect.kind}, got ${firstError(result)}`,
      ]);
    if (probe.timed) {
      check(elapsed <= timeoutMs + slackMs, probe.rule, SPEC, [
        `${label}: stopped after ${Math.round(elapsed)} ms, over timeoutMs ${timeoutMs} + slack ${slackMs}`,
      ]);
      await recovers(runner, probe.rule);
    }
  }

  // Probes: one case per rule, in table order.
  for (const rule of new Set(fixtures.probes.map((probe) => probe.rule))) {
    const probes = fixtures.probes.filter((probe) => probe.rule === rule && accepted(probe.kind));
    if (probes.length === 0) continue;
    if (!options.isolation && probes[0]?.tier === "isolation") continue;
    add(rule, async (runner) => {
      for (const probe of probes) await runProbe(runner, probe);
    });
  }

  add("runner_returns_render_tree_for_supplied_packages", async (runner) => {
    const rule = "runner_returns_render_tree_for_supplied_packages";
    const reference = { code: inProcessRunner(), template: templateRunner() };
    const render = (target: Runner, pkg: WidgetPackage, scenario: WidgetPackage["scenarios"][number]) =>
      target.render(
        pkg,
        {
          params: scenario.params,
          state: scenario.state ?? pkg.manifest.initialState,
          context: scenario.context,
          data: scenario.data,
          actions: scenario.actions ?? {},
        },
        {
          catalog: options.catalog,
          capabilities: options.capabilities,
          surfaceId: "runner",
          revision: 1,
          timeoutMs: OK_TIMEOUT_MS,
        },
      );
    for (const pkg of options.packages) {
      const kind = pkg.template ? "template" : "code";
      for (const scenario of pkg.scenarios) {
        const label = `${pkg.manifest.id}@${pkg.manifest.version} / ${scenario.name}`;
        const actual = await render(runner, pkg, scenario);
        if (!accepted(kind)) {
          check(!actual.ok && actual.errors[0]?.kind === "invalid-document", rule, SPEC, [
            `${label}: a ${kind} package must be refused with invalid-document, got ${firstError(actual)}`,
          ]);
          continue;
        }
        const expected = await render(reference[kind], pkg, scenario);
        check(expected.ok, rule, SPEC, [`${label}: the reference renderer failed: ${firstError(expected)}`]);
        check(actual.ok, rule, SPEC, [`${label}: ${firstError(actual)}`]);
        check(canonicalJson(actual.value) === canonicalJson(expected.value), rule, SPEC, [
          `${label}: the tree differs from the reference renderer's`,
        ]);
      }
    }
  });

  if (!options.isolation) return cases;

  // Isolation: module state belongs to one render.
  if (accepted("code"))
    add("runner_isolation_no_state_between_renders", async (runner) => {
      const rule = "runner_isolation_no_state_between_renders";
      for (const name of ["stateA", "stateA", "stateB", "stateA"]) {
        const result = await renderOk(runner, name);
        const expected = `${name === "stateB" ? "B" : "A"}:1/1`;
        check(hasText(result, expected), rule, SPEC, [
          `${name}: expected ${expected}, so no state set by an earlier render; got ${firstError(result)}`,
        ]);
      }
    });

  // Isolation: widget code has no way to speak for the runner.
  if (accepted("code")) {
    add("runner_isolation_channel_is_not_writable", async (runner) => {
      const rule = "runner_isolation_channel_is_not_writable";
      const forged = await renderOk(runner, "forge");
      check(!JSON.stringify(forged).includes("FORGED"), rule, SPEC, ["A forged result reached the caller"]);
      await recovers(runner, rule);
    });
    add("runner_isolation_render_cannot_answer_another", async (runner) => {
      const rule = "runner_isolation_render_cannot_answer_another";
      const [forging, honest] = await Promise.all([renderOk(runner, "forge"), renderOk(runner, "ok")]);
      check(!JSON.stringify([forging, honest]).includes("FORGED"), rule, SPEC, ["A forged result reached the caller"]);
      check(hasText(honest, "ok"), rule, SPEC, [`The honest render was answered with: ${firstError(honest)}`]);
    });
  }
  return cases;
}
