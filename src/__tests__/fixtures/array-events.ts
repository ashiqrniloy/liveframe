import { arr, type Capabilities, compileValidator, type Intent, type Manifest, obj, str } from "../../index.ts";
import baseManifest from "./proof/agent-home.manifest.json" with { type: "json" };
import baseCapabilities from "./proof/capabilities.json" with { type: "json" };
import { catalog as baseCatalog, withRoot } from "./react-surface.tsx";

/** A multi-select: the event carries the selected ids, at most three of at most 64 characters. */
export const carry = { items: str({ maxLength: 64 }), maxItems: 3 } as const;
export const ids = arr(str({ maxLength: 64 }), { maxItems: 3 });
export const catalog = {
  ...baseCatalog,
  definitions: baseCatalog.definitions.map((definition) =>
    definition.kind === "stack"
      ? ({
          ...definition,
          events: { onSelect: { carries: { array: carry }, description: "The selected ids." } },
        } as const)
      : definition,
  ),
};
export const capabilities: Capabilities = {
  ...(baseCapabilities as Capabilities),
  actions: {
    ...(baseCapabilities as Capabilities).actions,
    "tasks.pick": {
      description: "Pick tasks.",
      args: obj({ list: str({ maxLength: 80 }), ids: arr(str({ maxLength: 8 }), { minItems: 1, maxItems: 2 }) }),
    },
  },
};
export const manifest = {
  ...baseManifest,
  state: obj({ ...(baseManifest as Manifest).state.properties, picked: ids }),
  local: obj({ q: str({ maxLength: 64 }) }),
  initialLocal: { q: "" },
  initialState: { ...baseManifest.initialState, picked: [] },
  actions: [...baseManifest.actions, "tasks.pick"],
};
export const validator = compileValidator({ catalog, capabilities, manifest });
export function selectTree(intent: Intent = { type: "action", name: "tasks.pick", args: { list: "l1" }, bind: "ids" }) {
  return withRoot({ id: "root", kind: "stack", props: { semantics: "group" }, events: { onSelect: intent } });
}
