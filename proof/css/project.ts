import type { CSSProperties } from "react";
import { definitions } from "../catalog/definitions.ts";
import { type DesignSystem, type Recipe, type ShadowLayer, states, type Theme } from "../styles/types.ts";

const name = (value: string) => value.replaceAll(".", "-");
const variable = (group: string, key: string) => {
  if (!/^[a-zA-Z0-9_.-]+$/.test(key)) throw new Error("Invalid CSS variable name");
  return `--lf-${group}-${name(key)}`;
};
const ref = (group: string, key: string) => `var(${variable(group, key)})`;
const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const className = (kind: string, variant: string, slot: string, state: string) =>
  `lf-${kind}-${variant}-${slot}-${state}`;

export function slotClasses(kind: string, variant: string, slot: string): string {
  return states.map((state) => className(kind, variant, slot, state)).join(" ");
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
  open: ":is([data-open],[data-expanded],[aria-expanded=true])",
};

function typography(role: string, theme: Theme): string {
  if (!Object.hasOwn(theme.typography, role)) throw new Error(`Unknown typography ${role}`);
  return ["fontFamily", "fontSize", "fontWeight", "lineHeight"]
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
      if (property === "borderWidth" && recipe.borderStyle === undefined) result.push("border-style:solid");
      if (property === "transitionDuration")
        result.push("transition-property:background-color,color,border-color,opacity,transform,box-shadow");
    }
  }
  return result.join(";");
}

export function project(theme: Theme, system: DesignSystem): string {
  const vars: string[] = [];
  for (const [role, value] of Object.entries(theme.colours)) vars.push(`${variable("colour", role)}:${safe(value)}`);
  for (const [role, value] of Object.entries(theme.typography))
    for (const [key, entry] of Object.entries(value))
      vars.push(
        `${variable("type", `${role}.${key}`)}:${typeof entry === "string" ? safe(entry) : numeric(entry, key === "fontSize" ? "px" : "")}`,
      );
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
      for (const slot of definition.slots)
        for (const state of states) {
          const key = `${definition.kind}.${variant}.${slot}.${state}`;
          const recipe = system.recipes[key];
          if (!recipe) throw new Error(`Missing recipe ${key}`);
          const cls = `.${className(definition.kind, variant, slot, state)}`;
          const condition = stateSelectors[state];
          const root = `.${className(definition.kind, variant, "root", "rest")}`;
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
          rules.push(`${selector}{${declarations(recipe, theme, system)}}`);
        }
  rules.push(
    "@media (forced-colors: active){[class*=lf-]{forced-color-adjust:auto!important;box-shadow:none!important;text-shadow:none!important}} ",
  );
  return rules.join("\n");
}

const base = `
[class*=lf-]{box-sizing:border-box}
.lf-stack-default-root-rest{display:flex;flex-direction:column}
.lf-inline-default-root-rest{display:flex;flex-direction:row;align-items:center}
.lf-grid-default-root-rest{display:grid}
.lf-scroll-default-viewport-rest{overflow:auto;max-height:100%;scrollbar-color:var(--lf-colour-surface-scrollbar) auto}
.lf-button-default-root-rest,.lf-button-primary-root-rest,.lf-button-danger-root-rest,.lf-button-ghost-root-rest{display:inline-flex;align-items:center;justify-content:center}
.lf-heading-default-root-rest,.lf-dialog-default-title-rest{margin:0}
.lf-textField-default-root-rest,.lf-select-default-root-rest{display:flex;flex-direction:column}
.lf-checkbox-default-root-rest,.lf-switch-default-root-rest{display:inline-flex;align-items:center}
.lf-checkbox-default-indicator-rest{display:inline-block;width:1em;height:1em}
.lf-switch-default-track-rest{display:inline-flex;width:2em;height:1em}
.lf-switch-default-thumb-rest{width:1em;height:1em}
[data-selected] .lf-switch-default-thumb-rest{transform:translateX(100%)}
.lf-dialog-default-backdrop-rest{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.lf-dialog-default-content-rest{max-width:90vw;max-height:90vh;overflow:auto}
.lf-tabs-default-list-rest{display:flex}
.lf-tooltip-default-trigger-rest{display:inline-flex}
`;

export function styleProps(style: Readonly<Record<string, unknown>>): CSSProperties {
  const result: Record<string, string | number> = {};
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
  };
  const dimension = (value: unknown): string =>
    typeof value === "string" && value.startsWith("space.")
      ? ref("value", value)
      : value === "fill"
        ? "100%"
        : value === "fit"
          ? "fit-content"
          : String(value);
  for (const [key, value] of Object.entries(style)) {
    if (key === "textStyle") {
      for (const property of ["fontFamily", "fontSize", "fontWeight", "lineHeight"])
        result[property] = ref("type", `${value}.${property}`);
    } else if (key === "surface") result.backgroundColor = ref("colour", String(value));
    else if (key === "tone") result.color = ref("colour", tones[String(value)] ?? "text.primary");
    else if (key === "direction") result.flexDirection = value === "horizontal" ? "row" : "column";
    else if (key === "justify")
      result.justifyContent =
        ({ between: "space-between", around: "space-around", evenly: "space-evenly" } as Record<string, string>)[
          String(value)
        ] ?? String(value);
    else if (Array.isArray(value))
      result[aliases[key] ?? key] = value.map((part) => (key === "area" ? `"${part}"` : dimension(part))).join(" ");
    else result[aliases[key] ?? key] = typeof value === "number" ? value : dimension(value);
  }
  return result;
}
