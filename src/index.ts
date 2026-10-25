/** The wire format id stamped on every UI tree (spec §9). */
export const LIVEFRAME_FORMAT = "liveframe/1" as const;

export { LiveframeFailure, type LiveframeError, type Result } from "./errors.ts";
export {
  type Catalog,
  type Definition,
  classifyCatalogChange,
  defineComponent,
  validateCatalog,
} from "./formats/catalog.ts";
export { recipeProperties, semantics, states, styleProps } from "./formats/fixed.ts";
export { type Vocabulary, validateVocabulary } from "./formats/vocabulary.ts";
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
  str,
} from "./schema.ts";

export { type Capabilities, validateCapabilities } from "./formats/capabilities.ts";
export { type Manifest, validateManifest } from "./formats/manifest.ts";
export { type Theme, validateTheme } from "./formats/theme.ts";
export {
  type DesignSystem,
  type DesignSystemContext,
  type DesignValue,
  type Recipe,
  type RecipeKey,
  type ResolvedRecipe,
  validateDesignSystem,
} from "./formats/design-system.ts";
export { type ResolvedRecipes, resolveRecipes } from "./resolve.ts";
export type { Intent, Json, UiNode, UiTree } from "./formats/tree.ts";
export { compileValidator, type CompileValidatorOptions, type CompiledValidator } from "./validate/compile.ts";
export type { ValidateTreeOptions } from "./validate/tree.ts";
