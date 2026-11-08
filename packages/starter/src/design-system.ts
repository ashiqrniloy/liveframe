import { type DesignSystem, validateDesignSystem } from "@arnilo/liveframe";
import { catalog, valid } from "./catalog.ts";

// The look of every primitive. Colours are theme roles, sizes are design values: nothing here is a literal colour (law 3).
// Structure (display, flex, tracks, minimum heights) is the primitive CSS's; widgets set layout through style props.
type Recipe = Readonly<Record<string, unknown>>;
const px = (value: number) => ({ value, unit: "px" as const });
const shadowLayer = (role: string, alpha: number, y: number, blur: number, spread: number, inset = false) => ({
  color: { role, alpha },
  offsetX: px(0),
  offsetY: px(y),
  blur: px(blur),
  spread: px(spread),
  ...(inset ? { inset } : {}),
});

const values = {
  "radius.control": { kind: "radius", value: px(6) },
  "radius.plate": { kind: "radius", value: px(8) },
  "radius.pill": { kind: "radius", value: px(999) },
  "border.hairline": { kind: "border-width", value: px(1) },
  "border.focus": { kind: "border-width", value: px(2) },
  "space.0": { kind: "spacing", value: px(0) },
  "space.1": { kind: "spacing", value: px(4) },
  "space.2": { kind: "spacing", value: px(8) },
  "space.3": { kind: "spacing", value: px(12) },
  "space.4": { kind: "spacing", value: px(16) },
  "space.5": { kind: "spacing", value: px(24) },
  "space.6": { kind: "spacing", value: px(32) },
  "space.7": { kind: "spacing", value: px(48) },
  "size.glyph": { kind: "size", value: px(16) },
  "size.panel": { kind: "size", value: px(360) },
  "bp.sm": { kind: "breakpoint", value: px(384) },
  "bp.md": { kind: "breakpoint", value: px(720) },
  "motion.fast": { kind: "motion-duration", value: { value: 120, unit: "ms" } },
  "ease-out": { kind: "easing", value: [0.2, 0, 0, 1] },
  "opacity.dim": { kind: "opacity", value: 0.5 },
  "shadow.pop": {
    kind: "shadow",
    value: [shadowLayer("shadow.ambient", 0.14, 2, 6, 0), shadowLayer("shadow.ambient", 0.3, 16, 32, -12)],
  },
};

const motion = { transitionDuration: "motion.fast", transitionTiming: "ease-out" };
const focus: Recipe = {
  outlineColor: "focus.ring",
  outlineWidth: "border.focus",
  outlineOffset: px(2),
  outlineStyle: "solid",
};
const control: Recipe = {
  backgroundColor: "surface.raised",
  textColor: "accent.text",
  borderColor: "accent.edge",
  borderWidth: "border.hairline",
  borderRadius: "radius.control",
  paddingX: "space.4",
  paddingY: "space.0",
  gap: "space.2",
  typography: "label",
  ...motion,
};
const field: Recipe = {
  backgroundColor: "surface.raised",
  textColor: "text.primary",
  placeholderColor: "text.muted",
  borderColor: "border.strong",
  borderWidth: "border.hairline",
  borderRadius: "radius.control",
  paddingX: "space.3",
  paddingY: "space.2",
  typography: "body",
  ...motion,
};
const floating: Recipe = {
  backgroundColor: "surface.raised",
  textColor: "text.primary",
  borderColor: "border.strong",
  borderWidth: "border.hairline",
  borderRadius: "radius.plate",
  padding: "space.1",
  typography: "body",
  shadow: "shadow.pop",
};
const item: Recipe = {
  backgroundColor: "none",
  textColor: "text.primary",
  borderWidth: px(0),
  borderRadius: "radius.control",
  paddingX: "space.3",
  paddingY: "space.2",
  gap: "space.2",
  typography: "label",
};
const mark: Recipe = {
  backgroundColor: "surface.raised",
  borderColor: "border.strong",
  borderWidth: "border.hairline",
  borderRadius: "radius.control",
};
const selectedMark: Recipe = {
  backgroundColor: "accent.fill",
  textColor: "text.on-accent",
  borderColor: "accent.fill",
};
const disabledField: Recipe = {
  textColor: "text.disabled",
  backgroundColor: "surface.well",
  borderColor: "border.subtle",
};
const disabledControl: Recipe = { ...disabledField, backgroundColor: "surface.well" };

