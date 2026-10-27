import type { Result } from "../errors.ts";
import { type Capabilities, documentChecks } from "../formats/capabilities.ts";
import type { Manifest } from "../formats/manifest.ts";
import { type Scenario, validateScenario } from "../formats/package.ts";
import { checkValue, isLanguageSchema, isRecord, sourceOutcome } from "../schema.ts";
import { canonicalJson } from "./hash.ts";

/** Expands one source alias using the seed envelope's value for the successful outcome. */
export function outcomeScenarios(
  scenario: Scenario,
  options: {
    readonly source: string;
    readonly manifest: Pick<Manifest, "sources">;
    readonly capabilities: Capabilities;
  },
): Result<readonly Scenario[]> {
  const c = documentChecks();
  const { source, manifest, capabilities } = options;
  const declared = Object.hasOwn(manifest.sources, source) ? manifest.sources[source] : undefined;
  const capability =
    declared && Object.hasOwn(capabilities.sources, declared.source)
      ? capabilities.sources[declared.source]
      : undefined;
  if (!capability) {
    c.reject("/source", "Source alias or its capability is undeclared", "unknown-name");
    return { ok: false, errors: c.errors };
  }
  const schema = capability.result;
  const payload = isLanguageSchema(schema) && "mapping" in schema ? schema.mapping.ok?.properties.value : undefined;
  try {
    if (!payload || canonicalJson(schema) !== canonicalJson(sourceOutcome(payload))) {
      c.reject("/source", "Expected a sourceOutcome result schema");
      return { ok: false, errors: c.errors };
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    c.reject("/source", error.message);
    return { ok: false, errors: c.errors };
  }
  const checked = validateScenario(scenario);
  if (!checked.ok) return checked;
  const seed = Object.hasOwn(scenario.data, source) ? scenario.data[source] : undefined;
  c.collect(checkValue(schema, seed), "/data/" + source.replace(/~/g, "~0").replace(/\//g, "~1"));
  if (!isRecord(seed) || !Object.hasOwn(seed, "value"))
    c.reject("/source", "The seed envelope must contain a valid value for the ok scenario");
  if (c.errors.length) return { ok: false, errors: c.errors };
  const seedValue = isRecord(seed) ? seed.value : undefined;
  const generated = ["ok", "unauthorized", "unavailable", "stale", "failed"].map((status) => ({
    ...scenario,
    name: `${scenario.name}.${status}`,
    data: { ...scenario.data, [source]: status === "ok" ? { status, value: seedValue } : { status } },
  }));
  const scenarios: Scenario[] = [];
  for (const entry of generated) {
    const checked = validateScenario(entry);
    c.collect(checked, "");
    if (checked.ok) scenarios.push(checked.value);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: scenarios };
}
