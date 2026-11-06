import type { Catalog, DesignSystem } from "../../index.ts";

/**
 * The proof catalog with its button given two axes: 4 variants × 3 tones × 2 emphases = 24
 * combinations (the plan 027 Task 5 cost fixture). `axesSystem` adds one overlay per non-default
 * axis value, tones by role alias, so the table and the sheet grow the way a real adoption would.
 */
export function axesCatalog(plain: Catalog): Catalog {
  return {
    ...plain,
    definitions: plain.definitions.map((definition) =>
      definition.kind === "button"
        ? {
            ...definition,
            props: {
              ...definition.props,
              properties: {
                ...definition.props.properties,
                tone: { type: "string", maxLength: 12, enum: ["neutral", "critical", "positive"] },
                emphasis: { type: "string", maxLength: 12, enum: ["solid", "outline"] },
              },
            },
            axes: { tone: { default: "neutral" }, emphasis: { default: "solid" } },
          }
        : definition,
    ),
  };
}

export function axesSystem(system: DesignSystem): DesignSystem {
  return {
    ...system,
    recipes: {
      ...system.recipes,
      // `accent.fill` also covers `accent.fill.hover`, so the longer source names its own target.
      "button.tone:critical.root.rest": {
        roles: { "accent.fill": "status.critical", "accent.fill.hover": "status.critical" },
      },
      "button.tone:positive.root.rest": {
        roles: { "accent.fill": "diagnostic.success", "accent.fill.hover": "diagnostic.success" },
      },
      "button.emphasis:outline.root.rest": { backgroundColor: "none" },
    } as DesignSystem["recipes"],
  };
}
