import type { ResolvedRecipe } from "../formats/design-system.ts";

export const forcedStateDeclarations = {
  hover: "outline:1px solid Highlight",
  focus: "outline:2px solid Highlight",
  active: "outline:1px solid Highlight",
  open: "outline:1px solid Highlight",
  selected: "background-color:Highlight;color:HighlightText",
  invalid: "outline:2px dashed CanvasText",
  disabled: "color:GrayText",
} as const;

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
