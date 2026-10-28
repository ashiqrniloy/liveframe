import type { LiveframeError, Result } from "../errors.ts";
import { arr, checkValue, type Infer, int, isRecord, num, obj, record, str } from "../schema.ts";

import { noPaint } from "./fixed.ts";

const name = str({ maxLength: 64, pattern: "^[a-z][a-z0-9-]*(\\.[a-z0-9-]+)*$" });
function names(prefix = "") {
  return {
    ...arr(prefix ? str({ ...name, pattern: `^${prefix}\\.[a-z0-9-]+(\\.[a-z0-9-]+)*$` }) : name, { maxItems: 256 }),
    uniqueItems: true,
  };
}
const lists = {
  colourRoles: { ...names(), items: str({ ...name, pattern: `^(?!${noPaint}$)${name.pattern.slice(1)}` }) },
  surfaceRoles: names(),
  fillableRoles: names(),
  typographyRoles: names(),
  space: names("space"),
  radius: names("radius"),
  size: names("size"),
  breakpoints: names("bp"),
} as const;
const pair = obj(
  { foreground: name, background: name, minimum: num({ minimum: 1, maximum: 21 }) },
  {
    maximum: num({ minimum: 1, maximum: 21 }),
    lessThan: int({ minimum: 0, maximum: 255 }),
    description: str({ maxLength: 500 }),
  },
);
const contrast = arr(pair, { maxItems: 256 });

export type Vocabulary = { readonly [K in keyof typeof lists]: Infer<(typeof lists)[K]> } & {
  readonly tones: Readonly<Record<string, string>>;
  readonly surfaceTypography: string;
  readonly contrast?: Infer<typeof contrast>;
  readonly contrastBase?: string;
};

/** Embedded in the catalog schema; cross-references are checked on install. */
export const vocabularySchema = {
  type: "object",
  properties: {
    ...lists,
    tones: { ...record(name.pattern, name, 256), propertyNames: name },
    surfaceTypography: name,
    contrast,
    contrastBase: name,
  },
  required: [...Object.keys(lists), "tones", "surfaceTypography"],
  additionalProperties: false,
} as const;

type Checks = {
  readonly errors: LiveframeError[];
  readonly reject: (kind: "invalid-document" | "unknown-name", pointer: string, message: string) => void;
};

/** Each declared list must pass its language schema and hold unique names. */
function checkLists(input: Record<string, unknown>, c: Checks): void {
  for (const [key, schema] of Object.entries(lists)) {
    if (c.errors.length >= 20) break;
    // Uniqueness is a format constraint, outside the author's schema language.
    const { uniqueItems: _, ...languageSchema } = schema;
    const result = checkValue(languageSchema, Object.hasOwn(input, key) ? input[key] : undefined);
    if (!result.ok) {
      for (const error of result.errors) c.reject("invalid-document", `/${key}${error.pointer}`, error.message);
      continue;
    }
    const seen = new Set<string>();
    for (const [i, value] of result.value.entries()) {
      if (seen.has(value)) c.reject("invalid-document", `/${key}/${i}`, "Names must be unique within a list");
      seen.add(value);
    }
  }
}

function checkTones(tones: unknown, pointer: (key: string) => string, c: Checks): void {
  if (tones === null || typeof tones !== "object" || Array.isArray(tones)) {
    c.reject("invalid-document", "/tones", "Expected a tone-to-colour-role object");
    return;
  }
  const entries = Object.entries(tones);
  if (entries.length > 256) c.reject("invalid-document", "/tones", "Expected at most 256 tones");
  for (const [key, value] of entries) {
    if (c.errors.length >= 20) break;
    if (!checkValue(name, key).ok || !checkValue(name, value).ok)
      c.reject("invalid-document", `/tones${pointer(key)}`, "Expected bounded vocabulary names");
  }
}

