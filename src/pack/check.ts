import type { LiveframeError } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import { isRecord } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { errorMessage } from "../internal.ts";
import type { Runner } from "../preview/runner.ts";
import { compileValidator } from "../validate/compile.ts";
import { verifyPackage } from "./verify.ts";

/** One package's result: `ok` when it verifies and, with a runner, every scenario renders a valid tree. */
export type PackageCheck = {
  readonly id: string;
  readonly version: string;
  readonly hash: string;
  readonly ok: boolean;
  readonly errors: readonly LiveframeError[];
};

const MAX_ERRORS = 20;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

type Install = { catalog: Catalog; capabilities: Capabilities };

/** Renders every scenario of a verified package through `runner` and validates each tree on the host. */
async function renderScenarios(pkg: WidgetPackage, install: Install, runner: Runner): Promise<LiveframeError[]> {
  const validator = compileValidator({ ...install, manifest: pkg.manifest });
  const found: LiveframeError[] = [];
  for (const [i, scenario] of pkg.scenarios.entries()) {
    if (found.length >= MAX_ERRORS) break;
    const at = `/scenarios/${i}`;
    const inputs = {
      params: scenario.params,
      state: scenario.state === undefined ? pkg.manifest.initialState : scenario.state,
      context: scenario.context,
      data: scenario.data,
      actions: scenario.actions ?? {},
    };
    try {
      const rendered = await runner.render(pkg, inputs, { ...install, surfaceId: "check", revision: 1 });
      const result = rendered.ok ? validator.validateTree(rendered.value) : rendered;
      if (!result.ok) found.push(...result.errors.map((error) => ({ ...error, pointer: `${at}${error.pointer}` })));
    } catch (error) {
      found.push({ kind: "render-failed", pointer: at, message: errorMessage(error) });
    }
  }
  return found.slice(0, MAX_ERRORS);
}

/**
 * Reports which stored packages still work against `catalog` and `capabilities`, typically a new
 * catalog version. Each package goes through `verifyPackage`; given a `runner`, every scenario
 * is then rendered and its tree validated on the host. It never mutates, stores or defaults a
 * runner: without one nothing renders, and a code package renders only through the runner the
 * caller trusts to run it (law 1).
 */
export async function checkPackages(
  packages: readonly unknown[],
  options: Install & { runner?: Runner },
): Promise<readonly PackageCheck[]> {
  const { runner, ...install } = options;
  const report: PackageCheck[] = [];
  for (const doc of packages) {
    const manifest = isRecord(doc) && isRecord(doc.manifest) ? doc.manifest : {};
    const identity = {
      id: text(manifest.id),
      version: text(manifest.version),
      hash: isRecord(doc) ? text(doc.hash) : "",
    };
    const verified = verifyPackage(doc, install);
    const errors = !verified.ok
      ? verified.errors
      : runner
        ? await renderScenarios(verified.value, install, runner)
        : [];
    report.push({ ...identity, ok: errors.length === 0, errors });
  }
  return report;
}
