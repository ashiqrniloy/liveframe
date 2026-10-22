import type { CSSProperties } from "react";
import { definitions } from "../catalog/definitions.ts";
import { type DesignSystem, type Recipe, type ShadowLayer, states, type Theme, valueNames } from "../styles/types.ts";

const name = (value: string) => value.replaceAll(".", "-");
const variable = (group: string, key: string) => {
  if (!/^[a-zA-Z0-9_.-]+$/.test(key)) throw new Error("Invalid CSS variable name");
  return `--lf-${group}-${name(key)}`;
};
const ref = (group: string, key: string) => `var(${variable(group, key)})`;
const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const className = (kind: string, variant: string, slot: string, state: string) =>
  `lf-${kind}-${variant}-${slot}-${state}`;

export function slotClasses(
  kind: string,
  variant: string,
  slot: string,
  style?: Readonly<Record<string, unknown>>,
): string {
  const classes = states.map((state) => className(kind, variant, slot, state)).join(" ");
  const responsive = slot === "root" && style ? responsiveClasses(style) : "";
  return responsive ? `${classes} ${responsive}` : classes;
}

function safe(value: string): string {
  if (/[;{}<>\\]|\/\*|url\s*\(|expression\s*\(/i.test(value)) throw new Error("Unsafe CSS value");
  return value;
}
function numeric(value: number, unit = "px"): string {
  if (!Number.isFinite(value) || Math.abs(value) > 10000) throw new Error("Invalid CSS number");
  return `${value}${unit}`;
}
function shadows(layers: readonly ShadowLayer[], theme: Theme): string {
  return (
    layers
      .map((layer) => {
        if (!Object.hasOwn(theme.colours, layer.colorRole)) throw new Error("Unknown shadow role");
        return `${layer.inset ? "inset " : ""}${[layer.x, layer.y, layer.blur, layer.spread].map((n) => numeric(n)).join(" ")} color-mix(in srgb, ${ref("colour", layer.colorRole)} ${numeric(layer.opacity * 100, "%")}, ${ref("colour", "colour.transparent")})`;
      })
      .join(", ") || "none"
  );
}

const properties: Record<string, string> = {
  backgroundColor: "background-color",
  textColor: "color",
  borderColor: "border-color",
  outlineColor: "outline-color",
  borderWidth: "border-width",
  borderTopWidth: "border-top-width",
  borderRightWidth: "border-right-width",
  borderBottomWidth: "border-bottom-width",
  borderLeftWidth: "border-left-width",
  borderRadius: "border-radius",
  padding: "padding",
  paddingX: "padding-inline",
  paddingY: "padding-block",
  gap: "gap",
  opacity: "opacity",
  shadow: "box-shadow",
  transitionDuration: "transition-duration",
  transitionTiming: "transition-timing-function",
  transformPreset: "transform",
  outlineWidth: "outline-width",
  outlineOffset: "outline-offset",
  outlineStyle: "outline-style",
  borderStyle: "border-style",
};
const domains: Record<string, string> = {
  borderWidth: "border-width",
  borderTopWidth: "border-width",
  borderRightWidth: "border-width",
  borderBottomWidth: "border-width",
  borderLeftWidth: "border-width",
  borderRadius: "radius",
  padding: "spacing",
  paddingX: "spacing",
  paddingY: "spacing",
  gap: "spacing",
  opacity: "opacity",
  backgroundOpacity: "opacity",
  shadow: "shadow",
  backdropBlur: "backdrop-blur",
  transitionDuration: "motion-duration",
  transitionTiming: "easing",
  outlineWidth: "border-width",
};
const stateSelectors: Record<string, string> = {
  hover: ":is(:hover,[data-hovered])",
  active: ":is(:active,[data-pressed])",
  focus: ":is(:focus-visible,[data-focused],[data-focus-visible],[data-focus-within])",
  disabled: ":is(:disabled,[data-disabled])",
  selected: ":is([data-selected],[aria-selected=true],[aria-checked=true])",
  invalid: ":is(:user-invalid,[data-invalid],[aria-invalid=true])",
  open: ":is([open],[data-open],[data-expanded],[aria-expanded=true])",
};

function typography(role: string, theme: Theme): string {
  if (!Object.hasOwn(theme.typography, role)) throw new Error(`Unknown typography ${role}`);
  return Object.keys(theme.typography[role as keyof Theme["typography"]])
    .map((key) => `${kebab(key)}:${ref("type", `${role}.${key}`)}`)
    .join(";");
}

function declarations(recipe: Recipe, theme: Theme, system: DesignSystem): string {
  const result: string[] = [];
  for (const [property, value] of Object.entries(recipe)) {
    let resolved: string;
    if (property.endsWith("Color")) {
      if (!Object.hasOwn(theme.colours, String(value))) throw new Error(`Unknown colour ${value}`);
      resolved = ref("colour", String(value));
    } else if (property === "typography") {
      result.push(typography(String(value), theme));
      continue;
    } else if (property === "transformPreset") {
      if (value !== "press-shift-down" && value !== "none") throw new Error("Invalid transform");
      resolved = value === "none" ? "none" : "translateY(1px)";
    } else if (property === "borderStyle" || property === "outlineStyle") {
      if (!["solid", "dashed", "none"].includes(String(value))) throw new Error("Invalid line style");
      resolved = String(value);
    } else if (typeof value === "string") {
      if (system.values[value]?.type !== domains[property]) throw new Error(`Unresolved ${property}: ${value}`);
      resolved = ref("value", value);
    } else if (property === "shadow") resolved = shadows(value as readonly ShadowLayer[], theme);
    else
      resolved = numeric(
        Number(value),
        ["opacity", "backgroundOpacity", "backdropSaturate"].includes(property)
          ? ""
          : property === "transitionDuration"
            ? "ms"
            : "px",
      );
    if (property === "backgroundOpacity") {
      const background = recipe.backgroundColor;
      if (!background) throw new Error("Background opacity requires background role");
      result.push(
        `background-color:color-mix(in srgb, ${ref("colour", background)} calc(${resolved} * 100%), ${ref("colour", "colour.transparent")})`,
      );
    } else if (property === "backdropBlur" || property === "backdropSaturate") {
      result.push(`${property === "backdropBlur" ? "--lf-blur" : "--lf-saturate"}:${resolved}`);
      result.push("backdrop-filter:blur(var(--lf-blur,0px)) saturate(var(--lf-saturate,1))");
    } else {
      const cssProperty = properties[property];
      if (!cssProperty) throw new Error(`Unknown recipe property ${property}`);
      result.push(`${cssProperty}:${resolved}`);
      // A width on one side must style only that side; a shorthand style would give the rest `medium`.
      const side = /^border(Top|Right|Bottom|Left)Width$/.exec(property)?.[1];
      if (recipe.borderStyle === undefined) {
        if (side) result.push(`border-${side.toLowerCase()}-style:solid`);
        else if (property === "borderWidth") result.push("border-style:solid");
      }
      if (property === "transitionDuration")
        result.push("transition-property:background-color,color,border-color,opacity,transform,box-shadow");
    }
  }
  return result.join(";");
}

export function project(theme: Theme, system: DesignSystem): string {
  const vars: string[] = [];
  for (const [role, value] of Object.entries(theme.colours)) vars.push(`${variable("colour", role)}:${safe(value)}`);
  for (const [role, value] of Object.entries(theme.typography)) {
    if (
      value.letterSpacing !== undefined &&
      (!Number.isFinite(value.letterSpacing) || value.letterSpacing < -0.1 || value.letterSpacing > 0.3)
    )
      throw new Error(`Invalid letterSpacing for ${role}`);
    if (value.textTransform !== undefined && !["none", "uppercase"].includes(value.textTransform))
      throw new Error(`Invalid textTransform for ${role}`);
    if (
      value.fontSizeAdjust !== undefined &&
      (!Number.isFinite(value.fontSizeAdjust) || value.fontSizeAdjust < 0.3 || value.fontSizeAdjust > 1.2)
    )
      throw new Error(`Invalid fontSizeAdjust for ${role}`);
    for (const [key, entry] of Object.entries({
      fontStretch: "100%",
      letterSpacing: 0,
      textTransform: "none",
      fontSizeAdjust: 0,
      ...value,
    }))
      vars.push(
        `${variable("type", `${role}.${key}`)}:${
          key === "fontSizeAdjust"
            ? entry === 0
              ? "none"
              : `ex-height ${numeric(Number(entry), "")}`
            : typeof entry === "string"
              ? safe(entry)
              : numeric(entry, key === "fontSize" ? "px" : key === "letterSpacing" ? "em" : "")
        }`,
      );
  }
  for (const [key, token] of Object.entries(system.values)) {
    let value: string;
    if (token.type === "shadow") value = shadows(token.value, theme);
    else if (token.type === "easing") value = `cubic-bezier(${token.value.map((n) => numeric(n, "")).join(",")})`;
    else
      value = numeric(
        token.value,
        token.type === "motion-duration" ? "ms" : ["opacity", "saturation"].includes(token.type) ? "" : "px",
      );
    vars.push(`${variable("value", key)}:${value}`);
  }
  const rules = [`:root{${vars.join(";")}}`, base];
  for (const definition of definitions)
    for (const variant of definition.variants)
      for (const slot of definition.slots) {
        // A state whose recipe resolves to the rest declarations needs no rule of its own.
        let rest = "";
        for (const state of states) {
          const key = `${definition.kind}.${variant}.${slot}.${state}`;
          const recipe = system.recipes[key];
          if (!recipe) throw new Error(`Missing recipe ${key}`);
          const cls = `.${className(definition.kind, variant, slot, state)}`;
          const condition = stateSelectors[state];
          const root = `.${className(definition.kind, variant, "root", "rest")}`;
          const body = declarations(recipe, theme, system);
          if (state === "rest") rest = body;
          else if (body === rest) continue;
          let selector =
            state === "rest"
              ? cls
              : slot === "root"
                ? `${cls}${condition}`
                : `${cls}${condition},${root}${condition} ${cls}`;
          if (definition.kind === "scroll" && slot === "scrollbar") {
            const viewport = `.${className("scroll", variant, "viewport", "rest")}`;
            selector += `,${viewport}${state === "rest" ? "" : condition}::-webkit-scrollbar-thumb`;
          }
          rules.push(`${selector}{${body}}`);
        }
      }
  const responsive = [...new Set(definitions.flatMap((definition) => definition.styleProps))].sort();
  // Each breakpoint rule falls back through the narrower breakpoints, so a value set at one
  // breakpoint still applies above every wider one.
  const responsiveRule = (index?: number) =>
    responsive
      .map(
        (key) =>
          `.lf-r-${key}{${cssProperties(key)
            .map((property) => {
              let value = `var(--lf-r-${key}-base-${property})`;
              for (const breakpoint of valueNames.breakpoint.slice(0, (index ?? -1) + 1))
                value = `var(--lf-r-${key}-${name(breakpoint)}-${property},${value})`;
              return `${kebab(property)}:${value}`;
            })
            .join(";")}}`,
      )
      .join("");
  rules.push(responsiveRule());
  for (const name of [...valueNames.radius, ...valueNames.size, ...valueNames.breakpoint])
    if (!Object.hasOwn(system.values, name)) throw new Error(`Missing declared value ${name}`);
  for (const [index, breakpoint] of valueNames.breakpoint.entries()) {
    const token = system.values[breakpoint];
    if (token?.type !== "breakpoint") throw new Error(`Missing breakpoint ${breakpoint}`);
    rules.push(`@container (min-width:${numeric(token.value)}){${responsiveRule(index)}}`);
  }
  rules.push(
    "@media (forced-colors: active){[class*=lf-]{forced-color-adjust:auto!important;box-shadow:none!important;text-shadow:none!important}} ",
  );
  return rules.join("\n");
}

const base = `
[class*=lf-]{box-sizing:border-box;margin:0;border:0}
.lf-container{container-type:inline-size}
.lf-surface{font-family:var(--lf-type-body-fontFamily);font-size:var(--lf-type-body-fontSize);font-weight:var(--lf-type-body-fontWeight);line-height:var(--lf-type-body-lineHeight);font-stretch:var(--lf-type-body-fontStretch);letter-spacing:var(--lf-type-body-letterSpacing);text-transform:var(--lf-type-body-textTransform);font-size-adjust:var(--lf-type-body-fontSizeAdjust)}
.lf-stack-default-root-rest{display:flex;flex-direction:column}
.lf-inline-default-root-rest{display:flex;flex-direction:row;align-items:center}
.lf-grid-default-root-rest{display:grid}
.lf-scroll-default-viewport-rest{overflow:auto;max-height:100%;scrollbar-color:var(--lf-colour-surface-scrollbar) auto}
.lf-button-default-root-rest{display:inline-flex;align-items:center;justify-content:center;min-height:1.9rem}
.lf-button-primary-root-rest,.lf-button-danger-root-rest{display:inline-flex;align-items:center;justify-content:center;min-height:2.25rem}
.lf-button-ghost-root-rest{display:inline-block;text-align:left}
.lf-heading-default-root-rest,.lf-dialog-default-title-rest{margin:0;text-wrap:balance}
.lf-textField-default-root-rest,.lf-select-default-root-rest{display:flex;flex-direction:column}
.lf-checkbox-default-root-rest,.lf-switch-default-root-rest{display:inline-flex;align-items:center}
.lf-checkbox-default-indicator-rest{display:inline-block;width:1em;height:1em}
.lf-switch-default-track-rest{display:inline-flex;width:2em;height:1em}
.lf-switch-default-thumb-rest{width:1em;height:1em}
[data-selected] .lf-switch-default-thumb-rest{transform:translateX(100%)}
.lf-dialog-default-backdrop-rest{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.lf-dialog-default-content-rest{max-width:90vw;max-height:90vh;overflow:auto}
.lf-icon-default-root-rest{display:inline-flex;flex:none;width:1rem;height:1rem}
.lf-tabs-default-list-rest{display:flex;flex-wrap:wrap;align-items:center}
.lf-tab-default-root-rest{display:inline-flex;align-items:center;min-height:2.25rem}
.lf-tooltip-default-trigger-rest{display:inline-flex}
.lf-box-plate-root-rest{display:grid;align-content:start;min-width:0}
.lf-box-callout-root-rest{display:grid;grid-template-columns:1px minmax(0,1fr)}
.lf-box-default-rail-rest,.lf-box-plate-rail-rest,.lf-box-rule-rail-rest,.lf-box-callout-rail-rest{display:block;width:1px}
.lf-disclosure-default-summary-rest{width:fit-content;min-height:2rem;cursor:pointer}
[open] > .lf-disclosure-default-summary-rest{margin-bottom:var(--lf-value-space-1)}
`;

const aliases: Record<string, string> = {
  paddingX: "paddingInline",
  paddingY: "paddingBlock",
  marginX: "marginInline",
  marginY: "marginBlock",
  direction: "flexDirection",
  align: "alignItems",
  justify: "justifyContent",
  wrap: "flexWrap",
  grow: "flexGrow",
  shrink: "flexShrink",
  basis: "flexBasis",
  columns: "gridTemplateColumns",
  rows: "gridTemplateRows",
  area: "gridTemplateAreas",
  surface: "backgroundColor",
  fill: "backgroundColor",
  tone: "color",
  radius: "borderRadius",
  textAlign: "textAlign",
  position: "position",
  insetTop: "top",
  insetBottom: "bottom",
};
const tones: Record<string, string> = {
  default: "text.primary",
  muted: "text.muted",
  meta: "text.meta",
  accent: "accent.primary",
  success: "diagnostic.success",
  warning: "diagnostic.warning",
  danger: "diagnostic.error",
  info: "diagnostic.info",
  foil: "text.foil",
};
const typographyProperties = [
  "fontSizeAdjust",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "fontStretch",
  "letterSpacing",
  "textTransform",
] as const;
// The CSS properties one style prop writes. Responsive rules read the same names from per-node custom properties.
const cssProperties = (key: string): readonly string[] =>
  key === "textStyle" ? typographyProperties : [aliases[key] ?? key];
const dimension = (value: unknown): string => {
  if (typeof value === "string" && (value.startsWith("space.") || value.startsWith("size.")))
    return ref("value", value);
  if (value === "fill") return "100%";
  if (value === "fit") return "fit-content";
  if (typeof value === "string" && /^\d+(?:\.\d+)?fr$/.test(value)) return `minmax(0, ${value})`;
  return String(value);
};

function assign(result: Record<string, string | number>, key: string, value: unknown): void {
  if (key === "textStyle") {
    for (const property of typographyProperties) result[property] = ref("type", `${value}.${property}`);
  } else if (key === "tone") result.color = ref("colour", tones[String(value)] ?? "text.primary");
  else if (key === "surface" || key === "fill") result.backgroundColor = ref("colour", String(value));
  else if (key === "radius") result.borderRadius = value === "full" ? "9999px" : ref("value", String(value));
  else if (key === "direction") result.flexDirection = value === "horizontal" ? "row" : "column";
  else if (key === "justify")
    result.justifyContent =
      ({ between: "space-between", around: "space-around", evenly: "space-evenly" } as Record<string, string>)[
        String(value)
      ] ?? String(value);
  else if (Array.isArray(value))
    result[aliases[key] ?? key] = value
      .map((part) => {
        if (key === "area") return `"${part}"`;
        // `fit` sizes a box; a grid track takes `auto` (fit-content is only valid with a length).
        return part === "fit" ? "auto" : dimension(part);
      })
      .join(" ");
  else result[aliases[key] ?? key] = typeof value === "number" ? value : dimension(value);
}

const isResponsive = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** True when any node in the tree carries a responsive style value, so its surface needs a query container. */
/** True when this node's own style has a responsive value. */
export function hasResponsiveValues(node: { readonly style?: Readonly<Record<string, unknown>> }): boolean {
  return Object.values(node.style ?? {}).some(isResponsive);
}

export function hasResponsiveStyles(node: {
  readonly style?: Readonly<Record<string, unknown>>;
  readonly children?: readonly unknown[];
}): boolean {
  if (Object.values(node.style ?? {}).some(isResponsive)) return true;
  return (node.children ?? []).some((child) => hasResponsiveStyles(child as Parameters<typeof hasResponsiveStyles>[0]));
}

/** The classes a node needs so its container-query rules can read its responsive values. */
export function responsiveClasses(style: Readonly<Record<string, unknown>>): string {
  return Object.entries(style)
    .filter(([, value]) => isResponsive(value))
    .map(([key]) => `lf-r-${key}`)
    .join(" ");
}

export function styleProps(style: Readonly<Record<string, unknown>>): CSSProperties {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style)) {
    if (!isResponsive(value)) {
      assign(result, key, value);
      continue;
    }
    for (const [breakpoint, entry] of Object.entries(value)) {
      const scalar: Record<string, string | number> = {};
      assign(scalar, key, entry);
      for (const [property, resolved] of Object.entries(scalar))
        result[`--lf-r-${key}-${name(breakpoint)}-${property}`] = resolved;
    }
  }
  return result;
}
