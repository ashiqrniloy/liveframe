import type { ResolvedRecipe } from "../formats/design-system.ts";

export const forcedStateDeclarations = {
  hover: "outline:1px solid Highlight",
  focus: "outline:2px solid Highlight",
  active: "outline:1px solid Highlight",
  open: "outline:1px solid Highlight",
  selected: "background-color:Highlight;color:HighlightText",
  current: "outline:2px solid Highlight",
  mixed: "background-color:Highlight;color:HighlightText",
  pending: "outline:1px dashed CanvasText",
  readonly: "border-color:GrayText",
  invalid: "outline:2px dashed CanvasText",
  disabled: "color:GrayText",
} as const;

/** An app state has no system colour of its own, so it takes the cue `hover`, `active` and `open` share. */
const forcedAppStateDeclarations = "outline:1px solid Highlight";

/** The forced-colours cue for a library or app state. */
export function forcedStateCue(state: string): string {
  return (forcedStateDeclarations as Readonly<Record<string, string>>)[state] ?? forcedAppStateDeclarations;
}

export function forcedEdgeDeclarations(recipe: ResolvedRecipe): string {
  const widths = [
    recipe.borderWidth,
    recipe.borderTopWidth,
    recipe.borderRightWidth,
    recipe.borderBottomWidth,
    recipe.borderLeftWidth,
  ];
  return recipe.backgroundColor && !widths.some((width) => width && width.value > 0)
    ? "outline:1px solid CanvasText;outline-offset:-1px"
    : "";
}

/** Forced colours leave native scrollbars to the OS and restore the placeholder's system colour. */
export const forcedScrollbarDeclarations = "scrollbar-color:auto";
export const forcedPlaceholderDeclarations = "color:GrayText;opacity:1";
