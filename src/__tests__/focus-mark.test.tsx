/** @jsxImportSource @arnilo/liveframe/sdk */
// The tree's focus mark (spec §9, §11): validation on arrival and in `render()`, element JSON, templates,
// streams, patches and the surface core's snapshot. The focus move itself is covered in `react-browser.test.tsx`.
import { expect, test } from "bun:test";
import { primitive, render, renderElements, streamElements, type WidgetInputs } from "@arnilo/liveframe/sdk";
import {
  applyPatch,
  compileValidator,
  diffTrees,
  type LiveframeError,
  type UiTree,
  validateCapabilities,
  validateCatalog,
  validateManifest,
  validateTreePatch,
} from "../index.ts";
import { createSurfaceCore } from "../surface/index.ts";
import { renderTemplate, type Template, type TemplateNode, validateTemplate } from "../template/index.ts";
import capabilitiesDocument from "../../conformance/corpus/common/capabilities.json" with { type: "json" };
import manifestDocument from "../../conformance/corpus/common/local-manifest.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };

const catalog = validateCatalog(catalogDocument);
const capabilities = validateCapabilities(capabilitiesDocument);
if (!catalog.ok || !capabilities.ok) throw new Error("Invalid fixtures");
const manifest = validateManifest(manifestDocument, { catalog: catalog.value, capabilities: capabilities.value });
if (!manifest.ok) throw new Error(JSON.stringify(manifest.errors));
const validator = compileValidator({
  catalog: catalogDocument,
  capabilities: capabilitiesDocument,
  manifest: manifestDocument,
});
const options = { validator, surfaceId: "focus", revision: 1 };
const inputs: WidgetInputs = {
  params: { canAct: true, canEscalate: false, canViewAlerts: true },
  state: manifestDocument.initialState,
  data: {},
  context: { size: "small" },
};
const gate = { $path: "local.expanded" };

// Generated primitives carry `when` and `focus`; these hand-written ones declare them the same way.
type Marks = { readonly when?: unknown; readonly focus?: boolean };
const Stack = primitive<Marks & { readonly children?: unknown }>("stack");
const Text = primitive<Marks & { readonly text: string }>("text");
const Button = primitive<Marks & { readonly label: string }>("button");

function tree(focus?: unknown, hidden = false): unknown {
  return {
    format: "liveframe/1",
    catalogId: "proof.ui@1",
    surfaceId: "focus",
    revision: 1,
    ...(focus === undefined ? {} : { focus }),
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: [
        { id: "root/a", kind: "button", props: { label: "A" } },
        {
          id: "root/box",
          kind: "stack",
          props: {},
          ...(hidden ? { when: gate } : {}),
          children: [{ id: "root/box/b", kind: "button", props: { label: "B" } }],
        },
      ],
    },
  };
}
const value = <T,>(result: { ok: true; value: T } | { ok: false; errors: readonly LiveframeError[] }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
};
const failure = (result: { ok: boolean; errors?: readonly LiveframeError[] }) => {
  expect(result.ok).toBe(false);
  return (result.errors ?? []).map(({ kind, pointer }) => ({ kind, pointer }));
};

test("focus_mark_to_a_missing_or_gated_node_is_rejected", () => {
  expect(value(validator.validateTree(tree("root/box/b"))).focus).toBe("root/box/b");
  expect(failure(validator.validateTree(tree("root/missing")))).toEqual([{ kind: "not-found", pointer: "/focus" }]);
  // The node itself, or one under a gated ancestor: a hidden node has no element to focus.
  expect(failure(validator.validateTree(tree("root/box", true)))).toEqual([
    { kind: "invalid-prop", pointer: "/focus" },
  ]);
  expect(failure(validator.validateTree(tree("root/box/b", true)))).toEqual([
    { kind: "invalid-prop", pointer: "/focus" },
  ]);
  for (const malformed of [3, "", "a/b", "root/", null])
    expect(failure(validator.validateTree(tree(malformed)))).toEqual([{ kind: "invalid-prop", pointer: "/focus" }]);
});