/** Cross-references: every role a surface, fill or tone names must be declared. */
function checkReferences(value: Vocabulary, pointer: (key: string) => string, c: Checks): void {
  const colours = new Set(value.colourRoles);
  for (const key of ["surfaceRoles", "fillableRoles"] as const)
    for (const [i, role] of value[key].entries())
      if (!colours.has(role)) c.reject("unknown-name", `/${key}/${i}`, `Undeclared colour role: ${role}`);
  for (const [tone, role] of Object.entries(value.tones))
    if (!colours.has(role)) c.reject("unknown-name", `/tones${pointer(tone)}`, `Undeclared colour role: ${role}`);
  if (!value.typographyRoles.includes(value.surfaceTypography))
    c.reject("unknown-name", "/surfaceTypography", `Undeclared typography role: ${value.surfaceTypography}`);
  checkContrastReferences(value, colours, c);
}

function checkContrastReferences(value: Vocabulary, colours: ReadonlySet<string>, c: Checks): void {
  if (value.contrastBase !== undefined && !value.surfaceRoles.includes(value.contrastBase))
    c.reject("unknown-name", "/contrastBase", `Expected a declared surface role: ${value.contrastBase}`);
  const pairs = value.contrast ?? [];
  for (const [i, pair] of pairs.entries()) {
    for (const key of ["foreground", "background"] as const)
      if (!colours.has(pair[key]))
        c.reject("unknown-name", `/contrast/${i}/${key}`, `Undeclared colour role: ${pair[key]}`);
    if (pair.maximum !== undefined && pair.maximum < pair.minimum)
      c.reject("invalid-document", `/contrast/${i}/maximum`, "Maximum must be at least minimum");
    if (pair.lessThan !== undefined && (pair.lessThan >= pairs.length || pair.lessThan === i))
      c.reject("invalid-document", `/contrast/${i}/lessThan`, "Expected another contrast pair index");
  }
  // Each node has at most one outgoing edge; visiting each once keeps cycle detection linear.
  const done = new Set<number>();
  for (let i = 0; i < pairs.length; i++) {
    const path = new Set<number>();
    let next: number | undefined = i;
    while (next !== undefined && next < pairs.length && !done.has(next)) {
      if (path.has(next)) {
        c.reject("invalid-document", `/contrast/${next}/lessThan`, "Cyclic contrast ordering");
        break;
      }
      path.add(next);
      next = pairs[next]?.lessThan;
    }
    for (const index of path) done.add(index);
  }
}

/** Checks the closed vocabulary and collects at most 20 pointed failures. */
export function validateVocabulary(doc: unknown): Result<Vocabulary> {
  const errors: LiveframeError[] = [];
  const c: Checks = {
    errors,
    reject: (kind, pointer, message) => {
      if (errors.length < 20) errors.push({ kind, pointer, message });
    },
  };
  if (!isRecord(doc)) {
    c.reject("invalid-document", "", "Expected a vocabulary object");
    return { ok: false, errors };
  }
  const pointer = (key: string) => `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  for (const key of vocabularySchema.required)
    if (!Object.hasOwn(doc, key)) c.reject("invalid-document", pointer(key), "Expected a required property");
  for (const key of Object.keys(doc)) {
    if (errors.length >= 20) break;
    if (!Object.hasOwn(vocabularySchema.properties, key))
      c.reject("invalid-document", pointer(key), "Unknown property");
  }
  checkLists(doc, c);
  const typography = checkValue(name, Object.hasOwn(doc, "surfaceTypography") ? doc.surfaceTypography : undefined);
  if (!typography.ok)
    for (const error of typography.errors)
      c.reject("invalid-document", `/surfaceTypography${error.pointer}`, error.message);
  checkTones(Object.hasOwn(doc, "tones") ? doc.tones : undefined, pointer, c);
  for (const [key, schema] of Object.entries({ contrast, contrastBase: name })) {
    if (!Object.hasOwn(doc, key)) continue;
    const result = checkValue(schema, doc[key]);
    if (!result.ok)
      for (const error of result.errors) c.reject("invalid-document", `/${key}${error.pointer}`, error.message);
  }
  if (errors.length) return { ok: false, errors };
  const value = doc as Vocabulary;
  checkReferences(value, pointer, c);
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
