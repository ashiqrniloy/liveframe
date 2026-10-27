import { type Capabilities, compileValidator, int, type Manifest, num, obj, type UiNode } from "../../index.ts";
import baseManifest from "./proof/agent-home.manifest.json" with { type: "json" };
import baseCapabilities from "./proof/capabilities.json" with { type: "json" };
import { catalog as baseCatalog, withRoot } from "./react-surface.tsx";

export const catalog = {
  ...baseCatalog,
  definitions: baseCatalog.definitions.map((definition) =>
    definition.kind === "textField"
      ? ({
          ...definition,
          events: {
            ...definition.events,
            onNumber: { carries: "number", description: "Commit a number." },
            onInteger: { carries: "integer", description: "Commit an integer." },
          },
        } as const)
      : definition,
  ),
};
export const capabilities: Capabilities = {
  ...(baseCapabilities as Capabilities),
  actions: {
    ...(baseCapabilities as Capabilities).actions,
    "numbers.commit": { description: "Commit a number.", args: obj({ value: num({ minimum: 1, maximum: 10 }) }) },
    "integers.commit": { description: "Commit an integer.", args: obj({ value: int({ minimum: 1, maximum: 10 }) }) },
  },
};
export const manifest = {
  ...baseManifest,
  state: obj({ ...(baseManifest as Manifest).state.properties, number: num(), integer: int() }),
  initialState: { ...baseManifest.initialState, number: 0, integer: 0 },
  actions: [...baseManifest.actions, "numbers.commit", "integers.commit"],
};
export const validator = compileValidator({ catalog, capabilities, manifest });
export function numericTree(event: string, intent: NonNullable<UiNode["events"]>[string]) {
  return withRoot({ id: "root", kind: "textField", props: { label: "Number" }, events: { [event]: intent } });
}
