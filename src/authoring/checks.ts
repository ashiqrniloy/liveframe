import type { LiveframeError, Result } from "../errors.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";

const nodes = (node: UiNode): number => 1 + (node.children?.reduce((sum, child) => sum + nodes(child), 0) ?? 0);

export type ScenarioStatus =
  | { scenario: string; ok: true; nodes: number }
  | (LiveframeError & { ok: false; scenarios: string[] });

/** Every scenario's status; identical errors are reported once, naming the scenarios that share them. */
export function checkAll(
  results: readonly { readonly scenario: string; readonly result: Result<UiTree> }[],
): ScenarioStatus[] {
  const statuses: ScenarioStatus[] = [];
  const shared = new Map<string, ScenarioStatus & { ok: false }>();
  for (const { scenario: name, result } of results) {
    if (result.ok) {
      statuses.push({ scenario: name, ok: true, nodes: nodes(result.value.root) });
      continue;
    }
    for (const error of result.errors) {
      const id = `${error.kind}\u0000${error.pointer}\u0000${error.message}\u0000${error.expected ?? ""}`;
      const existing = shared.get(id);
      if (existing) {
        if (!existing.scenarios.includes(name)) existing.scenarios.push(name);
        continue;
      }
      const entry: ScenarioStatus & { ok: false } = { ...error, ok: false, scenarios: [name] };
      shared.set(id, entry);
      statuses.push(entry);
    }
  }
  return statuses;
}
