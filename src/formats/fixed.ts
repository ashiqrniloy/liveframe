/** Library-fixed vocabulary (spec §5–§6); role and design-value names belong to apps. */
export const noPaint = "none";

/**
 * The fixed state vocabulary, in source order: `rest` first, then the overlays in cascade order
 * (spec §6.2). `current`, `mixed`, `pending` and `readonly` sit between `selected` and `invalid`.
 * Apps add their own through `vocabulary.states` (spec §5); these twelve are never replaced.
 */
export const states = [
  "rest",
  "hover",
  "active",
  "focus",
  "disabled",
  "selected",
  "current",
  "mixed",
  "pending",
  "readonly",
  "invalid",
  "open",
] as const;

export const semantics = [
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "nav",
  "list",
  "listItem",
  "terms",
  "term",
  "detail",
  "form",
  "group",
  "figure",
  "status",
  "alert",
] as const;

/**
 * The data attributes the library states already select on, so an app state cannot reuse one
 * (spec §6.4). `hover`, `focus` and `active` also match native pseudo-classes.
 */
export const libraryStateAttributes: readonly string[] = [
  "data-hovered",
  "data-focus-visible",
  "data-pressed",
  "data-open",
  "data-expanded",
  "data-selected",
  "data-current",
  "data-mixed",
  "data-pending",
  "data-readonly",
  "data-invalid",
  "data-disabled",
];

/**
 * The ARIA 1.2 landmark, document-structure and live-region roles that name a region without
 * required states or an accessible-name rule of their own. `vocabulary.semantics` maps an app's
 * names onto these; implementations decide the element (spec §5).
 */
export const ariaRoles = [
  "alert",
  "article",
  "banner",
  "complementary",
  "contentinfo",
  "definition",
  "directory",
  "document",
  "feed",
  "figure",
  "form",
  "group",
  "list",
  "listitem",
  "log",
  "main",
  "marquee",
  "math",
  "navigation",
  "none",
  "note",
  "presentation",
  "region",
  "search",
  "separator",
  "status",
  "term",
  "timer",
  "toolbar",
] as const;

export const styleProps = [
  "padding",
  "paddingX",
  "paddingY",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginX",
  "marginY",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "direction",
  "align",
  "justify",
  "wrap",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "grow",
  "shrink",
  "basis",
  "columns",
  "rows",
  "area",
  "surface",
  "fill",
  "radius",
  "position",
  "insetTop",
  "insetBottom",
  "deferOffscreen",
  "textAlign",
  "textStyle",
  "tone",
] as const;

export const recipeProperties = [
  "backgroundColor",
  "textColor",
  "borderColor",
  "outlineColor",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderRadius",
  "borderStyle",
  "padding",
  "paddingX",
  "paddingY",
  "gap",
  "typography",
  "opacity",
  "backgroundOpacity",
  "shadow",
  "backdropBlur",
  "backdropSaturate",
  "transitionDuration",
  "transitionTiming",
  "translateY",
  "outlineWidth",
  "outlineOffset",
  "outlineStyle",
  "placeholderColor",
  "scrollbarThumbColor",
  "scrollbarTrackColor",
] as const;

/**
 * The design-value kinds an extension recipe property can carry (spec §6.5). Easings, shadows,
 * breakpoints and typography roles are excluded: the app's CSS cannot use them as one variable.
 */
export const extensionKinds = [
  "spacing",
  "radius",
  "border-width",
  "size",
  "opacity",
  "motion-duration",
  "saturation",
  "backdrop-blur",
] as const;

/** Properties that take a theme role, `none` (except `textColor`) or a role-alpha object. */
export const colourProperties: readonly string[] = [
  "backgroundColor",
  "textColor",
  "borderColor",
  "outlineColor",
  "placeholderColor",
  "scrollbarThumbColor",
  "scrollbarTrackColor",
];

/** Native scrollbar colours are declared only at rest and resolve as a thumb/track pair. */
export const scrollbarProperties: readonly string[] = ["scrollbarThumbColor", "scrollbarTrackColor"];
