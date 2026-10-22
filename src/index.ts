/** The wire format id stamped on every UI tree (spec §9). */
export const LIVEFRAME_FORMAT = "liveframe/1" as const;

export type { LiveframeError, Result } from "./errors.ts";
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
