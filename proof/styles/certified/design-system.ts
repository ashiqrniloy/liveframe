import { completeRecipes } from "../recipes.ts";
import type { DesignSystem, Recipe } from "../types.ts";

// Certified 4.0: hairlines, sharp plates, quiet danger ink, feedback-only motion.
const focus: Recipe = { outlineColor: "focus.ring", outlineWidth: 2, outlineOffset: 2, outlineStyle: "solid" };
const control: Recipe = {
  backgroundColor: "colour.transparent",
  textColor: "text.primary",
  borderColor: "colour.transparent",
  borderWidth: "border.hairline",
  borderRadius: "radius.control",
  paddingX: "space.4",
  paddingY: "space.2",
  gap: "space.2",
  typography: "label",
  transitionDuration: "motion.fast",
  transitionTiming: "expo-out",
};
const field: Recipe = {
  backgroundColor: "surface.module",
  textColor: "text.primary",
  borderColor: "border.strong",
  borderWidth: "border.hairline",
  borderRadius: "radius.control",
  paddingX: "space.3",
  paddingY: "space.2",
  typography: "body",
  transitionDuration: "motion.fast",
  transitionTiming: "expo-out",
};
const floating: Recipe = {
  backgroundColor: "surface.module",
  textColor: "text.primary",
  borderColor: "border.subtle",
  borderWidth: "border.hairline",
  borderRadius: "radius.plate",
  padding: "space.1",
  shadow: "shadow.pop",
};
const item: Recipe = {
  backgroundColor: "colour.transparent",
  textColor: "text.primary",
  borderWidth: 0,
  borderRadius: "radius.plate",
  paddingX: "space.3",
  paddingY: "space.2",
  gap: "space.2",
  typography: "label",
};
const indicator: Recipe = {
  backgroundColor: "colour.transparent",
  borderColor: "border.strong",
  borderWidth: "border.hairline",
  borderRadius: "radius.plate",
};
const seeds: Record<string, Recipe> = {
  "box.default.root.rest": {},
  "stack.default.root.rest": {},
  "inline.default.root.rest": {},
  "grid.default.root.rest": {},
  "scroll.default.root.rest": {},
  "scroll.default.viewport.rest": {},
  "scroll.default.scrollbar.rest": { backgroundColor: "surface.scrollbar", borderRadius: "radius.control" },
  "separator.default.root.rest": { borderColor: "border.hairline", borderWidth: "border.hairline" },
  "text.default.root.rest": { textColor: "text.primary", typography: "body" },
  "heading.default.root.rest": { textColor: "text.primary", typography: "heading.2" },
  "icon.default.root.rest": {},
  "image.default.root.rest": {},
  "link.default.root.rest": { textColor: "text.primary", typography: "body" },
  "link.default.root.hover": { textColor: "accent.primary" },
  "link.default.root.focus": focus,
  "link.default.label.rest": {},
  "button.default.root.rest": { ...control, borderColor: "border.strong", backgroundColor: "surface.module" },
  "button.default.root.hover": { borderColor: "text.primary" },
  "button.primary.root.rest": {
    ...control,
    backgroundColor: "accent.fill",
    textColor: "text.on-accent",
    borderColor: "accent.fill",
  },
  "button.primary.root.hover": { backgroundColor: "accent.fill.hover", borderColor: "accent.fill.hover" },
  "button.primary.root.disabled": {
    backgroundColor: "surface.active",
    borderColor: "surface.active",
    textColor: "text.disabled",
  },
  "button.danger.root.rest": { ...control, textColor: "diagnostic.error" },
  "button.danger.root.hover": { backgroundColor: "surface.hover" },
  "button.ghost.root.rest": { ...control, textColor: "text.muted", paddingX: "space.3" },
  "button.ghost.root.hover": { backgroundColor: "surface.hover", textColor: "text.primary" },
  "textField.default.root.rest": { gap: "space.2" },
  "textField.default.label.rest": { typography: "label" },
  "textField.default.input.rest": field,
  "select.default.root.rest": { gap: "space.2" },
  "select.default.label.rest": { typography: "label" },
  "select.default.trigger.rest": field,
  "select.default.list.rest": floating,
  "select.default.option.rest": item,
  "select.default.option.hover": { backgroundColor: "surface.hover" },
  "select.default.option.selected": { backgroundColor: "surface.selected" },
  "select.default.option.focus": focus,
  "checkbox.default.root.rest": { textColor: "text.muted", typography: "label", gap: "space.2" },
  "checkbox.default.label.rest": {},
  "checkbox.default.indicator.rest": indicator,
  "switch.default.root.rest": { typography: "label", gap: "space.3" },
  "switch.default.label.rest": {},
  "switch.default.track.rest": { ...indicator, borderRadius: "radius.pill" },
  "switch.default.thumb.rest": { backgroundColor: "text.primary", borderRadius: "radius.pill" },
  "switch.default.thumb.selected": { backgroundColor: "text.on-accent" },
  "menu.default.root.rest": {},
  "menu.default.trigger.rest": control,
  "menu.default.content.rest": floating,
  "menuItem.default.root.rest": item,
  "menuItem.danger.root.rest": { ...item, textColor: "diagnostic.error" },
  "popover.default.root.rest": {},
  "popover.default.trigger.rest": control,
  "popover.default.content.rest": floating,
  "dialog.default.root.rest": {},
  "dialog.default.backdrop.rest": { backgroundColor: "surface.base", backgroundOpacity: 0.78 },
  "dialog.default.content.rest": { ...floating, padding: "space.5", gap: "space.4" },
  "dialog.default.title.rest": { typography: "heading.3", textColor: "text.primary" },
  "dialog.default.close.rest": control,
  "tooltip.default.root.rest": {},
  "tooltip.default.trigger.rest": {},
  "tooltip.default.content.rest": { ...floating, typography: "meta" },
  "tabs.default.root.rest": {},
  "tabs.default.list.rest": { gap: "space.1" },
  "tabs.default.panel.rest": {},
  "tab.default.root.rest": {
    ...item,
    textColor: "text.muted",
    borderRadius: 0,
    transitionDuration: "motion.fast",
    transitionTiming: "expo-out",
  },
  "tab.default.root.hover": {
    textColor: "text.primary",
    shadow: [{ inset: true, x: 0, y: -1, blur: 0, spread: 0, colorRole: "border.subtle", opacity: 1 }],
  },
  "tab.default.root.selected": {
    textColor: "text.primary",
    shadow: [{ inset: true, x: 0, y: -2, blur: 0, spread: 0, colorRole: "text.primary", opacity: 1 }],
  },
  "tab.default.label.rest": {},
  "tab.default.panel.rest": {},
};
for (const variant of ["default", "primary", "danger", "ghost"]) {
  seeds[`button.${variant}.label.rest`] = {};
  seeds[`button.${variant}.icon.rest`] = { opacity: 0.9 };
}
for (const prefix of [
  "button.default.root",
  "button.primary.root",
  "button.danger.root",
  "button.ghost.root",
  "menu.default.trigger",
  "popover.default.trigger",
  "dialog.default.close",
  "menuItem.default.root",
  "menuItem.danger.root",
  "tab.default.root",
]) {
  seeds[`${prefix}.focus`] = focus;
  seeds[`${prefix}.active`] = { transformPreset: "press-shift-down" };
  seeds[`${prefix}.disabled`] ??= { textColor: "text.disabled", backgroundColor: "colour.transparent" };
}
for (const prefix of [
  "menu.default.trigger",
  "popover.default.trigger",
  "dialog.default.close",
  "menuItem.default.root",
  "menuItem.danger.root",
]) {
  seeds[`${prefix}.hover`] = { backgroundColor: "surface.hover" };
}
for (const variant of ["default", "danger"]) {
  seeds[`menuItem.${variant}.label.rest`] = {};
  seeds[`menuItem.${variant}.icon.rest`] = {};
}
for (const prefix of ["textField.default.input", "select.default.trigger"]) {
  seeds[`${prefix}.hover`] = { borderColor: "text.primary" };
  seeds[`${prefix}.focus`] = { ...focus, outlineOffset: 1, borderColor: "text.primary" };
  seeds[`${prefix}.disabled`] = {
    textColor: "text.disabled",
    backgroundColor: "surface.well",
    borderColor: "border.subtle",
  };
  seeds[`${prefix}.invalid`] = { borderColor: "diagnostic.error" };
}
for (const prefix of ["checkbox.default.indicator", "switch.default.track"]) {
  seeds[`${prefix}.selected`] = {
    backgroundColor: "accent.fill",
    textColor: "text.on-accent",
    borderColor: "accent.fill",
  };
  seeds[`${prefix}.focus`] = focus;
}
for (const prefix of ["checkbox.default.root", "switch.default.root"]) {
  seeds[`${prefix}.focus`] = focus;
  seeds[`${prefix}.disabled`] = { textColor: "text.disabled", opacity: "opacity.disabled" };
}

