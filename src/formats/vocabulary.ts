import type { LiveframeError, Result } from "../errors.ts";
import { arr, checkValue, type Infer, record, str } from "../schema.ts";

const name = str({ maxLength: 64, pattern: "^[a-z][a-z0-9-]*(\\.[a-z0-9-]+)*$" });
function names(prefix = "") {
  return {
    ...arr(prefix ? str({ ...name, pattern: `^${prefix}\\.[a-z0-9-]+(\\.[a-z0-9-]+)*$` }) : name, { maxItems: 256 }),
    uniqueItems: true,
  };
}
const lists = {
  colourRoles: names(),
  surfaceRoles: names(),
  fillableRoles: names(),
  typographyRoles: names(),
  space: names("space"),
  radius: names("radius"),
  size: names("size"),
  breakpoints: names("bp"),
} as const;

export type Vocabulary = { readonly [K in keyof typeof lists]: Infer<(typeof lists)[K]> } & {
  readonly tones: Readonly<Record<string, string>>;
  readonly surfaceTypography: string;
};

/** Embedded in the catalog schema; cross-references are checked on install. */
export const vocabularySchema = {
  type: "object",
  properties: { ...lists, tones: { ...record(name.pattern, name, 256), propertyNames: name }, surfaceTypography: name },
  required: [...Object.keys(lists), "tones", "surfaceTypography"],
  additionalProperties: false,
} as const;

/** Checks the closed vocabulary and collects at most 20 pointed failures. */
export function validateVocabulary(doc: unknown): Result<Vocabulary> {
  const errors: LiveframeError[] = [];
  function reject(kind: "invalid-document" | "unknown-name", pointer: string, message: string) {
    if (errors.length < 20) errors.push({ kind, pointer, message });
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    reject("invalid-document", "", "Expected a vocabulary object");
    return { ok: false, errors };
  }
  const input = doc as Record<string, unknown>;
  const pointer = (key: string) => `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  for (const key of vocabularySchema.required)
    if (!Object.hasOwn(input, key)) reject("invalid-document", pointer(key), "Expected a required property");
  for (const key of Object.keys(input)) {
    if (errors.length >= 20) break;
    if (!Object.hasOwn(vocabularySchema.properties, key)) reject("invalid-document", pointer(key), "Unknown property");
  }
  for (const [key, schema] of Object.entries(lists)) {
    if (errors.length >= 20) break;
    // Uniqueness is a format constraint, outside the author's schema language.
    const { uniqueItems: _, ...languageSchema } = schema;
    const result = checkValue(languageSchema, Object.hasOwn(input, key) ? input[key] : undefined);
    if (!result.ok) {
      for (const error of result.errors) reject("invalid-document", `/${key}${error.pointer}`, error.message);
      continue;
    }
    const seen = new Set<string>();
    for (const [i, value] of result.value.entries()) {
      if (seen.has(value)) reject("invalid-document", `/${key}/${i}`, "Names must be unique within a list");
      seen.add(value);
    }
  }
  const typography = checkValue(name, Object.hasOwn(input, "surfaceTypography") ? input.surfaceTypography : undefined);
  if (!typography.ok)
    for (const error of typography.errors)
      reject("invalid-document", `/surfaceTypography${error.pointer}`, error.message);
  const tones = Object.hasOwn(input, "tones") ? input.tones : undefined;
  if (tones === null || typeof tones !== "object" || Array.isArray(tones)) {
    reject("invalid-document", "/tones", "Expected a tone-to-colour-role object");
  } else {
    const entries = Object.entries(tones);
    if (entries.length > 256) reject("invalid-document", "/tones", "Expected at most 256 tones");
    for (const [key, value] of entries) {
      if (errors.length >= 20) break;
      if (!checkValue(name, key).ok || !checkValue(name, value).ok)
        reject("invalid-document", `/tones${pointer(key)}`, "Expected bounded vocabulary names");
    }
  }
  if (errors.length) return { ok: false, errors };

  const value = doc as Vocabulary;
  const colours = new Set(value.colourRoles);
  for (const key of ["surfaceRoles", "fillableRoles"] as const)
    for (const [i, role] of value[key].entries())
      if (!colours.has(role)) reject("unknown-name", `/${key}/${i}`, `Undeclared colour role: ${role}`);
  for (const [tone, role] of Object.entries(value.tones))
    if (!colours.has(role)) reject("unknown-name", `/tones${pointer(tone)}`, `Undeclared colour role: ${role}`);
  if (!value.typographyRoles.includes(value.surfaceTypography))
    reject("unknown-name", "/surfaceTypography", `Undeclared typography role: ${value.surfaceTypography}`);
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
