import { type Theme, validateTheme } from "@arnilo/liveframe";
import { catalog, valid } from "./catalog.ts";

// A colour is oklch lightness, chroma, hue and an optional alpha. Colours live only in these three tables:
// a design system and a widget name roles, never values (law 3).
type Colour = readonly [lightness: number, chroma: number, hue: number, alpha?: number];
type Roles = Readonly<Record<string, Colour>>;

const px = (value: number) => ({ value, unit: "px" as const });
const sans = ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"];
const mono = ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"];
const text = (fontFamily: string[], size: number, fontWeight: number, lineHeight: number) => ({
  fontFamily,
  fontSize: px(size),
  fontWeight,
  lineHeight,
});
// The type scale does not change between themes: contrast, not size, is what a high-contrast theme changes.
const typography = {
  body: text(sans, 14, 400, 1.5),
  caption: text(sans, 12, 400, 1.5),
  label: text(sans, 13, 500, 1.25),
  "label.strong": text(sans, 13, 600, 1.25),
  "heading.1": text(sans, 28, 700, 1.15),
  "heading.2": text(sans, 20, 650, 1.25),
  "heading.3": text(sans, 16, 600, 1.3),
  mono: text(mono, 12.5, 400, 1.5),
};

const light: Roles = {
  "surface.base": [0.985, 0.003, 250],
  "surface.raised": [1, 0, 0],
  "surface.well": [0.955, 0.006, 250],
  "surface.hover": [0.25, 0.03, 250, 0.07],
  "surface.active": [0.25, 0.03, 250, 0.13],
  "surface.selected": [0.5, 0.15, 255, 0.16],
  "surface.scrim": [0.2, 0.02, 250],
  "surface.scrollbar": [0.3, 0.02, 250, 0.4],
  "text.primary": [0.22, 0.02, 250],
  "text.muted": [0.44, 0.02, 250],
  "text.disabled": [0.5, 0.015, 250],
  "text.on-accent": [0.99, 0, 0],
  "border.subtle": [0.25, 0.03, 250, 0.2],
  "border.strong": [0.52, 0.02, 250],
  "focus.ring": [0.5, 0.17, 255],
  "accent.fill": [0.53, 0.17, 255],
  "accent.fill.hover": [0.46, 0.17, 255],
  "accent.text": [0.45, 0.17, 255],
  "accent.edge": [0.5, 0.1, 255],
  "accent.soft": [0.55, 0.14, 255, 0.14],
  "status.critical.fill": [0.56, 0.19, 25],
  "status.critical.fill.hover": [0.49, 0.19, 25],
  "status.critical.text": [0.48, 0.19, 25],
  "status.critical.edge": [0.52, 0.15, 25],
  "diagnostic.error": [0.5, 0.19, 25],
  "diagnostic.warning": [0.5, 0.12, 70],
  "diagnostic.success": [0.5, 0.12, 150],
  "diagnostic.info": [0.5, 0.12, 240],
  "shadow.ambient": [0.25, 0.03, 250],
  "shadow.highlight": [1, 0, 0, 0.5],
};
const dark: Roles = {
  "surface.base": [0.18, 0.01, 250],
  "surface.raised": [0.22, 0.012, 250],
  "surface.well": [0.15, 0.01, 250],
  "surface.hover": [1, 0, 0, 0.07],
  "surface.active": [1, 0, 0, 0.13],
  "surface.selected": [0.7, 0.12, 255, 0.22],
  "surface.scrim": [0.05, 0.01, 250],
  "surface.scrollbar": [1, 0, 0, 0.3],
  "text.primary": [0.95, 0.005, 250],
  "text.muted": [0.76, 0.01, 250],
  "text.disabled": [0.68, 0.01, 250],
  "text.on-accent": [0.14, 0.02, 250],
  "border.subtle": [1, 0, 0, 0.16],
  "border.strong": [0.66, 0.02, 250],
  "focus.ring": [0.78, 0.13, 255],
  "accent.fill": [0.6, 0.14, 255],
  "accent.fill.hover": [0.66, 0.13, 255],
  "accent.text": [0.8, 0.11, 255],
  "accent.edge": [0.7, 0.1, 255],
  "accent.soft": [0.7, 0.12, 255, 0.18],
  "status.critical.fill": [0.6, 0.17, 25],
  "status.critical.fill.hover": [0.66, 0.15, 25],
  "status.critical.text": [0.78, 0.13, 25],
  "status.critical.edge": [0.7, 0.14, 25],
  "diagnostic.error": [0.74, 0.14, 25],
  "diagnostic.warning": [0.8, 0.12, 80],
  "diagnostic.success": [0.76, 0.13, 150],
  "diagnostic.info": [0.76, 0.1, 235],
  "shadow.ambient": [0, 0, 0],
  "shadow.highlight": [1, 0, 0, 0.12],
};
// Black on white, solid edges, no translucent ink: every pair clears 7:1 and every border 4.5:1.
const highContrast: Roles = {
  "surface.base": [1, 0, 0],
  "surface.raised": [1, 0, 0],
  "surface.well": [0.95, 0, 0],
  "surface.hover": [0.9, 0, 0],
  "surface.active": [0.82, 0, 0],
  "surface.selected": [0.85, 0.06, 255],
  "surface.scrim": [0, 0, 0],
  "surface.scrollbar": [0.3, 0, 0],
  "text.primary": [0, 0, 0],
  "text.muted": [0.3, 0, 0],
  "text.disabled": [0.4, 0, 0],
  "text.on-accent": [1, 0, 0],
  "border.subtle": [0.55, 0, 0],
  "border.strong": [0.2, 0, 0],
  "focus.ring": [0.35, 0.2, 260],
  "accent.fill": [0.5, 0.16, 260],
  "accent.fill.hover": [0.4, 0.14, 260],
  "accent.text": [0.32, 0.15, 260],
  "accent.edge": [0.32, 0.15, 260],
  "accent.soft": [0.9, 0.05, 260],
  "status.critical.fill": [0.5, 0.18, 25],
  "status.critical.fill.hover": [0.4, 0.16, 25],
  "status.critical.text": [0.38, 0.17, 25],
  "status.critical.edge": [0.38, 0.17, 25],
  "diagnostic.error": [0.38, 0.17, 25],
  "diagnostic.warning": [0.4, 0.1, 70],
  "diagnostic.success": [0.36, 0.1, 150],
  "diagnostic.info": [0.36, 0.1, 240],
  "shadow.ambient": [0, 0, 0],
  "shadow.highlight": [1, 0, 0, 0],
};

function theme(id: string, colorScheme: "light" | "dark", roles: Roles) {
  return {
    format: "liveframe-theme/1",
    id,
    version: "1.0.0",
    colorScheme,
    colours: Object.fromEntries(
      Object.entries(roles).map(([role, [l, c, h, alpha]]) => [
        role,
        { colorSpace: "oklch", components: [l, c, h], ...(alpha === undefined ? {} : { alpha }) },
      ]),
    ),
    typography,
  };
}

/** The light, dark and high-contrast themes, validated against the starter vocabulary. */
export const themes: [Theme, ...Theme[]] = [
  valid("light theme", validateTheme(theme("starter-light", "light", light), catalog.vocabulary)),
  valid("dark theme", validateTheme(theme("starter-dark", "dark", dark), catalog.vocabulary)),
  valid(
    "high-contrast theme",
    validateTheme(theme("starter-high-contrast", "light", highContrast), catalog.vocabulary),
  ),
];
