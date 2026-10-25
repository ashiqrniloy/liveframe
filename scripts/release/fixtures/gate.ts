/** Shared fixture loading for the installed-archive gate steps. */
import { validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import type { Scenario } from "@arnilo/liveframe/pack";

export type DraftInput = {
  readonly files: Record<string, string>;
  readonly entry: string;
  readonly manifest: unknown;
  readonly scenarios: readonly Scenario[];
};

function source(name: string): Promise<string> {
  return Bun.file(new URL(`./widget/${name}`, import.meta.url)).text();
}

export function json(name: string): Promise<unknown> {
  return Bun.file(new URL(`./${name}.json`, import.meta.url)).json();
}

export function valid<T>(result: { ok: true; value: T } | { ok: false; errors: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

export async function draft(): Promise<DraftInput> {
  return {
    files: { "entry.tsx": await source("entry.tsx"), "card.tsx": await source("card.tsx") },
    entry: "entry.tsx",
    manifest: await json("manifest"),
    scenarios: [(await json("scenario")) as Scenario],
  };
}

export async function packageOptions() {
  const [catalog, capabilities] = await Promise.all([json("catalog"), json("capabilities")]);
  return {
    catalog: valid(validateCatalog(catalog)),
    capabilities: valid(validateCapabilities(capabilities)),
    surfaceId: "gate",
    revision: 1,
  };
}

export function inputs(input: DraftInput) {
  const first = input.scenarios[0];
  if (!first) throw new Error("The gate draft has no scenario");
  return { ...first, state: first.state ?? {} };
}
