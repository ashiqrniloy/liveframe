import type { Result } from "../errors.ts";
import { bool, type Infer, num, obj, record, str } from "../schema.ts";
import { at, documentChecks, isRecord } from "./capabilities.ts";
import { checkFormat } from "./check.ts";
import { checkContrast } from "./contrast.ts";
import { type Colour, colourFields, type Typography, typographySchema } from "./dtcg.ts";
import { validateJson } from "./json.ts";
import type { Vocabulary } from "./vocabulary.ts";

// DTCG 2025.10 §4.2: https://www.designtokens.org/tr/2025.10/color/#supported-color-spaces
// Lab axes and LCH chroma have no theoretical upper bound; typical values are not limits.
const unit = num({ minimum: 0, maximum: 1 });
const percent = num({ minimum: 0, maximum: 100 });
const hue = { type: "number", minimum: 0, exclusiveMaximum: 360 } as const;
const colourRanges = {
  srgb: [unit, unit, unit],
  "srgb-linear": [unit, unit, unit],
  hsl: [hue, percent, percent],
  hwb: [hue, percent, percent],
  lab: [percent, num(), num()],
  lch: [percent, num({ minimum: 0 }), hue],
  oklab: [unit, num(), num()],
  oklch: [unit, num({ minimum: 0 }), hue],
  "display-p3": [unit, unit, unit],
  "a98-rgb": [unit, unit, unit],
  "prophoto-rgb": [unit, unit, unit],
  rec2020: [unit, unit, unit],
  "xyz-d65": [unit, unit, unit],
  "xyz-d50": [unit, unit, unit],
} as const satisfies Record<Colour["colorSpace"], readonly unknown[]>;
const colourSchema = {
  oneOf: Object.entries(colourRanges).map(([space, ranges]) => ({
    ...colourFields,
    properties: {
      ...colourFields.properties,
      colorSpace: { const: space },
      components: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        prefixItems: ranges.map((range) => ({ oneOf: [range, { const: "none" }] })),
        items: false,
      },
    },
  })),
};
const roleName = str({ maxLength: 64, pattern: "^[a-z][a-z0-9-]*(\\.[a-z0-9-]+)*$" });
const fields = obj({
  format: str({ maxLength: 32, enum: ["liveframe-theme/1"] }),
  id: str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9.-]*$" }),
  version: str({ maxLength: 128, pattern: "^.+$" }),
  colorScheme: str({ maxLength: 5, enum: ["light", "dark"] }),
  colours: bool(),
  typography: bool(),
});
export type Theme = Omit<Infer<typeof fields>, "colours" | "typography"> & {
  readonly colours: Readonly<Record<string, Colour>>;
  readonly typography: Readonly<Record<string, Typography>>;
};
export const themeSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    colours: { ...record(roleName.pattern, colourSchema, 256), propertyNames: roleName },
    typography: { ...record(roleName.pattern, typographySchema, 256), propertyNames: roleName },
  },
};

type Checks = ReturnType<typeof documentChecks>;

/** Validates a resolved theme against an installed vocabulary, collecting up to 20 errors. */
export function validateTheme(doc: unknown, vocabulary: Vocabulary): Result<Theme> {
  const json = validateJson(doc, true);
  if (!json.ok) return json;
  const c = documentChecks();
  c.collect(checkFormat(themeSchema, doc), "");
  if (!isRecord(doc)) return { ok: false, errors: c.errors };
  checkRoleMap("colours", (doc as Theme).colours, vocabulary.colourRoles, c);
  checkRoleMap("typography", (doc as Theme).typography, vocabulary.typographyRoles, c);
  if (!c.errors.length) checkContrast(doc as Theme, vocabulary, c.reject);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Theme };
}

/** One role map: every declared role present, then every entry's own value. */
function checkRoleMap(key: "colours" | "typography", values: unknown, roles: readonly string[], c: Checks): void {
  if (!isRecord(values)) return;
  if (Object.keys(values).length > themeSchema.properties[key].maxProperties) return;
  const declared = new Set(roles);
  for (const role of roles)
    if (!Object.hasOwn(values, role)) c.reject(at(`/${key}`, role), "Missing declared role", "unknown-name");
  for (const role of Object.keys(values)) {
    if (c.errors.length >= 20) break;
    if (!declared.has(role)) c.reject(at(`/${key}`, role), "Undeclared role", "unknown-name");
  }
}
