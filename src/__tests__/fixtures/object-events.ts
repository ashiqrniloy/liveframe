import { bool, type Capabilities, compileValidator, type Intent, type Manifest, obj, str } from "../../index.ts";
import baseManifest from "./proof/agent-home.manifest.json" with { type: "json" };
import baseCapabilities from "./proof/capabilities.json" with { type: "json" };
import { catalog as baseCatalog, withRoot } from "./react-surface.tsx";

export const fields = obj({ reason: str({ maxLength: 500 }), confirm: bool() });
export const catalog = {
  ...baseCatalog,
  definitions: baseCatalog.definitions.map((definition) =>
    definition.kind === "stack"
      ? ({
          ...definition,
          events: { onSubmit: { carries: { object: fields }, description: "Submit current fields." } },
        } as const)
      : definition,
  ),
};
export const capabilities: Capabilities = {
  ...(baseCapabilities as Capabilities),
  actions: {
    ...(baseCapabilities as Capabilities).actions,
    "form.submit": {
      description: "Submit fields.",
      args: obj({ id: str({ maxLength: 80 }), reason: str({ minLength: 1, maxLength: 100 }), confirm: bool() }),
    },
  },
};
export const manifest = {
  ...baseManifest,
  state: obj({ ...(baseManifest as Manifest).state.properties, form: fields }),
  initialState: { ...baseManifest.initialState, form: { reason: "", confirm: false } },
  actions: [...baseManifest.actions, "form.submit"],
};
export const validator = compileValidator({ catalog, capabilities, manifest });
export function formTree(intent: Intent = { type: "action", name: "form.submit", args: { id: "row" }, bindAll: true }) {
  return withRoot({ id: "root", kind: "stack", props: { semantics: "form" }, events: { onSubmit: intent } });
}
