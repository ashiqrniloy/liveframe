import type { UiTree } from "@arnilo/liveframe";
import type { Page } from "playwright";
import { conformanceOptions } from "./renderer.ts";

export const pageOptions = conformanceOptions;
const { catalog } = pageOptions;
const tree: UiTree = {
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "conformance-browser",
  revision: 1,
  root: {
    id: "root",
    kind: "stack",
    props: {},
    children: [
      {
        id: "root/scroll",
        kind: "scroll",
        props: { label: "Results" },
        style: { height: "space.7" },
        children: [
          {
            id: "root/scroll/query",
            kind: "textField",
            props: { label: "Draft", value: "initial" },
            events: {
              onChange: { type: "setState", key: "query" },
              onCommit: { type: "action", name: "save", args: { source: "query" }, bind: "from" },
            },
          },
          { id: "root/scroll/other", kind: "textField", props: { label: "Other", value: "other" } },
          ...Array.from({ length: 15 }, (_, i) => ({
            id: `root/scroll/row${i}`,
            kind: "text",
            props: { text: `Row ${i}` },
          })),
        ],
      },
      {
        id: "root/save",
        kind: "button",
        props: { label: "Save" },
        events: { onPress: { type: "action", name: "save", args: {} } },
      },
      { id: "root/local", kind: "switch", props: { label: "Local" } },
    ],
  },
};
const focus = (page: Page) => page.getByRole("textbox", { name: "Draft", exact: true });
const next: UiTree = {
  ...tree,
  revision: 3,
  root: {
    ...tree.root,
    children: [...(tree.root.children ?? []).slice(0, 1), ...(tree.root.children ?? []).slice(1).reverse()],
  },
};
export const fixtures = {
  interactions: [
    {
      tree,
      act: (p: Page) => p.getByRole("button", { name: "Save", exact: true }).click(),
      intents: [{ type: "action", name: "save", args: {} }],
    },
    { tree, act: (p: Page) => p.getByRole("switch", { name: "Local" }).press("Space"), intents: [] },
    {
      tree,
      async act(p: Page) {
        await focus(p).fill("draft");
        await focus(p).press("Enter");
      },
      intents: [
        { type: "setState", key: "query", value: "draft" },
        { type: "action", name: "save", args: { source: "query", from: "draft" } },
      ],
    },
  ],
  survival: { tree, next, focus, input: focus, scroll: (p: Page) => p.getByRole("region", { name: "Results" }) },
};
export const browserExamples: UiTree[] = [
  tree,
  {
    ...tree,
    surfaceId: "hydrated-overlay",
    root: {
      id: "root",
      kind: "dialog",
      props: { label: "Hydrated dialog", open: true },
      children: [{ id: "root/text", kind: "text", props: { text: "Deferred portal content" } }],
    },
  },
];
