import type { Result } from "../errors.ts";
import { bool, checkValue, type Infer, num, obj, record, str } from "../schema.ts";
import { at, documentChecks, isRecord, shell } from "./capabilities.ts";
import {
  type Colour,
  colourFields,
  fontList,
  fontName,
  fontWeightAlias,
  fontWeightNumber,
  type Typography,
  typographyFields,
  typographySchema,
} from "./dtcg.ts";
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
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a theme object");
  else {
    c.collect(checkValue(fields, shell(doc, ["colours", "typography"])), "");
    checkRoleMap("colours", doc.colours, vocabulary.colourRoles, c);
    checkRoleMap("typography", doc.typography, vocabulary.typographyRoles, c);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Theme };
}

/** One role map: every declared role present, then every entry's own value. */
function checkRoleMap(key: "colours" | "typography", values: unknown, roles: readonly string[], c: Checks): void {
  if (!isRecord(values)) {
    c.reject(`/${key}`, "Expected a role map");
    return;
  }
  if (Object.keys(values).length > 256) {
    c.reject(`/${key}`, "Expected at most 256 roles");
    return;
  }
  const declared = new Set(roles);
  for (const role of roles)
    if (!Object.hasOwn(values, role)) c.reject(at(`/${key}`, role), "Missing declared role", "unknown-name");
  for (const [role, entry] of Object.entries(values)) {
    if (c.errors.length >= 20) break;
    checkRole(key, role, entry, declared, c);
  }
}

function checkRole(
  key: "colours" | "typography",
  role: string,
  entry: unknown,
  declared: ReadonlySet<string>,
  c: Checks,
): void {
  const pointer = at(`/${key}`, role);
  c.collect(checkValue(roleName, role), pointer);
  if (!declared.has(role)) c.reject(pointer, "Undeclared role", "unknown-name");
  if (!isRecord(entry)) {
    c.reject(pointer, "Expected a role value object");
    return;
  }
  if (key === "colours") checkColour(entry, pointer, c);
  else checkTypography(entry, pointer, c);
}

function checkColour(entry: Record<string, unknown>, pointer: string, c: Checks): void {
  c.collect(checkValue(colourFields, shell(entry, ["components"])), pointer);
  if (!Array.isArray(entry.components) || entry.components.length !== 3) {
    c.reject(`${pointer}/components`, "Expected exactly three components");
    return;
  }
  if (typeof entry.colorSpace !== "string" || !Object.hasOwn(colourRanges, entry.colorSpace)) return;
  const ranges = colourRanges[entry.colorSpace as Colour["colorSpace"]];
  for (const [i, range] of ranges.entries())
    checkComponent(range, entry.components[i], `${pointer}/components/${i}`, c);
}

function checkComponent(
  range: (typeof colourRanges)[Colour["colorSpace"]][number],
  value: unknown,
  pointer: string,
  c: Checks,
): void {
  if (value === "none") return;
  c.collect(checkValue("exclusiveMaximum" in range ? num({ minimum: range.minimum }) : range, value), pointer);
  if ("exclusiveMaximum" in range && typeof value === "number" && value >= range.exclusiveMaximum)
    c.reject(pointer, "Expected a hue below 360 degrees");
}

function checkTypography(entry: Record<string, unknown>, pointer: string, c: Checks): void {
  c.collect(checkValue(typographyFields, shell(entry, ["fontFamily", "fontWeight"])), pointer);
  c.collect(
    checkValue(Array.isArray(entry.fontFamily) ? fontList : fontName, entry.fontFamily),
    `${pointer}/fontFamily`,
  );
  if (Array.isArray(entry.fontFamily) && !entry.fontFamily.length)
    c.reject(`${pointer}/fontFamily`, "Expected at least one font name");
  c.collect(
    checkValue(typeof entry.fontWeight === "number" ? fontWeightNumber : fontWeightAlias, entry.fontWeight),
    `${pointer}/fontWeight`,
  );
}
