import { LiveframeFailure, type LiveframeError } from "../errors.ts";
import type { Catalog } from "../formats/catalog.ts";
import { isRecord } from "../formats/capabilities.ts";
import { styleProps } from "../formats/fixed.ts";
import { compileStyles } from "../validate/style.ts";
import { colourVar, cssString, typographyVar, valueVar } from "./names.ts";

type StyleProp = (typeof styleProps)[number];
const typography = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "fontStretch",
  "fontSizeAdjust",
] as const;
const dimension = (value: unknown): string => {
  const text = String(value);
  if (text.startsWith("space.") || text.startsWith("size.")) return `var(${valueVar(text)})`;
  if (text === "fill") return "100%";
  if (text === "fit") return "fit-content";
  return text.endsWith("fr") ? `minmax(0, ${text})` : text;
};
const token = (value: unknown) => `var(${valueVar(String(value))})`;
const colour = (value: unknown) => `var(${colourVar(String(value))})`;
const identity = (value: unknown) => String(value);
const tracks = (value: unknown) => (value as string[]).map(dimension).join(" ");
type Mapping = {
  readonly properties: readonly string[];
  readonly value: (value: unknown, catalog: Catalog, property: string) => string;
};
const single = (property: string, value: Mapping["value"] = identity): Mapping => ({ properties: [property], value });

const mappings = {
  padding: single("padding", token),
  paddingX: single("paddingInline", token),
  paddingY: single("paddingBlock", token),
  paddingTop: single("paddingTop", token),
  paddingRight: single("paddingInlineEnd", token),
  paddingBottom: single("paddingBottom", token),
  paddingLeft: single("paddingInlineStart", token),
  margin: single("margin", token),
  marginX: single("marginInline", token),
  marginY: single("marginBlock", token),
  marginTop: single("marginTop", token),
  marginRight: single("marginInlineEnd", token),
  marginBottom: single("marginBottom", token),
  marginLeft: single("marginInlineStart", token),
  gap: single("gap", token),
  direction: single("flexDirection", (value) => (value === "horizontal" ? "row" : "column")),
  align: single("alignItems"),
  justify: single(
    "justifyContent",
    (value) =>
      ({ between: "space-between", around: "space-around", evenly: "space-evenly" })[value as "between"] ??
      String(value),
  ),
  wrap: single("flexWrap"),
  width: single("width", dimension),
  height: single("height", dimension),
  minWidth: single("minWidth", dimension),
  maxWidth: single("maxWidth", dimension),
  minHeight: single("minHeight", dimension),
  maxHeight: single("maxHeight", dimension),
  grow: single("flexGrow"),
  shrink: single("flexShrink"),
  basis: single("flexBasis", (value) => `${value}px`),
  columns: single("gridTemplateColumns", tracks),
  rows: single("gridTemplateRows", tracks),
  area: single("gridTemplateAreas", (value) => (value as string[]).map(cssString).join(" ")),
  surface: single("backgroundColor", colour),
  fill: single("backgroundColor", colour),
  radius: single("borderRadius", (value) => (value === "full" ? "9999px" : token(value))),
  position: single("position"),
  insetTop: single("top", token),
  insetBottom: single("bottom", token),
  textAlign: single("textAlign"),
  textStyle: {
    properties: typography,
    value: (value, _catalog, property) => `var(${typographyVar(String(value), property)})`,
  },
  tone: single("color", (value, catalog) => colour(catalog.vocabulary.tones[String(value)])),
} satisfies Record<StyleProp, Mapping>;

const checks = new WeakMap<Catalog, ReturnType<typeof compileStyles>>();
const responsiveVar = (prop: string, breakpoint: string, property: string) =>
  `--lf-r-${prop}__${breakpoint.replaceAll(".", "_")}__${property}`;

/** Names the property and the expected rule; the check leaves its pointer at the value. */
function reportedStyle(errors: readonly LiveframeError[], prop: string): readonly LiveframeError[] {
  const pointer = `/style/${prop}`;
  if (errors.length === 0)
    return [
      { kind: "invalid-prop", pointer, message: `Undeclared style prop: ${prop}`, expected: "a declared style prop" },
    ];
  return errors.map((error) => ({ ...error, pointer: pointer + error.pointer }));
}

/** Maps a validated node's style; invalid props or values throw before any output is returned. */
export function styleDeclarations(
  input: Readonly<Record<string, unknown>>,
  catalog: Catalog,
): { style: Record<string, string>; classes: readonly string[] } {
  let validators = checks.get(catalog);
  if (!validators) {
    validators = compileStyles(catalog.vocabulary);
    checks.set(catalog, validators);
  }
  const style: Record<string, string> = {};
  const classes: string[] = [];
  for (const prop in input) {
    if (!Object.hasOwn(input, prop)) continue;
    const key = prop as StyleProp;
    const check = validators.get(key);
    const value = input[prop];
    const errors: LiveframeError[] = [];
    const valid = check ? check(value, "", { errors, maxErrors: 1 }) : false;
    if (!valid) throw new LiveframeFailure(reportedStyle(errors, prop));
    const mapping: Mapping = mappings[key];
    if (prop === "fill") classes.push("lf_fill");
    if (isRecord(value)) {
      classes.push(`lf_r_${prop}`);
      for (const breakpoint of Object.keys(value)) {
        for (const property of mapping.properties)
          style[responsiveVar(prop, breakpoint, property)] = mapping.value(value[breakpoint], catalog, property);
      }
    } else {
      for (const property of mapping.properties) style[property] = mapping.value(value, catalog, property);
    }
  }
  return { style, classes };
}

/** Shared fallback chaining for every responsive prop, ordered by installed container width. */
export function responsiveRules(scope: string, breakpoints: readonly { name: string; value: string }[]): string {
  const chains = new Map<string, string>();
  return [{ name: "base", value: "" }, ...breakpoints]
    .map((breakpoint) => {
      const rules = styleProps
        .map((prop) => {
          const mapping: Mapping = mappings[prop];
          const declarations = mapping.properties.map((property) => {
            const key = `${prop}:${property}`;
            const previous = chains.get(key);
            const chain = `var(${responsiveVar(prop, breakpoint.name, property)}${previous ? `,${previous}` : ""})`;
            chains.set(key, chain);
            return `${property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}:${chain}`;
          });
          // Per-node values must not inherit an ancestor's responsive overrides.
          if (breakpoint.name === "base") {
            for (const name of ["base", ...breakpoints.map((entry) => entry.name)]) {
              for (const property of mapping.properties)
                declarations.unshift(`${responsiveVar(prop, name, property)}:initial`);
            }
          }
          return `${scope} .lf_r_${prop}{${declarations.join(";")}}`;
        })
        .join("\n");
      return breakpoint.name === "base" ? rules : `@container lf (min-width: ${breakpoint.value}){${rules}}`;
    })
    .join("\n");
}
