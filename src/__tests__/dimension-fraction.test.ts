import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import treeSchema from "../../schemas/ui-tree.json" with { type: "json" };
import { compileValidator, type Catalog, type Result, type UiTree } from "../index.ts";
import { jsx, primitive, render, renderElements } from "@arnilo/liveframe/sdk";
import { styleDeclarations } from "../css/index.ts";
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const catalog = catalogDocument as Catalog;
const dimensions = ["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight"] as const;
const validator = compileValidator({
  catalog: {
    ...catalog,
    definitions: catalog.definitions.map((definition) => ({
      ...definition,
      styleProps: [...new Set([...definition.styleProps, ...dimensions])],
    })),
  },
  capabilities,
  manifest,
});
const options = { validator, surfaceId: "test", revision: 0 };
const inputs = {
  params: { canAct: true, canEscalate: false, canViewAlerts: true },
  state: manifest.initialState,
  context: { size: "small" },
  data: {},
};
const Box = primitive("box");
const validateSchema = new Ajv2020({ strict: true }).compile(treeSchema);
const tree = (style: NonNullable<UiTree["root"]["style"]>): UiTree => ({
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "test",
  revision: 0,
  root: { id: "root", kind: "box", props: {}, style },
});

function rejected(result: Result<UiTree>, pointer: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toMatchObject([{ kind: "invalid-prop", pointer }]);
}

test("dimension_fraction_is_invalid_prop", () => {
  for (const prop of dimensions) {
    for (const fraction of ["0fr", "2fr", "12fr", "0.5fr"]) {
      for (const [value, suffix] of [
        [fraction, ""],
        [{ base: fraction }, "/base"],
        [{ base: "fill", "bp.sm": fraction }, "/bp.sm"],
      ] as const) {
        const style = { [prop]: value };
        rejected(validator.validateTree(tree(style)), `/root/style/${prop}${suffix}`);
        rejected(
          render(() => jsx(Box, style), inputs, options),
          `/root/style/${prop}${suffix}`,
        );
        rejected(renderElements({ kind: "box", props: {}, style }, options), `/style/${prop}${suffix}`);
        expect(() => styleDeclarations(style, catalog)).toThrow();
        expect(validateSchema(tree(style))).toBe(false);
      }
    }
  }
});

test("grid_track_fractions_still_valid", () => {
  const style = { columns: ["0fr", "2fr", "12fr", "0.5fr"], rows: { base: ["1fr"], "bp.sm": ["2fr"] } };
  const result = renderElements({ kind: "grid", props: {}, style }, options);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(validator.validateTree(result.value).ok).toBe(true);
    expect(validateSchema(result.value)).toBe(true);
  }
  expect(styleDeclarations(style, catalog).style.gridTemplateColumns).toBe(
    "minmax(0, 0fr) minmax(0, 2fr) minmax(0, 12fr) minmax(0, 0.5fr)",
  );
  expect(validateSchema(tree({ width: "size.fr" }))).toBe(true);
  const withFractionToken = {
    ...catalog,
    vocabulary: { ...catalog.vocabulary, size: [...catalog.vocabulary.size, "size.fr"] },
  };
  expect(styleDeclarations({ width: "size.fr", columns: ["size.fr", "0.5fr"] }, withFractionToken).style).toMatchObject(
    {
      width: "var(--lf-v-size_fr)",
      gridTemplateColumns: "var(--lf-v-size_fr) minmax(0, 0.5fr)",
    },
  );
  for (const value of ["space.0", "size.rail", "fill", "fit", "0ch", "100ch", "50.5%", "100%"])
    for (const prop of dimensions) {
      expect(validator.validateTree(tree({ [prop]: value })).ok).toBe(true);
      expect(validateSchema(tree({ [prop]: value }))).toBe(true);
    }
});
