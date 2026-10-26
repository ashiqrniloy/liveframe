import type { UiNode, UiTree } from "@arnilo/liveframe";
import type { PageOptions } from "@arnilo/liveframe/conformance/react";
import { capabilities, catalog, designSystems, themes } from "./app.ts";
import { implementations } from "./primitives/index.tsx";

const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;

/** A manifest that permits every event the examples carry. Examples are checked against it, not against a widget's. */
export const manifest = {
  format: "liveframe-manifest/1",
  id: "conformance",
  version: "1",
  catalogId: catalog.catalogId,
  params: empty,
  context: empty,
  initialState: {},
  sources: {},
  actions: ["demo.notify"],
  state: { ...empty, properties: { query: { type: "string", maxLength: 100 }, help: { type: "boolean" } } },
};

/** The page entry and the test process share these: the page draws with them, the suites check them. */
export const pageOptions: PageOptions = {
  catalog,
  capabilities,
  manifest,
  implementations,
  themes,
  designSystems,
  fallback: "Unavailable",
};

export const tree = (surfaceId: string, root: UiNode, revision = 1): UiTree => ({
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId,
  revision,
  root,
});
export const notify = (message: string, bind?: string) =>
  ({ type: "action", name: "demo.notify", args: bind ? {} : { message }, ...(bind ? { bind } : {}) }) as const;

const text = (id: string, label: string): UiNode => ({ id, kind: "text", props: { text: label } });
const variants = (kind: string, names: readonly string[], props: UiNode["props"], children = false) =>
  names.map((variant) => ({
    id: `root/${kind}-${variant}`,
    kind,
    variant,
    props,
    ...(children ? { children: [text(`root/${kind}-${variant}/text`, variant)] } : {}),
  }));

/** One tree that holds every (kind, variant) the catalog declares. */
export const examples: UiTree[] = [
  tree("example", {
    id: "root",
    kind: "stack",
    props: {},
    children: [
      ...variants("box", ["default", "plate", "rule", "callout"], {}, true),
      { id: "root/inline", kind: "inline", props: {}, children: [text("root/inline/text", "Inline")] },
      { id: "root/heading", kind: "heading", props: { text: "Heading", level: 2 } },
      text("root/text", "Text"),
      ...variants("button", ["default", "primary", "danger", "ghost"], { label: "Button" }),
      {
        id: "root/field",
        kind: "textField",
        props: { label: "Draft", value: "initial" },
        events: { onChange: { type: "setState", key: "query" }, onCommit: notify("", "message") },
      },
      // A dialog's content mounts in a portal after the page loads, so server examples leave it empty.
      { id: "root/dialog", kind: "dialog", props: { label: "Dialog", open: false } },
    ],
  }),
];
