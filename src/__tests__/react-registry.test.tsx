import { expect, spyOn, test } from "bun:test";
import { renderToString } from "react-dom/server";
import * as formats from "../formats/catalog.ts";
import { type Catalog, defineComponent, obj, str } from "../index.ts";
import { createRenderer, type Implementation, implement } from "../react/index.ts";
import { RendererError } from "../react/renderer.tsx";
import { surfaceProps } from "./fixtures/react-surface.tsx";
import vocabulary from "./fixtures/vocabulary.json" with { type: "json" };

const button = defineComponent({
  kind: "button",
  description: "Runs an intent.",
  props: obj({ label: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default", "primary"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: { onPress: { carries: "none", description: "Pressed." } },
  styleProps: [],
  a11y: { role: "button", name: "label" },
});
const text = defineComponent({ ...button, kind: "text" });
const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "Primitives.",
  vocabulary,
  definitions: [button, text],
} as const satisfies Catalog;
const binding = implement(button, () => null);
const textBinding = implement(text, () => null);

function rejected(implementations: readonly Implementation[]) {
  try {
    createRenderer({ catalog, implementations });
  } catch (error) {
    expect(error).toBeInstanceOf(RendererError);
    if (error instanceof RendererError) return error.errors;
    throw error;
  }
  throw new Error("Expected registry rejection");
}

test("registry_rejects_missing_duplicate_mismatched_and_extra_kinds", () => {
  const mismatched = implement({ ...button, description: "Different." }, () => null);
  const extra = implement({ ...button, kind: "extra" }, () => null);
  const cases = [
    [[binding], ["Missing implementation: text"]],
    [[binding, binding, textBinding], ["Duplicate implementation: button"]],
    [[mismatched, textBinding], ["Definition differs from catalog: button"]],
    [[binding, textBinding, extra], ["Kind outside catalog: extra"]],
    [
      [binding, mismatched, extra],
      [
        "Duplicate implementation: button",
        "Definition differs from catalog: button",
        "Kind outside catalog: extra",
        "Missing implementation: text",
      ],
    ],
  ] as const;
  for (const [implementations, messages] of cases) {
    const errors = rejected(implementations);
    expect(errors.map((error) => error.message).sort()).toEqual([...messages].sort());
    expect(errors.every((error) => error.kind === "catalog-mismatch" && error.pointer.startsWith("/"))).toBe(true);
  }
});

test("registry_validates_catalog_before_binding", () => {
  expect(() => createRenderer({ catalog: { ...catalog, catalogId: "bad" }, implementations: [] })).toThrow(
    RendererError,
  );
  try {
    createRenderer({ catalog: null, implementations: [] });
  } catch (error) {
    expect(error).toBeInstanceOf(RendererError);
    if (!(error instanceof RendererError)) throw error;
    expect(error.errors).toEqual([{ kind: "invalid-document", pointer: "", message: "Expected a catalog object" }]);
    return;
  }
  throw new Error("Expected invalid catalog rejection");
});

test("registry_ignores_definition_key_order", () => {
  const reordered = {
    ...Object.fromEntries(Object.entries(button).reverse()),
    ...button,
    props: { ...button.props, properties: { label: { type: "string", maxLength: 80 } } },
    a11y: { name: "label", role: "button" },
  } as typeof button;
  expect(() =>
    createRenderer({ catalog, implementations: [implement(reordered, () => null), textBinding] }),
  ).not.toThrow();
  expect(rejected([implement({ ...button, slots: ["label", "root"] }, () => null), textBinding])).toHaveLength(1);
});

test("registry_check_runs_once", () => {
  const validate = spyOn(formats, "validateCatalog");
  try {
    const { Surface } = createRenderer({ catalog, implementations: [binding, textBinding] });
    expect(validate).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 3; i++) renderToString(<Surface {...surfaceProps} tree={null} />);
    expect(validate).toHaveBeenCalledTimes(1);
  } finally {
    validate.mockRestore();
  }
});
