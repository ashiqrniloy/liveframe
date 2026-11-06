import type { LiveframeError, Result } from "../errors.ts";
import { at } from "../internal.ts";
import { arr, type Infer, int, num, obj, record, str } from "../schema.ts";
import { checkFormat } from "./check.ts";
import { extensionKinds, noPaint } from "./fixed.ts";
import { validateJson } from "./json.ts";

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

export const extensionName = str({ maxLength: 64, pattern: "^[a-z][A-Za-z0-9-]*$" });
const extensionDescription = { description: str({ maxLength: 500 }) };
/** An app's recipe property: a theme colour, or a typed design value of one kind. */
const extension = {
  oneOf: [
    obj({ type: str({ maxLength: 6, enum: ["colour"] }) }, extensionDescription),
    obj(
      { type: str({ maxLength: 5, enum: ["value"] }), kind: str({ maxLength: 16, enum: extensionKinds }) },
      extensionDescription,
    ),
  ],
};
export type Extension = {
  readonly type: "colour" | "value";
  readonly kind?: (typeof extensionKinds)[number];
  readonly description?: string;
};

export type Vocabulary = { readonly [K in keyof typeof lists]: Infer<(typeof lists)[K]> } & {
  readonly tones: Readonly<Record<string, string>>;
  readonly surfaceTypography: string;
  readonly contrast?: Infer<typeof contrast>;
  readonly contrastBase?: string;
  readonly extensions?: Readonly<Record<string, Extension>>;
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
    extensions: { ...record(extensionName.pattern, extension, 64), propertyNames: extensionName },
  },
  required: [...Object.keys(lists), "tones", "surfaceTypography"],
  additionalProperties: false,
} as const;

type Checks = {
  readonly errors: LiveframeError[];
  readonly reject: (kind: "invalid-document" | "unknown-name", pointer: string, message: string) => void;
};

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
  const json = validateJson(doc, true);
  if (!json.ok) return json;
  const shape = checkFormat(vocabularySchema, doc);
  if (!shape.ok) return shape;
  const errors: LiveframeError[] = [];
  const c: Checks = {
    errors,
    reject: (kind, pointer, message) => {
      if (errors.length < 20) errors.push({ kind, pointer, message });
    },
  };
  const pointer = (key: string) => at("", key);
  const value = doc as Vocabulary;
  checkReferences(value, pointer, c);
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
