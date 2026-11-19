// Element JSON with `when`, `bind` and local intents (spec §7.2, §8; plan 039 Task 2).
import { expect, test } from "bun:test";
import { type Elements, ephemeralManifest, renderElements, streamElements } from "@arnilo/liveframe/sdk";
import { createSurfaceCore, type NodeContext } from "@arnilo/liveframe/surface";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Catalog } from "../formats/catalog.ts";
import { defineComponent, validateCatalog } from "../formats/catalog.ts";
import type { UiTree } from "../formats/tree.ts";
import { compileValidator } from "../index.ts";
import { bool, int, obj, str } from "../schema.ts";
import { generateElementsSchema } from "../sdk/gen.ts";
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogJson from "./fixtures/proof/catalog.json" with { type: "json" };

const installed = validateCatalog(catalogJson);
if (!installed.ok) throw new Error(JSON.stringify(installed.errors));
const catalog = installed.value;
const local = obj({ q: str({ maxLength: 80 }), expanded: bool() });
const withLocal = compileValidator({
  catalog,
  capabilities,
  manifest: ephemeralManifest({
    catalogId: catalog.catalogId,
    actions: ["tasks.claim"],
    local,
    initialLocal: { q: "", expanded: false },
  }),
});
const withoutLocal = compileValidator({
  catalog,
  capabilities,
  manifest: ephemeralManifest({ catalogId: catalog.catalogId, actions: ["tasks.claim"] }),
});
const options = { validator: withLocal, surfaceId: "agent", revision: 0 };

const field = {
  kind: "textField",
  key: "filter",
  props: { label: "Filter", value: "" },
  bind: { value: { $path: "local.q" } },
  events: { onChange: { type: "setLocal", key: "q" } },
} as const;
const row = (key: string, text: string) => ({
  kind: "text",
  key,
  props: { text },
  when: { $contains: [{ $path: "self.text" }, { $path: "local.q" }] },
});
const filterDocument = {
  kind: "stack",
  children: [
    field,
    row("report", "Write the report"),
    row("plan", "Review the plan"),
    { kind: "text", key: "empty", props: { text: "Nothing matches" }, when: { $eq: [{ $path: "shown" }, 0] } },
  ],
};

function errorsOf(result: ReturnType<typeof renderElements>) {
  if (result.ok) throw new Error("Expected errors");
  return result.errors;
}

test("element_json_live_filter_hides_rows_without_a_round_trip", () => {
  const rendered = renderElements(filterDocument, options);
  if (!rendered.ok) throw new Error(JSON.stringify(rendered.errors));
  const intents: unknown[] = [];
  const core = createSurfaceCore({ catalog, validator: withLocal, onIntent: (intent) => void intents.push(intent) });
  expect(core.accept(rendered.value).ok).toBe(true);
  const ids = (context: NodeContext | undefined) => (context?.items ?? []).map((item) => item.id);
  expect(ids(core.snapshot().root)).toEqual(["root/filter", "root/report", "root/plan"]);
  core.snapshot().root?.items[0]?.emit("onChange", "plan");
  expect(ids(core.snapshot().root)).toEqual(["root/filter", "root/plan"]);
  core.snapshot().root?.items[0]?.emit("onChange", "nothing");
  expect(ids(core.snapshot().root)).toEqual(["root/filter", "root/empty"]);
  expect(core.snapshot().local).toEqual({ q: "nothing", expanded: false });
  expect(intents).toEqual([]);
});

test("element_json_cannot_declare_local", () => {
  for (const name of ["local", "initialLocal", "state", "manifest"])
    expect(errorsOf(renderElements({ kind: "text", props: { text: "x" }, [name]: {} }, options))).toEqual([
      expect.objectContaining({ kind: "invalid-prop", pointer: `/${name}`, expected: "no such element field" }),
    ]);
  // A section cannot smuggle a node field in as a prop.
  expect(errorsOf(renderElements({ kind: "text", props: { text: "x", when: true } }, options))).toEqual([
    expect.objectContaining({ kind: "invalid-prop", pointer: "/props/when" }),
  ]);
  expect(
    errorsOf(renderElements({ kind: "button", props: { label: "x" }, events: { bind: { $path: "x" } } }, options)),
  ).toEqual([expect.objectContaining({ kind: "invalid-prop", pointer: "/events/bind" })]);
});

test("expression_reading_an_undeclared_local_key_is_unknown_name", () => {
  const doc = {
    kind: "stack",
    children: [{ kind: "text", props: { text: "x" }, when: { $eq: [{ $path: "local.missing" }, ""] } }],
  };
  expect(errorsOf(renderElements(doc, options))).toEqual([
    expect.objectContaining({ kind: "unknown-name", pointer: "/children/0/when/$eq/0/$path", nodeId: "root/text" }),
  ]);
});

