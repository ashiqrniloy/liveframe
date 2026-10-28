// Fixtures regenerate with: timeout 30s bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof
import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  type Catalog,
  type Capabilities,
  type DesignSystem,
  type Theme,
  type UiNode,
  resolveRecipes,
  validateCatalog,
  validateVocabulary,
  validateCapabilities,
  validateManifest,
  validateTheme,
  validateDesignSystem,
} from "../index.ts";
import { schemaDocument } from "../formats/registry.ts";

const read = (name: string) => Bun.file(new URL(`./fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const capabilities: Capabilities = await read("capabilities");
const treeNames = [
  "agent-home",
  "core-queue.small",
  "core-queue.medium",
  "core-queue.large",
  "core-queue.full",
  "git-status",
  "rack-module",
];

test("proof_formats_validate", async () => {
  expect(validateVocabulary(await read("vocabulary"))).toEqual({ ok: true, value: catalog.vocabulary });
  expect(validateCatalog(catalog).ok).toBe(true);
  expect(catalog.definitions).toHaveLength(24);
  expect(catalog.definitions.find((d) => d.kind === "textField")?.events).toHaveProperty("onCommit");
  expect(catalog.definitions.find((d) => d.kind === "textField")?.events).not.toHaveProperty("onSubmit");
  expect(validateCapabilities(capabilities).ok).toBe(true);
  expect(validateManifest(await read("agent-home.manifest"), { catalog, capabilities }).ok).toBe(true);
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat("regex", {
    type: "string",
    validate: (pattern: string) => {
      try {
        new RegExp(pattern, "u");
        return true;
      } catch {
        return false;
      }
    },
  });
  const themeSchema = ajv.compile(schemaDocument("theme"));
  const designSystemSchema = ajv.compile(schemaDocument("design-system"));
  for (const name of ["certified", "rack"]) {
    const theme: Theme = await read(`${name}.theme`);
    const ds: DesignSystem = await read(`${name}.design-system`);
    expect(validateTheme(theme, catalog.vocabulary).ok).toBe(true);
    expect(validateDesignSystem(ds, { catalog, registry: {} }).ok).toBe(true);
    expect(themeSchema(theme)).toBe(true);
    expect(designSystemSchema(ds)).toBe(true);
  }
  expect(ajv.compile(schemaDocument("catalog"))(catalog)).toBe(true);
  expect(ajv.compile(schemaDocument("capabilities"))(capabilities)).toBe(true);
  expect(ajv.compile(schemaDocument("manifest"))(await read("agent-home.manifest"))).toBe(true);
});

test("proof_recipes_round_trip", async () => {
  for (const name of ["certified", "rack"]) {
    const ds: DesignSystem = await read(`${name}.design-system`);
    const table = resolveRecipes(ds, { catalog, registry: {} });
    expect(table).toEqual(await read(`${name}.resolved-recipes`));
    expect(Object.keys(table)).toHaveLength(616);
    expect(table["button.default.root.rest"]?.transitionTiming).toEqual([0.16, 1, 0.3, 1]);
    expect(table["button.default.root.active"]?.translateY).toEqual({ value: 1, unit: "px" });
  }
});

test("shadow_alpha_preserves_the_theme_colour", async () => {
  for (const name of ["certified", "rack"]) {
    const theme: Theme = await read(`${name}.theme`);
    for (const role of catalog.vocabulary.colourRoles) {
      const match = /^(.*)\.alpha-(\d+(?:-\d+)?)$/.exec(role);
      if (!match) continue;
      const base = theme.colours[match[1] ?? ""];
      const alpha = theme.colours[role];
      if (!base) throw new Error(`Missing base colour for ${role}`);
      expect(alpha).toEqual({ ...base, alpha: (base.alpha ?? 1) * Number(match[2]?.replace("-", ".")) });
    }
  }
});

test("no_colour_literals_outside_themes", async () => {
  expect(catalog.vocabulary.colourRoles).not.toContain("colour.transparent");
  for (const name of ["certified", "rack"]) {
    expect((await read(`${name}.theme`)).colours).not.toHaveProperty("colour.transparent");
    expect(JSON.stringify(await read(`${name}.design-system`))).not.toContain("colour.transparent");
  }
  for (const name of ["catalog", "certified.design-system", "rack.design-system"]) {
    const json = JSON.stringify(await read(name));
    expect(json).not.toMatch(/"colorSpace"|#[0-9a-f]{3,8}\b|(?:oklch|oklab|rgb|hsl|color-mix)\(/i);
  }
});

test("proof_trees_match_benchmark_shapes_and_catalog", async () => {
  const validate = new Ajv2020({ strict: true }).compile(schemaDocument("ui-tree"));
  for (const name of treeNames) {
    const tree = await read(`${name}.tree`);
    expect(validate(tree)).toBe(true);
    expect(tree.catalogId).toBe(catalog.catalogId);
    const nodes: UiNode[] = [];
    function visit(node: UiNode) {
      nodes.push(node);
      const definition = catalog.definitions.find((d) => d.kind === node.kind);
      expect(definition).toBeDefined();
      for (const event of Object.keys(node.events ?? {})) expect(definition?.events).toHaveProperty(event);
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree.root);
    if (name === "agent-home") expect(nodes).toHaveLength(679);
    if (name === "git-status") expect(nodes.filter((n) => n.kind === "text")).toHaveLength(52);
  }
});
