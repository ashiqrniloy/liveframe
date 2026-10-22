/** The wire format id stamped on every UI tree (spec §9). */
export const LIVEFRAME_FORMAT = "liveframe/1" as const;

export type { LiveframeError, Result } from "./errors.ts";
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