test("element_json_without_local_reads_self_only", () => {
  const selfOnly = {
    kind: "stack",
    children: [
      { kind: "text", key: "a", props: { text: "a" }, when: { $ne: [{ $path: "self.text" }, ""] } },
      { kind: "text", key: "none", props: { text: "-" }, when: { $eq: [{ $path: "shown" }, 0] } },
    ],
  };
  expect(renderElements(selfOnly, { ...options, validator: withoutLocal }).ok).toBe(true);
  const kinds = errorsOf(renderElements(filterDocument, { ...options, validator: withoutLocal })).map(
    ({ kind, pointer }) => [kind, pointer],
  );
  expect(kinds).toContainEqual(["unknown-name", "/children/0/events/onChange/key"]);
  expect(kinds).toContainEqual(["unknown-name", "/children/0/bind/value/$path"]);
  expect(kinds).toContainEqual(["unknown-name", "/children/1/when/$contains/1/$path"]);
});

test("ephemeral_manifest_requires_initial_local_with_local", () => {
  const catalogId = catalog.catalogId;
  expect(() => ephemeralManifest({ catalogId, actions: [], local })).toThrow("together");
  expect(() => ephemeralManifest({ catalogId, actions: [], initialLocal: {} })).toThrow("together");
  expect(() => ephemeralManifest({ catalogId, actions: [], local, initialLocal: { q: "" } })).toThrow(
    "initialLocal to fit local",
  );
  expect(() => ephemeralManifest({ catalogId, actions: [], local, initialLocal: [] as never })).toThrow(
    "initialLocal object",
  );
  // A `local` outside the local rules is the manifest check's: `invalid-document` under `/local`.
  const wide = ephemeralManifest({
    catalogId,
    actions: [],
    local: obj({ text: str({ maxLength: 10_000 }) }),
    initialLocal: { text: "" },
  });
  expect(() => compileValidator({ catalog, capabilities, manifest: wide })).toThrow("/local/properties/text");
  const manifest = ephemeralManifest({ catalogId, actions: [], local, initialLocal: { q: "", expanded: true } });
  expect(manifest.local).toBe(local);
  expect(manifest.initialLocal).toEqual({ q: "", expanded: true });
  expect("local" in ephemeralManifest({ catalogId, actions: [] })).toBe(false);
});

function streamed(doc: unknown, validator = withLocal) {
  const stream = streamElements({ validator, surfaceId: "agent" });
  const text = JSON.stringify(doc);
  const trees: UiTree[] = [];
  for (let at = 0; at < text.length; at += 7) {
    const result = stream.push(text.slice(at, at + 7));
    if (result?.ok) trees.push(result.value);
  }
  return { trees, final: stream.end() };
}

test("stream_draws_a_bound_shell_with_its_expressions", () => {
  const doc = {
    kind: "stack",
    when: { $ne: [{ $path: "local.q" }, "hidden"] },
    children: filterDocument.children,
  };
  const { trees, final } = streamed(doc);
  if (!final.ok) throw new Error(JSON.stringify(final.errors));
  expect(final as unknown).toEqual(renderElements(doc, { ...options, revision: final.value.revision }));
  // The open shell is drawn with its `when` as soon as its first row is in, long before it closes.
  expect(trees.map((tree) => tree.root.children?.length)).toEqual([1, 2, 3, 4]);
  for (const tree of trees) expect(tree.root.when).toEqual(doc.when);
  expect(trees[0]?.root.children?.[0]?.bind).toEqual(field.bind);
  for (const tree of trees) expect(withLocal.validateTree(tree).ok).toBe(true);
});

test("stream_enforces_the_tree_expression_bound", () => {
  // 61 expression nodes a row, under the per-expression 64, so 170 rows pass 10,000 for the tree.
  const when = { $and: Array.from({ length: 20 }, () => ({ $eq: [{ $path: "local.q" }, ""] })) };
  const doc = {
    kind: "stack",
    children: Array.from({ length: 170 }, (_, i) => ({ kind: "text", key: i, props: { text: "x" }, when })),
  };
  const whole = renderElements(doc, options);
  expect(errorsOf(whole)).toContainEqual(
    expect.objectContaining({ kind: "limit-exceeded", pointer: "/children/163/when" }),
  );
  const { trees, final } = streamed(doc);
  expect(final.ok).toBe(false);
  if (!final.ok && !whole.ok) expect(final.errors).toEqual(whole.errors);
  // Every drawn tree is within the bound: the stream counts one total across the document.
  expect(trees.length).toBeGreaterThan(0);
  for (const tree of trees) {
    expect(tree.root.children?.length ?? 0).toBeLessThanOrEqual(163);
    expect(withLocal.validateTree(tree).ok).toBe(true);
  }
});

