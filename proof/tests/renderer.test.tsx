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

test("renderer_does_not_import_design_systems_or_widget_authoring_code", async () => {
  const root = new URL("../renderer/", import.meta.url);
  for (const path of new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: root.pathname })) {
    const source = await Bun.file(new URL(path, root)).text();
    expect(source).not.toMatch(/from\s+["'][^"']*(?:styles\/|runtime\/(?:index|render|jsx))/);
  }
});
