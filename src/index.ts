/** The wire format id stamped on every UI tree (spec §9). */
export const LIVEFRAME_FORMAT = "liveframe/1" as const;

export { type LiveframeError, LiveframeFailure, type Result } from "./errors.ts";
export { type Capabilities, capabilitiesFor, validateCapabilities } from "./formats/capabilities.ts";
export {
  type Catalog,
  classifyCatalogChange,
  type Definition,
  defineComponent,
  validateCatalog,
} from "./formats/catalog.ts";
export {
  type DesignSystem,
  type DesignSystemContext,
  type DesignValue,
  type Recipe,
  type RecipeKey,
  type ResolvedRecipe,
  validateDesignSystem,
} from "./formats/design-system.ts";
export { recipeProperties, semantics, states, styleProps } from "./formats/fixed.ts";
export { type Manifest, validateManifest } from "./formats/manifest.ts";
export { type Theme, validateTheme } from "./formats/theme.ts";
export type { Intent, IntentOrigin, Json, UiNode, UiTree } from "./formats/tree.ts";
export { type PatchOp, type TreePatch, validateTreePatch } from "./formats/tree-patch.ts";
export { type Vocabulary, validateVocabulary } from "./formats/vocabulary.ts";
export { type ResolvedRecipes, resolveRecipes } from "./resolve.ts";
export {
  arr,
  bool,
  checkValue,
  type Infer,
  int,
  isLanguageSchema,
  type LanguageSchema,
  num,
  obj,
  sourceOutcome,
  str,
  union,
} from "./schema.ts";
export { type CompiledValidator, type CompileValidatorOptions, compileValidator } from "./validate/compile.ts";
export { checkOffered } from "./validate/offered.ts";
export { applyPatch, diffTrees } from "./validate/patch.ts";
export type { ValidateTreeOptions } from "./validate/tree.ts";