const recipes: Record<string, Recipe> = {};
function set(prefix: string, states: Readonly<Record<string, Recipe>>) {
  for (const [state, recipe] of Object.entries(states)) recipes[`${prefix}.${state}`] = recipe;
}
const empty: Recipe = {};

set("box.*.root", { rest: empty });
set("box.*.rail", { rest: empty });
set("box.plate.root", {
  rest: {
    backgroundColor: "surface.raised",
    borderColor: "border.subtle",
    borderWidth: "border.hairline",
    borderRadius: "radius.plate",
    padding: "space.4",
    gap: "space.3",
  },
});
set("box.rule.root", {
  rest: { borderColor: "border.subtle", borderTopWidth: "border.hairline", paddingY: "space.3", gap: "space.1" },
});
set("box.callout.root", { rest: { gap: "space.3", paddingY: "space.1" } });
set("box.callout.rail", { rest: { backgroundColor: "accent.edge", borderRadius: "radius.pill" } });
for (const kind of ["stack", "inline", "grid", "icon", "image"]) set(`${kind}.*.root`, { rest: empty });
set("scroll.*.root", { rest: empty });
set("scroll.*.scrollbar", { rest: empty });
set("scroll.*.viewport", { rest: { scrollbarThumbColor: "surface.scrollbar", scrollbarTrackColor: "none" } });
set("separator.*.root", { rest: { borderColor: "border.subtle", borderTopWidth: "border.hairline" } });
set("text.*.root", { rest: { textColor: "text.primary", typography: "body" } });
set("hint.*.root", { rest: { textColor: "text.muted", typography: "caption" } });
set("heading.*.root", { rest: { textColor: "text.primary", typography: "heading.2" } });
set("link.*.root", {
  rest: { textColor: "accent.text", typography: "body" },
  hover: { textColor: "accent.fill.hover" },
  focus: { ...focus, borderRadius: "radius.control" },
});
set("link.*.label", { rest: empty });

set("button.*.root", {
  rest: control,
  hover: { backgroundColor: "surface.hover" },
  active: { translateY: px(1) },
  focus,
  disabled: disabledControl,
});
set("button.primary.root", {
  rest: {
    backgroundColor: "accent.fill",
    textColor: "text.on-accent",
    borderColor: "none",
    extensions: { sheen: "shadow.highlight" },
  },
  hover: { backgroundColor: "accent.fill.hover" },
  // The page's ink: the one ring colour that clears 3:1 against the page and against the fill (the audit measures both).
  focus: { ...focus, outlineColor: "text.primary" },
});
set("button.ghost.root", {
  rest: { backgroundColor: "none", borderColor: "none", paddingX: "space.2" },
});
for (const slot of ["label", "icon"]) set(`button.*.${slot}`, { rest: empty });
// A critical button reads the same accent roles through a different family (spec §6.2, role aliases).
set("button.tone:critical.root", { rest: { roles: { accent: "status.critical" } } });

set("textField.*.root", { rest: { gap: "space.1" } });
set("textField.*.label", { rest: { textColor: "text.primary", typography: "label" } });
set("textField.*.input", {
  rest: field,
  hover: { borderColor: "text.primary" },
  focus: { ...focus, outlineOffset: px(1), borderColor: "focus.ring" },
  disabled: disabledField,
});

set("select.*.root", { rest: { gap: "space.1" } });
set("select.*.label", { rest: { textColor: "text.primary", typography: "label" } });
set("select.*.trigger", {
  rest: field,
  hover: { borderColor: "text.primary" },
  focus: { ...focus, outlineOffset: px(1), borderColor: "focus.ring" },
  disabled: disabledField,
});
set("select.*.list", { rest: floating });
set("select.*.option", {
  rest: item,
  hover: { backgroundColor: "surface.hover" },
  focus,
  selected: { backgroundColor: "surface.selected" },
});