test("focus_mark_counts_toward_the_byte_budget", () => {
  const marked = tree("root/box/b");
  const bytes = new TextEncoder().encode(JSON.stringify(marked)).length;
  expect(validator.validateTree(marked, { limits: { bytes } }).ok).toBe(true);
  expect(failure(validator.validateTree(marked, { limits: { bytes: bytes - 1 } }))[0]?.kind).toBe("limit-exceeded");
  // `render()` counts the same bytes the validator does.
  const widget = () => (
    <Stack>
      <Button label="A" focus />
    </Stack>
  );
  const drawn = value(render(widget, inputs, options));
  const size = new TextEncoder().encode(JSON.stringify(drawn)).length;
  expect(render(widget, inputs, { ...options, limits: { bytes: size } }).ok).toBe(true);
  expect(failure(render(widget, inputs, { ...options, limits: { bytes: size - 1 } }))[0]?.kind).toBe("limit-exceeded");
});

test("render_sets_the_tree_mark_from_one_element", () => {
  const drawn = value(
    render(
      () => (
        <Stack>
          <Text text="Title" focus={false} />
          <Button label="Add" focus />
        </Stack>
      ),
      inputs,
      options,
    ),
  );
  expect(drawn.focus).toBe("root/button");
  // The mark is a tree field, never a prop.
  expect(JSON.stringify(drawn.root)).not.toContain("focus");
  expect(value(validator.validateTree(drawn))).toBe(drawn);
  const plain = value(render(() => <Stack />, inputs, options));
  expect(Object.hasOwn(plain, "focus")).toBe(false);
});

test("two_focus_marks_in_one_tree_is_duplicate_key", () => {
  const result = render(
    () => (
      <Stack>
        <Text text="One" focus />
        <Button label="Two" focus />
      </Stack>
    ),
    inputs,
    options,
  );
  expect(failure(result)).toEqual([{ kind: "duplicate-key", pointer: "/root/button/focus" }]);
});

test("render_rejects_a_gated_or_non_boolean_focus", () => {
  const gated = render(
    () => (
      <Stack>
        <Stack when={gate}>
          <Button label="Hidden" focus />
        </Stack>
      </Stack>
    ),
    inputs,
    options,
  );
  expect(failure(gated)).toEqual([{ kind: "invalid-prop", pointer: "/root/stack/button/focus" }]);
  const own = render(() => <Button label="Hidden" when={gate} focus />, inputs, options);
  expect(failure(own)).toEqual([{ kind: "invalid-prop", pointer: "/root/focus" }]);
  const text = render(() => <Button label="A" focus={"yes" as unknown as boolean} />, inputs, options);
  expect(failure(text)).toEqual([{ kind: "invalid-prop", pointer: "/root/focus" }]);
});

test("element_json_carries_focus_and_rejects_it_on_a_fragment", () => {
  const elements = {
    kind: "stack",
    children: [
      { kind: "button", key: "a", props: { label: "A" } },
      { kind: "button", key: "b", focus: true, props: { label: "B" } },
    ],
  };
  expect(value(renderElements(elements, options)).focus).toBe("root/b");
  const fragment = { kind: "stack", children: [{ kind: "fragment", focus: true, children: [] }] };
  expect(failure(renderElements(fragment, options))).toEqual([{ kind: "invalid-prop", pointer: "/children/0/focus" }]);
  const twice = {
    kind: "stack",
    children: [
      { kind: "button", key: "a", focus: true, props: { label: "A" } },
      { kind: "button", key: "b", focus: true, props: { label: "B" } },
    ],
  };
  expect(failure(renderElements(twice, options))).toEqual([{ kind: "duplicate-key", pointer: "/children/1/focus" }]);
});

