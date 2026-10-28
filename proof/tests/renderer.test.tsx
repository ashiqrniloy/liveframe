import { expect, test } from "bun:test";
import { compileValidator, type UiTree } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { renderToString } from "react-dom/server";
import { implementations } from "../renderer/primitives/index.tsx";
import { catalog, Surface, scope, conformanceOptions } from "./fixtures/renderer.ts";

test("proof_button_labels_irreversible_actions", () => {
  for (const irreversible of [true, false]) {
    const validator = compileValidator({
      ...conformanceOptions,
      capabilities: {
        ...conformanceOptions.capabilities,
        actions: {
          ...conformanceOptions.capabilities.actions,
          save: { ...conformanceOptions.capabilities.actions.save, irreversible },
        },
      },
    });
    const html = renderToString(
      <Surface
        {...scope}
        validator={validator}
        fallback={null}
        onIntent={() => {}}
        tree={{
          ...tree,
          root: {
            id: "root",
            kind: "button",
            props: { label: "Save" },
            events: { onPress: { type: "action", name: "save", args: {} } },
          },
        }}
      />,
    );
    expect(html.includes('data-irreversible="true"')).toBe(irreversible);
    expect(html.includes("(irreversible)")).toBe(irreversible);
  }
});

export const tree: UiTree = {
  format: "liveframe/1",
  catalogId: "proof.ui@1",
  surfaceId: "test",
  revision: 1,
  root: { id: "root", kind: "text", props: { text: "Hello" } },
};

test("registry_check_fails_on_missing_or_duplicate_implementation", () => {
  expect(() => createRenderer({ catalog, implementations: implementations.slice(1) })).toThrow(
    "Missing implementation",
  );
  expect(() => createRenderer({ catalog, implementations: [...implementations, ...implementations] })).toThrow(
    "Duplicate implementation",
  );
  expect(createRenderer({ catalog, implementations }).Surface).toBeInstanceOf(Function);
});

test("server_rendering_and_transport_revalidation", () => {
  const html = (value: unknown) =>
    renderToString(<Surface tree={value} {...scope} fallback={<p>Unavailable</p>} onIntent={() => {}} />);
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
  const html = (root: UiTree["root"]) =>
    renderToString(<Surface tree={{ ...tree, root }} {...scope} fallback={null} onIntent={() => {}} />);
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