export const certifiedDesignSystem = {
  id: "certified",
  values: {
    "radius.control": { type: "radius", value: 3 },
    "radius.plate": { type: "radius", value: 2 },
    "radius.pill": { type: "radius", value: 999 },
    "border.hairline": { type: "border-width", value: 1 },
    "space.0": { type: "spacing", value: 0 },
    "space.1": { type: "spacing", value: 4 },
    "space.2": { type: "spacing", value: 8 },
    "space.3": { type: "spacing", value: 12 },
    "space.4": { type: "spacing", value: 16 },
    "space.5": { type: "spacing", value: 24 },
    "space.6": { type: "spacing", value: 32 },
    "space.7": { type: "spacing", value: 48 },
    "motion.fast": { type: "motion-duration", value: 150 },
    "opacity.disabled": { type: "opacity", value: 0.5 },
    "expo-out": { type: "easing", value: [0.16, 1, 0.3, 1] },
    "shadow.pop": {
      type: "shadow",
      value: [
        { x: 0, y: 2, blur: 6, spread: 0, colorRole: "shadow.ambient", opacity: 0.14 },
        { x: 0, y: 24, blur: 48, spread: -20, colorRole: "shadow.ambient", opacity: 0.45 },
      ],
    },
    "shadow.mount": {
      type: "shadow",
      value: [
        { inset: true, x: 0, y: 1, blur: 0, spread: 0, colorRole: "shadow.highlight", opacity: 0.9 },
        { x: 0, y: 1, blur: 2, spread: 0, colorRole: "shadow.ambient", opacity: 0.1 },
        { x: 0, y: 6, blur: 14, spread: -8, colorRole: "shadow.ambient", opacity: 0.22 },
      ],
    },
  },
  recipes: completeRecipes(seeds),
} as const satisfies DesignSystem;
