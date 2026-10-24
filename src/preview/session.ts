import type { LiveframeError, Result } from "../errors.ts";
import { isRecord } from "../formats/capabilities.ts";
import type { Scenario, WidgetPackage } from "../formats/package.ts";
import type { Intent, Json, UiTree } from "../formats/tree.ts";
import { pack } from "../pack/pack.ts";
import { checkValue } from "../schema.ts";
import type { Runner, RunnerOptions } from "./runner.ts";

let nextSession = 0;

/** Backend-only draft iteration through the same packer and runner as production. */
export function createPreview({
  catalog,
  capabilities,
  runner,
}: Pick<RunnerOptions, "catalog" | "capabilities"> & { runner: Runner }) {
  const surfaceId = `preview-${++nextSession}`;
  let revision = 0;
  let pkg: WidgetPackage | undefined;
  type Selection = { scenario: Scenario; state: Json; context: Json; result?: Result<UiTree> };
  let current: Selection | undefined;
  let log: readonly Intent[] = [];

  function failure(kind: LiveframeError["kind"], pointer: string, message: string): Result<never> {
    return { ok: false, errors: [{ kind, pointer, message }] };
  }

  function selection(pkg: WidgetPackage, scenario: Scenario, state?: Json, context?: Json): Selection {
    return {
      scenario,
      state: state === undefined ? (scenario.state ?? pkg.manifest.initialState) : state,
      context: context === undefined ? scenario.context : context,
    };
  }

  async function run(active: WidgetPackage, selected: Selection): Promise<Result<UiTree>> {
    // shortcut: copy data per render until SDK validation caching is scoped to its source schema.
    const inputs = JSON.parse(
      JSON.stringify({
        params: selected.scenario.params,
        state: selected.state,
        context: selected.context,
        data: selected.scenario.data,
      }),
    );
    const result = await runner.render(active, inputs, { catalog, capabilities, surfaceId, revision: ++revision });
    if (pkg === active && current === selected) selected.result = result;
    return result;
  }

  return {
    update(draft: Parameters<typeof pack>[0]): Result<WidgetPackage> {
      const result = pack(draft, { catalog, capabilities });
      if (result.ok) {
        pkg = result.value;
        current = undefined;
        log = [];
      }
      return result;
    },
    async render({
      scenario,
      state,
      context,
    }: {
      scenario: string;
      state?: Json;
      context?: Json;
    }): Promise<Result<UiTree>> {
      if (!pkg) return failure("not-found", "", "No draft has been packed");
      const found = pkg.scenarios.find((entry) => entry.name === scenario);
      if (!found) return failure("not-found", "/scenario", "Unknown scenario");
      current = selection(pkg, found, state, context);
      return run(pkg, current);
    },
    async intent(intent: Intent): Promise<Result<UiTree>> {
      if (!pkg || !current?.result) return failure("not-found", "", "No current render");
      if (!isRecord(intent)) return failure("invalid-prop", "", "Expected an intent");
      if (intent.type === "setState") {
        if (typeof intent.key !== "string" || !Object.hasOwn(pkg.manifest.state.properties, intent.key))
          return failure("invalid-prop", "/key", "Undeclared state key");
        if (Object.keys(intent).some((key) => !["type", "key", "value"].includes(key)))
          return failure("invalid-prop", "", "Unexpected intent field");
        const schema = pkg.manifest.state.properties[intent.key];
        if (!schema) return failure("invalid-prop", "/key", "Undeclared state key");
        const checked = checkValue(schema, intent.value);
        if (!checked.ok)
          return {
            ok: false,
            errors: checked.errors.map((error) => ({
              ...error,
              kind: "invalid-prop",
              pointer: `/value${error.pointer}`,
            })),
          };
        if (!isRecord(current.state)) return failure("invalid-prop", "/state", "Expected object state");
        current = { ...current, state: { ...current.state, [intent.key]: JSON.parse(JSON.stringify(intent.value)) } };
        return run(pkg, current);
      }
      if (intent.type !== "action") return failure("invalid-prop", "/type", "Unknown intent type");
      if (!pkg.manifest.actions.includes(intent.name) || !Object.hasOwn(capabilities.actions, intent.name))
        return failure("undeclared-action", "/name", "Undeclared action");
      if (
        Object.keys(intent).some((key) => !["type", "name", "args", "bind"].includes(key)) ||
        intent.bind !== undefined
      )
        return failure("invalid-prop", "", "Expected a completed action");
      const capability = capabilities.actions[intent.name];
      if (!capability) return failure("undeclared-action", "/name", "Undeclared action");
      const checked = checkValue(capability.args, intent.args);
      if (!checked.ok)
        return {
          ok: false,
          errors: checked.errors.map((error) => ({ ...error, kind: "invalid-prop", pointer: `/args${error.pointer}` })),
        };
      log = [...log, JSON.parse(JSON.stringify(intent))];
      return current.result;
    },
    intents(): readonly Intent[] {
      return log;
    },
    async check(): Promise<Result<readonly { scenario: string; result: Result<UiTree> }[]>> {
      if (!pkg) return failure("not-found", "", "No draft has been packed");
      const active = pkg;
      const results: { scenario: string; result: Result<UiTree> }[] = [];
      for (const scenario of active.scenarios)
        results.push({ scenario: scenario.name, result: await run(active, selection(active, scenario)) });
      return { ok: true, value: results };
    },
  };
}