test("streamed_trees_carry_the_mark_only_when_the_document_ends", () => {
  const text = JSON.stringify({
    kind: "stack",
    children: [
      { kind: "button", key: "a", focus: true, props: { label: "A" } },
      { kind: "button", key: "b", props: { label: "B" } },
    ],
  });
  const stream = streamElements(options);
  const partial: UiTree[] = [];
  for (let i = 0; i < text.length; i += 16) {
    const result = stream.push(text.slice(i, i + 16));
    if (result?.ok) partial.push(result.value);
  }
  expect(partial.length).toBeGreaterThan(0);
  for (const drawn of partial) expect(Object.hasOwn(drawn, "focus")).toBe(false);
  expect(value(stream.end()).focus).toBe("root/a");
});

const template = (root: TemplateNode): Template => ({ format: "liveframe-template/1", root });
const templateOptions = { catalog: catalog.value, capabilities: capabilities.value, manifest: manifest.value };

test("template_focus_is_a_boolean_template_value", () => {
  const marked = template({
    kind: "stack",
    children: [
      { kind: "button", key: "a", props: { label: "A" }, focus: { $path: "params.canAct" } },
      { kind: "button", key: "b", props: { label: "B" }, focus: { $path: "params.canEscalate" } },
    ],
  });
  expect(validateTemplate(marked, templateOptions).ok).toBe(true);
  expect(value(renderTemplate(marked, inputs, options)).focus).toBe("root/a");
  const wrong = template({ kind: "stack", children: [{ kind: "button", props: { label: "A" }, focus: "yes" }] });
  expect(failure(validateTemplate(wrong, templateOptions))).toEqual([
    { kind: "invalid-prop", pointer: "/root/children/0/focus" },
  ]);
  const fragment = template({ kind: "stack", children: [{ kind: "fragment", focus: true, children: [] }] });
  expect(failure(validateTemplate(fragment, templateOptions))).toContainEqual({
    kind: "invalid-prop",
    pointer: "/root/children/0/focus",
  });
});

test("diffed_and_applied_patch_round_trips_the_mark", () => {
  const base = value(validator.validateTree(tree()));
  const marked = { ...(tree("root/a") as UiTree), revision: 2 };
  const moved = { ...(tree("root/box/b") as UiTree), revision: 3 };
  const cleared = { ...(tree() as UiTree), revision: 4 };
  let current = base;
  for (const [next, focus] of [
    [marked, "root/a"],
    [moved, "root/box/b"],
    [cleared, null],
  ] as const) {
    const patch = value(diffTrees(current, next));
    expect(patch.focus).toBe(focus);
    const applied = value(applyPatch(current, patch));
    expect(applied).toEqual(next);
    current = applied;
  }
  // An omitted mark keeps the base's.
  const { focus: _focus, ...unmarked } = value(diffTrees(base, marked));
  const kept = value(applyPatch(marked, { ...unmarked, base: 2, revision: 3 }));
  expect(kept.focus).toBe("root/a");
  expect(Object.hasOwn(value(diffTrees(marked, { ...marked, revision: 3 })), "focus")).toBe(false);
  for (const bad of [3, "", "a"]) {
    const patch = {
      format: "liveframe/tree-patch/1",
      catalogId: "proof.ui@1",
      surfaceId: "focus",
      base: 1,
      revision: 2,
      focus: bad,
      ops: [],
    };
    expect(validateTreePatch(patch).ok).toBe(false);
  }
});

test("surface_snapshot_exposes_the_mark_while_valid", () => {
  const core = createSurfaceCore({ catalog: catalog.value, validator, onIntent: () => {} });
  expect(value(core.accept(tree("root/a"))).focus).toBe("root/a");
  expect(core.snapshot().focus).toBe("root/a");
  expect(core.accept({ ...(tree("root/missing") as UiTree), revision: 2 }).ok).toBe(false);
  expect(core.snapshot().focus).toBeUndefined();
  expect(Object.hasOwn(value(core.accept({ ...(tree() as UiTree), revision: 3 })), "focus")).toBe(false);
});
