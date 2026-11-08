/** @jsxImportSource @arnilo/liveframe/sdk */
import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import referenceCatalog from "../../conformance/corpus/common/reference-catalog.json" with { type: "json" };
import {
  classifyCatalogChange,
  compileValidator,
  type Definition,
  type NodeRef,
  validateCapabilities,
  validateCatalog,
} from "../index.ts";
import { pack, verifyPackage } from "../pack/index.ts";
import { type Elements, ephemeralManifest } from "../sdk/elements.ts";
import { generate, generateElementsSchema } from "../sdk/gen.ts";
import { jsx, primitive, ref, render, renderElements } from "../sdk/index.ts";
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import { Text as GeneratedText } from "./fixtures/widgets/references.gen.ts";

const referenceSource = await Bun.file(new URL("./fixtures/widgets/references.gen.ts", import.meta.url)).text();

const catalog = {
  ...catalogDocument,
  definitions: catalogDocument.definitions.map((d) =>
    d.kind === "text"
      ? {
          ...d,
          refProps: ["describedBy"],
          props: {
            ...d.props,
            properties: { ...d.props.properties, describedBy: { type: "string", maxLength: 1024 } },
          },
        }
      : d,
  ),
};
const manifest = ephemeralManifest({ catalogId: catalog.catalogId, actions: [] });
const options = () => ({
  validator: compileValidator({ catalog, capabilities, manifest }),
  surfaceId: "refs",
  revision: 0,
});
const Text = primitive<{ text: string; describedBy?: NodeRef }>("text");
const Stack = primitive<{ children?: unknown; gap?: unknown }>("stack");
const inputs = { params: {}, state: {}, data: {}, context: {} };
const target = () => <Text $anchor="hint" text="Hint" />;
const widget = () => (
  <Stack gap={{ base: "space.1", "bp.sm": "space.2" }}>
    <Text text="Field" describedBy={ref("hint")} />
    {jsx(target, {}, "nested")}
  </Stack>
);

