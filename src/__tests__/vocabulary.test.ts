import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import proofVocabulary from "./fixtures/vocabulary.json" with { type: "json" };
import { vocabularySchema } from "../formats/vocabulary.ts";
import { type Vocabulary, validateVocabulary } from "../index.ts";

const vocabulary = {
  colourRoles: ["surface.base", "text.muted"],
  surfaceRoles: ["surface.base"],
  fillableRoles: [],
  tones: { muted: "text.muted" },
  typographyRoles: ["body"],
  surfaceTypography: "body",
  space: ["space.0"],
  radius: ["radius.control"],
  size: ["size.rail"],
  breakpoints: ["bp.sm"],
} as const satisfies Vocabulary;

function rejects(doc: unknown, kind: string, pointer: string) {
  const result = validateVocabulary(doc);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ kind, pointer }));
}

test("vocabulary_requires_surface_typography", () => {
  const { surfaceTypography: _, ...missing } = vocabulary;
  rejects(missing, "invalid-document", "/surfaceTypography");
  expect(new Ajv2020({ strict: true }).compile(vocabularySchema)(missing)).toBe(false);
});

test("surface_typography_must_be_a_declared_role", () => {
  rejects({ ...vocabulary, surfaceTypography: "display" }, "unknown-name", "/surfaceTypography");
  rejects({ ...vocabulary, typographyRoles: [] }, "unknown-name", "/surfaceTypography");
  expect(validateVocabulary({ ...vocabulary, typographyRoles: ["display"], surfaceTypography: "display" }).ok).toBe(
    true,
  );
});

test("vocabulary_subsets_must_be_declared", () => {
  for (const key of ["surfaceRoles", "fillableRoles"] as const)
    rejects({ ...vocabulary, [key]: ["missing"] }, "unknown-name", `/${key}/0`);
});

test("tones_map_to_declared_roles", () => {
  rejects({ ...vocabulary, tones: { danger: "text.danger" } }, "unknown-name", "/tones/danger");
  rejects({ ...vocabulary, tones: { constructor: "constructor" } }, "unknown-name", "/tones/constructor");
  expect(
    validateVocabulary({
      ...vocabulary,
      colourRoles: ["constructor"],
      tones: { constructor: "constructor" },
      surfaceRoles: [],
    }).ok,
  ).toBe(true);
});

const malformed: readonly (readonly [unknown, string])[] = [
  [null, ""],
  [[], ""],
  [{ ...vocabulary, extra: true }, "/extra"],
  ...[undefined, null, 3, "Body", "body..small", "a".repeat(65)].map(
    (surfaceTypography) => [{ ...vocabulary, surfaceTypography }, "/surfaceTypography"] as const,
  ),
  [{ ...vocabulary, space: undefined }, "/space"],
  [{ ...vocabulary, colourRoles: ["text.muted", "text.muted"] }, "/colourRoles/1"],
  [{ ...vocabulary, typographyRoles: ["a".repeat(65)] }, "/typographyRoles/0"],
  [{ ...vocabulary, typographyRoles: ["Body"] }, "/typographyRoles/0"],
  [{ ...vocabulary, typographyRoles: ["body..small"] }, "/typographyRoles/0"],
  [{ ...vocabulary, typographyRoles: [3] }, "/typographyRoles/0"],
  [{ ...vocabulary, typographyRoles: Array.from({ length: 257 }, (_, i) => `type.${i}`) }, "/typographyRoles"],
  ...(["space", "radius", "size", "breakpoints"] as const).map(
    (key) => [{ ...vocabulary, [key]: ["wrong.name"] }, `/${key}/0`] as const,
  ),
  [{ ...vocabulary, tones: [] }, "/tones"],
  [{ ...vocabulary, tones: { "bad/name~": "text.muted" } }, "/tones/bad~1name~0"],
  [{ ...vocabulary, tones: { ["a".repeat(65)]: "text.muted" } }, `/tones/${"a".repeat(65)}`],
  [{ ...vocabulary, tones: { muted: 3 } }, "/tones/muted"],
  [
    { ...vocabulary, tones: Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`tone.${i}`, "text.muted"])) },
    "/tones",
  ],
];

test("vocabulary_names_are_bounded_and_unique", () => {
  for (const [doc, pointer] of malformed) rejects(doc, "invalid-document", pointer);
  const { space: _, ...missing } = vocabulary;
  rejects(missing, "invalid-document", "/space");
  expect(
    validateVocabulary({ ...vocabulary, typographyRoles: ["a".repeat(64)], surfaceTypography: "a".repeat(64) }).ok,
  ).toBe(true);
  expect(
    validateVocabulary({
      ...vocabulary,
      typographyRoles: Array.from({ length: 256 }, (_, i) => `type.${i}`),
      surfaceTypography: "type.0",
    }).ok,
  ).toBe(true);
});

test("vocabulary_schema_matches_structural_validation", () => {
  const validate = new Ajv2020({ strict: true }).compile(vocabularySchema);
  expect(validate(vocabulary)).toBe(true);
  for (const [doc] of malformed) expect(validate(doc)).toBe(false);
  // Cross-document references are install-time checks, beyond structural JSON Schema.
  expect(validate({ ...vocabulary, tones: { danger: "text.danger" } })).toBe(true);
  expect(validate({ ...vocabulary, surfaceTypography: "display" })).toBe(true);
});

test("vocabulary_errors_are_bounded", () => {
  const result = validateVocabulary({
    ...vocabulary,
    surfaceRoles: Array.from({ length: 256 }, (_, i) => `missing.${i}`),
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toHaveLength(20);
});

test("vocabulary_returns_original_value", () => {
  const result = validateVocabulary(vocabulary);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toBe(vocabulary);
  expect(validateVocabulary({ ...vocabulary, colourRoles: [], surfaceRoles: [], tones: {} }).ok).toBe(true);
});

test("proof_vocabulary_validates_under_one_millisecond", () => {
  // Snapshot of proof/styles/types.ts and proof/css/project.ts; Task 8 exports the full catalog.
  for (let i = 0; i < 20; i++) validateVocabulary(proofVocabulary);
  const start = performance.now();
  const result = validateVocabulary(proofVocabulary);
  const elapsed = performance.now() - start;
  expect(result.ok).toBe(true);
  expect(elapsed).toBeLessThan(1);
  expect(new Ajv2020({ strict: true }).compile(vocabularySchema)(proofVocabulary)).toBe(true);
});