test("element_json_accepts_from_local_and_compound_local_writes", () => {
  const doc = {
    kind: "stack",
    children: [
      field,
      {
        kind: "button",
        key: "claim",
        props: { label: "Claim" },
        events: {
          onPress: {
            type: "action",
            name: "tasks.claim",
            args: {},
            fromLocal: { id: "q" },
            local: [
              { key: "expanded", value: true, until: "revision" },
              { key: "q", value: "" },
            ],
          },
        },
      },
      {
        kind: "switch",
        key: "more",
        props: { label: "More", checked: false },
        bind: { checked: { $path: "local.expanded" } },
        events: { onChange: { type: "setLocal", key: "expanded" } },
      },
    ],
  };
  const result = renderElements(doc, options);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(result.value.root.children?.[1]?.events?.onPress).toEqual(
    (doc.children[1] as (typeof doc.children)[1] & { events: { onPress: never } }).events.onPress,
  );
  const misread = structuredClone(doc) as { children: { events?: { onPress?: { fromLocal?: object } } }[] };
  (misread.children[1]?.events?.onPress as { fromLocal: object }).fromLocal = { id: "missing" };
  expect(errorsOf(renderElements(misread, options))).toContainEqual(
    expect.objectContaining({ kind: "unknown-name", pointer: "/children/1/events/onPress/fromLocal/id" }),
  );
});

const referring = {
  format: "liveframe-catalog/1",
  catalogId: "test.bindings@1",
  description: "Binding type fixture.",
  vocabulary: {
    colourRoles: ["text.primary", "surface.base"],
    surfaceRoles: ["surface.base"],
    fillableRoles: [],
    typographyRoles: ["body"],
    space: ["space.1"],
    radius: ["radius.control"],
    size: ["size.glyph"],
    breakpoints: ["bp.sm"],
    tones: { default: "text.primary" },
    surfaceTypography: "body",
  },
  definitions: [
    defineComponent({
      kind: "field",
      description: "A field.",
      props: obj({ label: str({ maxLength: 80 }), count: int() }),
      children: "none",
      variants: ["default"],
      defaultVariant: "default",
      slots: ["root"],
      events: { onChange: { carries: "string", description: "The text changed." } },
      styleProps: [],
      a11y: { role: "textbox" },
    }),
    defineComponent({
      kind: "hint",
      description: "Describes another node.",
      props: obj({ text: str({ maxLength: 80 }), target: str({ maxLength: 128 }) }),
      refProps: ["target"],
      children: "none",
      variants: ["default"],
      defaultVariant: "default",
      slots: ["root"],
      events: {},
      styleProps: [],
      a11y: { role: "paragraph" },
    }),
  ],
} as const satisfies Catalog;

test("elements_type_accepts_set_local_and_rejects_binding_a_ref_prop", () => {
  const ok = {
    kind: "field",
    props: { label: "Find", count: 0 },
    when: { $ne: [{ $path: "local.q" }, ""] },
    bind: { label: { $path: "local.q" } },
    events: { onChange: { type: "setLocal", key: "q" } },
  } satisfies Elements<typeof referring>;
  const hint = {
    kind: "hint",
    props: { text: "x", target: { $ref: "a" } },
    bind: { text: { $path: "local.q" } },
  } satisfies Elements<typeof referring>;
  // @ts-expect-error a reference prop is never bound
  const boundRef = { kind: "hint", props: { text: "x", target: "a" }, bind: { target: "a" } } satisfies Elements<
    typeof referring
  >;
  // @ts-expect-error only the kind's props are bound
  const unknownProp = { kind: "field", props: { label: "x", count: 0 }, bind: { other: 1 } } satisfies Elements<
    typeof referring
  >;
  const checked = validateCatalog(referring);
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  const schema = JSON.parse(generateElementsSchema(checked.value, { local: obj({ q: str({ maxLength: 8 }) }) }));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  expect([ok, hint].map((doc) => validate(doc))).toEqual([true, true]);
  expect([boundRef, unknownProp].map((doc) => validate(doc))).toEqual([false, false]);
});

test("elements_schema_without_local_is_unchanged", async () => {
  // Generating without `local` must not move a byte of the stored, drift-checked schema.
  const stored = await Bun.file("src/__tests__/fixtures/widgets/elements.schema.json").text();
  expect(generateElementsSchema(catalog)).toBe(stored);
  expect(generateElementsSchema(catalog, {})).toBe(stored);
  expect(stored).not.toContain('"when"');
});

test("generated_schema_accepts_the_valid_corpus_and_rejects_the_invalid", async () => {
  const corpus = "conformance/corpus/elements";
  const localManifest = await Bun.file("conformance/corpus/common/local-manifest.json").json();
  const schema = generateElementsSchema(catalog, { local: localManifest.local });
  expect(generateElementsSchema(catalog, { local: localManifest.local })).toBe(schema);
  const validate = new Ajv2020({ strict: true }).compile(JSON.parse(schema));
  const read = async (name: string) => Bun.file(`${corpus}/docs/${name}.json`).json();
  expect(validate(await read("expressions-valid"))).toBe(true);
  expect(validate(await read("valid"))).toBe(true);
  expect(validate(filterDocument)).toBe(true);
  // Types are the validator's: the schema cannot see that `local.q` is a string bound to a boolean.
  expect(validate(await read("bind-type-mismatch"))).toBe(true);
  for (const name of ["local-field", "when-unknown-local", "when-in-props", "unknown-component"])
    expect([name, validate(await read(name))]).toEqual([name, false]);
});
