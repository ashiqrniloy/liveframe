// Fixtures regenerate with: timeout 30s bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof
import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  type Catalog,
  type Capabilities,
  type DesignSystem,
  type LiveframeError,
  type Theme,
  type UiNode,
  compileValidator,
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
  const ajv = new Ajv2020({ strict: true, multipleOfPrecision: 8 });
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

test("icon_accepts_tone", async () => {
  const manifest = await read("agent-home.manifest");
  const { checkNode } = compileValidator({ catalog, capabilities, manifest });
  const check = (style: Record<string, unknown>) => {
    const errors: LiveframeError[] = [];
    const node = { id: "root/glyph", kind: "icon", props: { name: "mk-dashed" }, style };
    return { ok: checkNode(node, "/root", { errors, maxErrors: 20 }), errors };
  };
  expect(catalog.vocabulary.tones).toHaveProperty("warning");
  expect(check({ tone: "warning" }).ok).toBe(true);
  // A tone is a declared name; a literal colour never validates.
  expect(check({ tone: "#ff0000" }).ok).toBe(false);
  // The proof widgets pass it: every marker and kicker glyph in the benchmark tree takes a tone.
  const tree = await read("agent-home.tree");
  const icons: UiNode[] = [];
  (function visit(node: UiNode) {
    if (node.kind === "icon") icons.push(node);
    for (const child of node.children ?? []) visit(child);
  })(tree.root);
  expect(icons.length).toBeGreaterThan(0);
  expect(icons.filter((icon) => !icon.style?.tone)).toEqual([]);
});

test("tab_count_is_a_prop_with_its_own_slot", async () => {
  const tab = catalog.definitions.find((d) => d.kind === "tab");
  expect(tab?.slots).toEqual(["root", "label", "count", "panel"]);
  const { checkNode } = compileValidator({ catalog, capabilities, manifest: await read("agent-home.manifest") });
  const tabs = (props: Record<string, unknown>) => {
    const errors: LiveframeError[] = [];
    const node = { id: "root/tab", kind: "tab", props, children: [] };
    return checkNode(node, "/root", { errors, maxErrors: 20 });
  };
  expect(tabs({ label: "All", count: "12", value: "all" })).toBe(true);
  expect(tabs({ label: "All", value: "all" })).toBe(true);
  expect(tabs({ label: "All", count: 12, value: "all" })).toBe(false);
});

test("proof_recipes_round_trip", async () => {
  for (const name of ["certified", "rack"]) {
    const ds: DesignSystem = await read(`${name}.design-system`);
    const table = resolveRecipes(ds, { catalog, registry: {} });
    expect(table).toEqual(await read(`${name}.resolved-recipes`));
    expect(Object.keys(table)).toHaveLength(624);
    expect(table["button.default.root.rest"]?.transitionTiming).toEqual([0.16, 1, 0.3, 1]);
    expect(table["button.default.root.active"]?.translateY).toEqual({ value: 1, unit: "px" });
  }
});

test("proof_vocabulary_has_no_alpha_roles", async () => {
  expect(catalog.vocabulary.colourRoles.some((role) => role.includes(".alpha-"))).toBe(false);
  for (const name of ["certified", "rack"]) {
    const theme: Theme = await read(`${name}.theme`);
    const ds: DesignSystem = await read(`${name}.design-system`);
    const table = resolveRecipes(ds, { catalog, registry: {} });
    let count = 0;
    for (const recipe of Object.values(table)) {
      if (!recipe) continue;
      const layers = Array.isArray(recipe.shadow) ? recipe.shadow : recipe.shadow ? [recipe.shadow] : [];
      for (const layer of layers) {
        expect(typeof layer.color).toBe("object");
        if (typeof layer.color === "object") {
          expect(theme.colours[layer.color.role]).toBeDefined();
          expect(typeof layer.color.alpha).toBe("number");
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(0);
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
  const validate = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("ui-tree"));
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