function tree() {
  const result = render(widget, inputs, options());
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

test("ref_resolves_to_target_key_path", () => {
  expect(Object.isFrozen(ref("hint"))).toBe(true);
  expect(tree().root.children?.[0]?.props.describedBy).toBe("root/nested");
  expect(options().validator.validateTree(tree()).ok).toBe(true);
});

test("dangling_ref_not_found", () => {
  const result = render(() => <Text text="x" describedBy={ref("missing")} />, inputs, options());
  expect(result).toMatchObject({
    ok: false,
    errors: [{ kind: "not-found", pointer: "/root/props/describedBy", expected: expect.stringContaining("missing") }],
  });
});

test("duplicate_anchor_duplicate_key", () => {
  const result = render(
    () => (
      <Stack>
        <Text text="a" $anchor="hint" />
        <Text key="b" text="b" $anchor="hint" />
      </Stack>
    ),
    inputs,
    options(),
  );
  expect(result).toMatchObject({
    ok: false,
    errors: [{ kind: "duplicate-key", pointer: "/root/b/$anchor", expected: "a tree-unique anchor" }],
  });
});

test("refProps_must_name_string_props", () => {
  for (const name of ["missing", "level", "not/a/prop"]) {
    const bad = {
      ...catalog,
      definitions: catalog.definitions.map((d) => (d.kind === "heading" ? { ...d, refProps: [name] } : d)),
    };
    expect(validateCatalog(bad)).toMatchObject({
      ok: false,
      errors: [{ kind: "unknown-name", pointer: expect.stringContaining("/refProps/0") }],
    });
  }
  const bad = { ...catalog, definitions: catalog.definitions.map((d) => ({ ...d, refProps: Array(9).fill("text") })) };
  expect(validateCatalog(bad).ok).toBe(false);
});

test("validateTree_rejects_ref_to_missing_id", () => {
  const value = tree();
  const field = value.root.children?.[0];
  if (!field) throw new Error("Missing field");
  const bad = {
    ...value,
    root: { ...value.root, children: [{ ...field, props: { ...field.props, describedBy: "root/missing" } }] },
  };
  expect(options().validator.validateTree(bad)).toMatchObject({
    ok: false,
    errors: [{ kind: "not-found", nodeId: field.id, pointer: "/root/children/0/props/describedBy" }],
  });
});

test("element_markers_and_source_pointers", () => {
  const input = {
    kind: "stack",
    children: [
      { kind: "text", props: { text: "Field", describedBy: { $ref: "hint" } } },
      { kind: "text", key: "hint", $anchor: "hint", props: { text: "Hint" } },
    ],
  };
  const result = renderElements(input, options());
  expect(result).toMatchObject({
    ok: true,
    value: { root: { children: [{ props: { describedBy: "root/hint" } }, {}] } },
  });
  input.children.pop();
  expect(renderElements(input, options())).toMatchObject({
    ok: false,
    errors: [{ kind: "not-found", pointer: "/children/0/props/describedBy" }],
  });
});

test("reference_bytes_budget_is_exact", () => {
  const value = tree();
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  expect(render(widget, inputs, { ...options(), limits: { bytes } }).ok).toBe(true);
  expect(render(widget, inputs, { ...options(), limits: { bytes: bytes - 1 } })).toMatchObject({
    ok: false,
    errors: [{ kind: "limit-exceeded" }],
  });
});

test("generated_type_requires_NodeRef", () => {
  const installed = validateCatalog(catalog);
  if (!installed.ok) throw new Error(JSON.stringify(installed.errors));
  const referenceInstalled = validateCatalog(referenceCatalog);
  if (!referenceInstalled.ok) throw new Error(JSON.stringify(referenceInstalled.errors));
  expect(generate(referenceInstalled.value)).toBe(referenceSource);
  const generated = <GeneratedText text="Field" describedBy={ref("hint")} $anchor="field" />;
  // @ts-expect-error generated props require a NodeRef marker
  const invalidGenerated = <GeneratedText text="Field" describedBy="hint" />;
  expect([generated, invalidGenerated]).toHaveLength(2);
  expect(generate(installed.value)).toContain("readonly describedBy?: _NodeRef;");
  const validate = new Ajv2020({ strict: true }).compile(JSON.parse(generateElementsSchema(installed.value)));
  expect(validate({ kind: "text", $anchor: "field", props: { text: "Field", describedBy: { $ref: "hint" } } })).toBe(
    true,
  );
  expect(validate({ kind: "text", props: { text: "Field", describedBy: "root/hint" } })).toBe(false);
  // @ts-expect-error authoring references require markers
  const invalid: NodeRef = "hint";
  expect(invalid as unknown).toBe("hint");
  const valid: NodeRef = ref("hint");
  expect(valid).toEqual({ $ref: "hint" });
  type RefCatalog = {
    readonly definitions: readonly [
      {
        readonly kind: "text";
        readonly variants: readonly [];
        readonly props: {
          readonly type: "object";
          readonly properties: { readonly describedBy: { readonly type: "string"; readonly maxLength: 100 } };
          readonly required: readonly ["describedBy"];
          readonly additionalProperties: false;
        };
        readonly refProps: readonly ["describedBy"];
        readonly events: Record<never, never>;
      } & Omit<Definition, "kind" | "variants" | "props" | "refProps" | "events">,
    ];
  } & Omit<typeof installed.value, "definitions">;
  const element: Elements<RefCatalog> = { kind: "text", props: { describedBy: ref("hint") } };
  expect(element.props).toEqual({ describedBy: { $ref: "hint" } });
  // @ts-expect-error element JSON reference props require markers
  const invalidElement: Elements<RefCatalog> = { kind: "text", props: { describedBy: "hint" } };
  expect(invalidElement as unknown).toEqual({ kind: "text", props: { describedBy: "hint" } });
});

test("references_preserve_schema_checks_and_error_bounds", () => {
  const short = {
    ...catalog,
    definitions: catalog.definitions.map((d) =>
      d.kind === "text"
        ? {
            ...d,
            props: {
              ...d.props,
              properties: { ...d.props.properties, describedBy: { type: "string", maxLength: 1, minLength: 1 } },
            },
          }
        : d,
    ),
  };
  const result = render(widget, inputs, {
    ...options(),
    validator: compileValidator({ catalog: short, capabilities, manifest }),
  });
  expect(result).toMatchObject({
    ok: false,
    errors: [{ kind: "invalid-prop", pointer: "/root/text/props/describedBy" }],
  });
  const unresolved = render(() => <Text text="x" describedBy={ref("missing")} />, inputs, {
    ...options(),
    validator: compileValidator({ catalog: short, capabilities, manifest }),
  });
  expect(unresolved).toMatchObject({ ok: false, errors: [{ kind: "not-found" }] });
  for (const value of [{ $ref: 1 }, { $ref: "hint", extra: true }, 1]) {
    expect(renderElements({ kind: "text", props: { text: "x", describedBy: value } }, options())).toMatchObject({
      ok: false,
      errors: [{ kind: "invalid-prop", pointer: "/props/describedBy" }],
    });
  }
  const bad = tree();
  const missing = { ...bad, root: { ...bad.root, children: bad.root.children?.slice(0, 1) } };
  expect(options().validator.validateTree(missing, { maxErrors: 1 })).toMatchObject({
    ok: false,
    errors: [{ kind: "not-found" }, { kind: "limit-exceeded" }],
  });
  expect(render(() => <Text text="x" />, inputs, options()).ok).toBe(true);
});

test("reference_semantics_are_a_catalog_contract_change", () => {
  const installed = validateCatalog(catalog);
  const before = validateCatalog(catalogDocument);
  if (!installed.ok || !before.ok) throw new Error("Invalid fixture");
  expect(classifyCatalogChange(before.value, installed.value).level).toBe("major");
  expect(classifyCatalogChange(installed.value, before.value).level).toBe("major");
});

test("marker_and_anchor_bytes_never_enter_the_wire_budget", () => {
  const anchor = "hint-🙂".repeat(512);
  const self = () => <Text $anchor={anchor} text="Self" describedBy={ref(anchor)} />;
  const result = render(self, inputs, options());
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(result.value.root.props.describedBy).toBe("root");
  const bytes = new TextEncoder().encode(JSON.stringify(result.value)).length;
  expect(render(self, inputs, { ...options(), limits: { bytes } }).ok).toBe(true);
});

test("generated_reference_types_pack_as_sdk_only_runtime_code", () => {
  const installed = validateCatalog(catalog);
  const installedCapabilities = validateCapabilities(capabilities);
  if (!installed.ok || !installedCapabilities.ok) throw new Error("Invalid installation");
  const packed = pack(
    {
      entry: "widget.tsx",
      files: {
        "ui.gen.ts": generate(installed.value),
        "widget.tsx":
          'import { ref } from "@arnilo/liveframe/sdk"; import { Text } from "./ui.gen.ts"; export default () => <Text text="Self" $anchor="self" describedBy={ref("self")} />;',
      },
      manifest,
      scenarios: [{ name: "references", ...inputs }],
    },
    { catalog: installed.value, capabilities: installedCapabilities.value },
  );
  if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
  expect(verifyPackage(packed.value, { catalog: installed.value, capabilities: installedCapabilities.value }).ok).toBe(
    true,
  );
});
