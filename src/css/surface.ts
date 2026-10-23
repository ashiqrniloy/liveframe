import { isRecord } from "../formats/capabilities.ts";
import type { DesignSystem } from "../formats/design-system.ts";
import type { Theme } from "../formats/theme.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";

/** Scope attributes for an installed theme/system and a validated tree. */
export function surfaceAttributes({
  theme,
  designSystem,
  tree,
}: {
  theme: Pick<Theme, "id" | "version">;
  designSystem: Pick<DesignSystem, "id" | "version">;
  tree: UiTree;
}): { class: string; "data-lf-theme": string; "data-lf-ds": string } {
  const pending: UiNode[] = [tree.root];
  let responsive = false;
  while (pending.length) {
    const node = pending.pop();
    if (!node) break;
    if (Object.values(node.style ?? {}).some(isRecord)) {
      responsive = true;
      break;
    }
    if (node.children) pending.push(...node.children);
  }
  return {
    class: `lf_surface${responsive ? " lf_container" : ""}`,
    "data-lf-theme": `${theme.id}@${theme.version}`,
    "data-lf-ds": `${designSystem.id}@${designSystem.version}`,
  };
}
