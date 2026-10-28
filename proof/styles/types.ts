export const states = ["rest", "hover", "active", "focus", "disabled", "selected", "invalid", "open"] as const;
export type State = (typeof states)[number];
export type RecipeKey = `${string}.${string}.${string}.${State}`;

export const colourRoles = [
  "surface.base",
  "surface.raised",
  "surface.case",
  "surface.module",
  "surface.well",
  "surface.hover",
  "surface.active",
  "surface.selected",
  "surface.scrim",
  "surface.kbd",
  "surface.scrollbar",
  "text.primary",
  "text.muted",
  "text.meta",
  "text.foil",
  "text.disabled",
  "text.status",
  "text.kbd",
  "text.on-accent",
  "border.hairline",
  "border.subtle",
  "border.strong",
  "border.focus",
  "border.kbd",
  "accent.primary",
  "accent.muted",
  "accent.soft",
  "accent.fill",
  "accent.fill.hover",
  "focus.ring",
  "diagnostic.error",
  "diagnostic.warning",
  "diagnostic.success",
  "diagnostic.info",
  "diagnostic.error.soft",
  "diagnostic.warning.soft",
  "status.critical",
  "shadow.ambient",
  "shadow.highlight",
  "patch.1",
  "patch.2",
  "patch.3",
  "patch.4",
  "patch.5",
] as const;
export type ColourRole = (typeof colourRoles)[number];
export const typographyRoles = [
  "body",
  "caption",
  "fine",
  "label",
  "label.small",
  "label.strong",
  "ui",
  "overline",
  "heading.1",
  "heading.2",
  "heading.2.compact",
  "heading.3",
  "mono",
  "mono.strong",
  "meta",
] as const;
export type TypographyRole = (typeof typographyRoles)[number];
export interface Typography {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly lineHeight: number;
  readonly fontStretch?: string;
  readonly letterSpacing?: number;
  readonly textTransform?: "none" | "uppercase";
  readonly fontSizeAdjust?: number;
}
export interface Theme {
  readonly id: string;
  readonly colours: Readonly<Record<ColourRole, string>>;
  readonly typography: Readonly<Record<TypographyRole, Typography>>;
}
export interface ShadowLayer {
  readonly inset?: boolean;
  readonly x: number;
  readonly y: number;
  readonly blur: number;
  readonly spread: number;
  readonly colorRole: ColourRole;
  readonly opacity: number;
}
export type DesignValue =
  | {
      readonly type:
        | "radius"
        | "border-width"
        | "spacing"
        | "size"
        | "breakpoint"
        | "motion-duration"
        | "opacity"
        | "backdrop-blur"
        | "saturation";
      readonly value: number;
    }
  | { readonly type: "easing"; readonly value: readonly [number, number, number, number] }
  | { readonly type: "shadow"; readonly value: readonly ShadowLayer[] };

// Design-value names style props may reference. The app declares them once; every design system defines them all.
export const valueNames = {
  space: ["space.0", "space.1", "space.2", "space.3", "space.4", "space.5", "space.6", "space.7"],
  radius: ["radius.control", "radius.plate", "radius.pill"],
  size: ["size.rail", "size.glyph"],
  breakpoint: ["bp.sm", "bp.md"],
} as const;
export type RadiusName = (typeof valueNames.radius)[number];
export type SizeName = (typeof valueNames.size)[number];
export type Breakpoint = (typeof valueNames.breakpoint)[number];

// A box fill states a meaning, never a literal colour. Only these roles may be used.
export const fillableRoles = [
  "accent.primary",
  "accent.muted",
  "accent.soft",
  "accent.fill",
  "accent.fill.hover",
  "diagnostic.error",
  "diagnostic.warning",
  "diagnostic.success",
  "diagnostic.info",
  "diagnostic.error.soft",
  "diagnostic.warning.soft",
  "status.critical",
  "patch.1",
  "patch.2",
  "patch.3",
  "patch.4",
  "patch.5",
] as const satisfies readonly ColourRole[];

export interface Recipe {
  readonly backgroundColor?: ColourRole | "none";
  readonly textColor?: ColourRole;
  readonly borderColor?: ColourRole | "none";
  readonly outlineColor?: ColourRole | "none";
  readonly placeholderColor?: ColourRole | "none";
  readonly scrollbarThumbColor?: ColourRole | "none";
  readonly scrollbarTrackColor?: ColourRole | "none";
  readonly borderWidth?: number | `border.${string}`;
  readonly borderTopWidth?: number | `border.${string}`;
  readonly borderRightWidth?: number | `border.${string}`;
  readonly borderBottomWidth?: number | `border.${string}`;
  readonly borderLeftWidth?: number | `border.${string}`;
  readonly borderRadius?: number | `radius.${string}`;
  readonly padding?: number | `space.${string}` | `spacing.${string}`;
  readonly paddingX?: number | `space.${string}`;
  readonly paddingY?: number | `space.${string}`;
  readonly gap?: number | `space.${string}` | `spacing.${string}`;
  readonly typography?: TypographyRole;
  readonly opacity?: number | `opacity.${string}`;
  readonly backgroundOpacity?: number | `opacity.${string}`;
  readonly shadow?: readonly ShadowLayer[] | `shadow.${string}`;
  readonly backdropBlur?: number | `blur.${string}`;
  readonly backdropSaturate?: number;
  readonly transitionDuration?: number | `motion.${string}`;
  readonly transitionTiming?: "expo-out";
  readonly transformPreset?: "press-shift-down" | "none";
  readonly outlineWidth?: number | `border.${string}`;
  readonly outlineOffset?: number;
  readonly outlineStyle?: "solid" | "dashed" | "none";
  readonly borderStyle?: "solid" | "dashed" | "none";
}
export interface DesignSystem {
  readonly id: string;
  readonly values: Readonly<Record<string, DesignValue>>;
  readonly recipes: Readonly<Record<string, Recipe>>;
}

export const propertyTypes = {
  backgroundColor: "colour",
  textColor: "colour",
  borderColor: "colour",
  outlineColor: "colour",
  placeholderColor: "colour",
  scrollbarThumbColor: "colour",
  scrollbarTrackColor: "colour",
  borderWidth: "border-width",
  borderTopWidth: "border-width",
  borderRightWidth: "border-width",
  borderBottomWidth: "border-width",
  borderLeftWidth: "border-width",
  borderRadius: "radius",
  borderStyle: "line-style",
  padding: "spacing",
  paddingX: "spacing",
  paddingY: "spacing",
  gap: "spacing",
  typography: "typography",
  opacity: "opacity",
  backgroundOpacity: "opacity",
  shadow: "shadow",
  backdropBlur: "backdrop-blur",
  backdropSaturate: "saturation",
  transitionDuration: "motion-duration",
  transitionTiming: "easing",
  transformPreset: "transform",
  outlineWidth: "border-width",
  outlineOffset: "spacing",
  outlineStyle: "line-style",
} as const;
