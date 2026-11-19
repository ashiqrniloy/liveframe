import { expect, test } from "bun:test";
import { createDomRenderer, implement as implementDom, RendererError as DomRendererError } from "../dom/index.ts";
import type { LiveframeError } from "../errors.ts";
import { type Catalog, type Definition, defineComponent, obj, str } from "../index.ts";
import { createRenderer, implement as implementReact } from "../react/index.ts";
import { RendererError } from "../react/renderer.tsx";
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

function thrown(run: () => unknown): readonly LiveframeError[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RendererError);
    if (error instanceof RendererError) return error.errors;
    throw error;
  }
  return [];
}

test("dom_registry_check_matches_reacts", () => {
  // The same registrations, as definitions; each adapter binds them its own way.
  const cases: readonly (readonly Definition[])[] = [
    [button],
    [button, button, text],
    [{ ...button, description: "Different." }, text],
    [button, text, { ...button, kind: "extra" }],
    [button, { ...button, description: "Different." }, { ...button, kind: "extra" }],
    [button, text],
  ];
  for (const definitions of cases) {
    const react = thrown(() =>
      createRenderer({ catalog, implementations: definitions.map((d) => implementReact(d, () => null)) }),
    );
    const plain = thrown(() =>
      createDomRenderer({
        catalog,
        implementations: definitions.map((d) => implementDom(d, (_node, element) => element ?? ({} as Element))),
      }),
    );
    expect(plain).toEqual(react);
  }
  // Several catalogs, and a catalog that fails validation, report the same pointers too.
  const several = (implementations: readonly unknown[]) => ({
    catalogs: [
      { catalog, implementations },
      { catalog, implementations },
    ],
  });
  expect(
    thrown(() =>
      createDomRenderer(several([button, text].map((d) => implementDom(d, () => ({}) as Element))) as never),
    ),
  ).toEqual(thrown(() => createRenderer(several([button, text].map((d) => implementReact(d, () => null))) as never)));
  expect(thrown(() => createDomRenderer({ catalog: null, implementations: [] }))).toEqual(
    thrown(() => createRenderer({ catalog: null, implementations: [] })),
  );
  // One error class: a DOM host catches what a React host catches.
  expect(DomRendererError).toBe(RendererError);
});

test("dom_adapter_sets_no_inner_html_and_evaluates_nothing", async () => {
  const root = new URL("../dom/", import.meta.url).pathname;
  const forbidden =
    /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe|srcdoc|eval|Function|document\.write|DOMParser)\b|createElement\(\s*["'`]script|\bimport\s*\(|setTimeout\(\s*["'`]/;
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const files = [...new Bun.Glob("**/*.ts").scanSync(root)];
  expect(files.sort()).toEqual([
    "focus.ts",
    "implement.ts",
    "index.ts",
    "motion.ts",
    "place.ts",
    "renderer.ts",
    "switching.ts",
  ]);
  for (const path of files) {
    const source = await Bun.file(`${root}${path}`).text();
    // Comments may name what the code never does; the transpiled code may not.
    expect(transpiler.transformSync(source), path).not.toMatch(forbidden);
    // Framework-free: only the library's own modules.
    for (const { path: dependency } of transpiler.scanImports(source)) expect(dependency, path).toMatch(/^\.\.?\//);
  }
  // The scan catches what it looks for.
  for (const sample of ['el.innerHTML = "x";', 'eval("1")', 'document.createElement("script")', "new Function()"])
    expect(sample).toMatch(forbidden);
});
