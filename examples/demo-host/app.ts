import {
  type DesignSystem,
  type Result,
  type Theme,
  validateCapabilities,
  validateCatalog,
  validateDesignSystem,
  validateTheme,
} from "@arnilo/liveframe";
import capabilitiesDocument from "./capabilities.json" with { type: "json" };
import catalogDocument from "./catalog.json" with { type: "json" };
import designSystemDocument from "./design-system.json" with { type: "json" };
import themeDocument from "./theme.json" with { type: "json" };

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

// The app's installed documents, validated once. Widgets are checked against these.
export const catalog = valid(validateCatalog(catalogDocument));
export const capabilities = valid(validateCapabilities(capabilitiesDocument));
export const theme = valid(validateTheme(themeDocument, catalog.vocabulary));
export const designSystem = valid(validateDesignSystem(designSystemDocument, { catalog, registry: {} }));

// A second theme and design system, derived from the first, so a page can show and switch between two of each.
const warm = {
  ...themeDocument,
  id: "demo-warm",
  colours: Object.fromEntries(
    Object.entries(themeDocument.colours).map(([role, colour]) => {
      if (colour.colorSpace !== "oklch") return [role, colour];
      const [lightness = 0, chroma = 0, hue = 0] = colour.components;
      return [role, { ...colour, components: [lightness, chroma, (hue + 60) % 360] }];
    }),
  ),
};
const round = {
  ...designSystemDocument,
  id: "demo-round",
  values: {
    ...designSystemDocument.values,
    "radius.control": { kind: "radius", value: { value: 10, unit: "px" } },
  },
};
export const themes: [Theme, ...Theme[]] = [theme, valid(validateTheme(warm, catalog.vocabulary))];
export const designSystems: [DesignSystem, ...DesignSystem[]] = [
  designSystem,
  valid(validateDesignSystem(round, { catalog, registry: {} })),
];
