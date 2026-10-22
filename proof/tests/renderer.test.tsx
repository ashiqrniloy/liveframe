import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { implementations } from "../renderer/primitives/index.tsx";
import { registry } from "../renderer/registry.ts";
import { Surface } from "../renderer/surface.tsx";
import { proofCatalog } from "../runtime/index.ts";
import type { RenderOptions, UiTree } from "../runtime/types.ts";

export const options: RenderOptions = {
  catalog: proofCatalog,
  actions: ["save"],
  state: {
    type: "object",
    properties: { query: { type: "string", maxLength: 100 } },
    required: [],
    additionalProperties: false,
  },
};
export const tree: UiTree = {
  format: "liveframe/1",
  catalogId: "proof@1",
  surfaceId: "test",
  revision: 1,
  root: { id: "root", kind: "text", props: { text: "Hello" } },
};

test("registry_check_fails_on_missing_or_duplicate_implementation", () => {
  expect(() => registry(proofCatalog, implementations.slice(1))).toThrow("Missing implementation");
  expect(() => registry(proofCatalog, [...implementations, ...implementations])).toThrow("Duplicate implementation");
  expect(registry(proofCatalog, implementations).size).toBe(proofCatalog.definitions.length);
});

test("server_rendering_and_transport_revalidation", () => {
  const registered = registry(proofCatalog, implementations);
  const html = (value: unknown) =>
    renderToString(
      <Surface
        tree={value}
        options={options}
        registry={registered}
        fallback={<p>Unavailable</p>}
        onIntent={() => {}}
      />,
    );
  expect(html(tree)).toContain("Hello");
  for (const root of [
    { ...tree.root, kind: "unknown" },
    { ...tree.root, props: { text: "Hello", style: "color:red" } },
    { ...tree.root, style: { padding: "13px" } },
    { ...tree.root, events: { onPress: { type: "action", name: "save", args: {} } } },
  ])
    expect(html({ ...tree, root })).toContain("Unavailable");
  expect(html(null)).toContain("Unavailable");
});

test("semantics_and_disclosure_render_their_elements", () => {
  const registered = registry(proofCatalog, implementations);
  const html = (root: UiTree["root"]) =>
    renderToString(
      <Surface tree={{ ...tree, root }} options={options} registry={registered} fallback={null} onIntent={() => {}} />,
    );
  const facts = html({
    id: "root",
    kind: "stack",
    props: { semantics: "terms", label: "Facts" },
    children: [
      {
        id: "root/term",
        kind: "inline",
        props: { semantics: "term" },
        children: [{ id: "root/term/t", kind: "text", props: { text: "Owner" } }],
      },
      {
        id: "root/detail",
        kind: "box",
        props: { semantics: "detail" },
        children: [{ id: "root/detail/t", kind: "text", props: { text: "You" } }],
      },
    ],
  });
  expect(facts).toMatch(/<dl[^>]*aria-label="Facts"/);
  expect(facts).toContain("<dt");
  expect(facts).toContain("<dd");
  const reference = html({
    id: "root",
    kind: "disclosure",
    props: { label: "Reference" },
    children: [{ id: "root/body", kind: "text", props: { text: "Hidden detail" } }],
  });
  expect(reference).toContain("<details");
  expect(reference).toContain("<summary");
  expect(reference).toContain("Hidden detail");
  const button = html({ id: "root", kind: "button", props: { label: "Selected", current: true, pressed: true } });
  expect(button).toContain('aria-current="true"');
  expect(button).toContain('aria-pressed="true"');
  expect(html({ id: "root", kind: "button", props: { label: "Plain" } })).not.toContain("aria-pressed");
});

test("renderer_does_not_import_design_systems_or_widget_authoring_code", async () => {
  const root = new URL("../renderer/", import.meta.url);
  for (const path of new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: root.pathname })) {
    const source = await Bun.file(new URL(path, root)).text();
    expect(source).not.toMatch(/from\s+["'][^"']*(?:styles\/|runtime\/(?:index|render|jsx))/);
  }
});