set("checkbox.*.root", {
  rest: { textColor: "text.primary", typography: "label", gap: "space.2" },
  focus,
  disabled: { textColor: "text.disabled" },
});
set("checkbox.*.label", { rest: empty });
set("checkbox.*.indicator", { rest: mark, selected: selectedMark, focus });
set("switch.*.root", {
  rest: { textColor: "text.primary", typography: "label", gap: "space.3" },
  focus,
  disabled: { textColor: "text.disabled" },
});
set("switch.*.label", { rest: empty });
set("switch.*.track", { rest: { ...mark, borderRadius: "radius.pill" }, selected: selectedMark, focus });
set("switch.*.thumb", {
  rest: { backgroundColor: "text.primary", borderRadius: "radius.pill" },
  selected: { backgroundColor: "text.on-accent" },
});

set("menu.*.root", { rest: empty });
set("menu.*.trigger", {
  rest: { ...control, textColor: "text.primary", borderColor: "border.strong" },
  hover: { backgroundColor: "surface.hover" },
  focus,
  disabled: disabledControl,
});
set("menu.*.content", { rest: floating });
set("menuItem.*.root", {
  rest: item,
  hover: { backgroundColor: "surface.hover" },
  focus,
  disabled: { textColor: "text.disabled" },
});
for (const slot of ["label", "icon"]) set(`menuItem.*.${slot}`, { rest: empty });
set("popover.*.root", { rest: empty });
set("popover.*.trigger", {
  rest: { ...control, textColor: "text.primary", borderColor: "border.strong" },
  hover: { backgroundColor: "surface.hover" },
  focus,
});
set("popover.*.content", { rest: floating });

set("dialog.*.root", { rest: empty });
set("dialog.*.backdrop", { rest: { backgroundColor: "surface.scrim", backgroundOpacity: 0.5 } });
set("dialog.*.content", { rest: { ...floating, padding: "space.5", gap: "space.4" } });
set("dialog.*.title", { rest: { textColor: "text.primary", typography: "heading.3" } });
set("dialog.*.close", {
  rest: { ...control, textColor: "text.primary", borderColor: "border.strong" },
  hover: { backgroundColor: "surface.hover" },
  focus,
});
set("tooltip.*.root", { rest: empty });
set("tooltip.*.trigger", { rest: empty });
set("tooltip.*.content", { rest: { ...floating, typography: "caption" } });

set("tabs.*.root", { rest: empty });
set("tabs.*.list", { rest: { gap: "space.1" } });
// A panel with no focusable content is itself a tab stop, so the kind's focus overlay belongs to it.
set("tabs.*.panel", { rest: { paddingY: "space.3" }, focus });
set("tab.*.root", {
  rest: {
    backgroundColor: "none",
    textColor: "text.muted",
    borderRadius: "radius.control",
    paddingX: "space.3",
    paddingY: "space.2",
    gap: "space.2",
    typography: "label",
    ...motion,
  },
  hover: { textColor: "text.primary", backgroundColor: "surface.hover" },
  focus,
  disabled: { textColor: "text.disabled" },
  selected: { textColor: "accent.text", shadow: [shadowLayer("accent.fill", 1, -2, 0, 0, true)] },
});
set("tab.*.label", { rest: empty });
set("tab.*.count", { rest: { typography: "mono" } });
set("tab.*.panel", { rest: empty });

set("disclosure.*.root", { rest: { textColor: "text.muted", typography: "label", gap: "space.1" } });
set("disclosure.*.summary", {
  rest: { textColor: "text.muted", typography: "label", paddingY: "space.1", borderRadius: "radius.control" },
  hover: { textColor: "text.primary" },
  focus,
});
set("disclosure.*.panel", { rest: { textColor: "text.primary", typography: "body", paddingY: "space.1" } });

/** The starter design system: complete for the starter catalog, with a tone axis and one extension property. */
export const designSystem: DesignSystem = valid(
  "design system",
  validateDesignSystem(
    { format: "liveframe-design-system/1", id: "starter", version: "1.0.0", values, recipes },
    { catalog, registry: {} },
  ),
);
