import {
  type Capabilities,
  type UiNode,
  type UiTree,
  validateCapabilities,
  validateDesignSystem,
} from "@arnilo/liveframe";
import type { PageOptions } from "@arnilo/liveframe/conformance/react";
import { catalog, valid } from "../catalog.ts";
import { designSystem } from "../design-system.ts";
import { implementations } from "../implementations.tsx";
import { themes } from "../themes.ts";

const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;

// The starter ships no capabilities: they are the app's. The suites need one action to carry.
const checked = validateCapabilities({
  format: "liveframe-capabilities/1",
  sources: {},
  actions: {
    "app.notify": {
      description: "Tell the user something.",
      args: { ...empty, properties: { message: { type: "string", maxLength: 200 } } },
    },
  },
});
if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
export const capabilities: Capabilities = checked.value;

/** A manifest that permits every event the examples carry. */
export const manifest = {
  format: "liveframe-manifest/1",
  id: "starter-conformance",
  version: "1",
  catalogId: catalog.catalogId,
  params: empty,
  context: empty,
  initialState: {},
  sources: {},
  actions: ["app.notify"],
  state: { ...empty, properties: { query: { type: "string", maxLength: 100 }, help: { type: "boolean" } } },
};

// Switching needs a second design system identity; one derived from the starter shows nothing else about it.
const rounder = valid(
  "derived design system",
  validateDesignSystem(
    {
      ...designSystem,
      id: "starter-round",
      values: { ...designSystem.values, "radius.control": { kind: "radius", value: { value: 12, unit: "px" } } },
    },
    { catalog, registry: {} },
  ),
);

/** The page entry and the test process share these: the page draws with them, the suites check them. */
export const pageOptions: PageOptions = {
  catalog,
  capabilities,
  manifest,
  implementations,
  themes,
  designSystems: [designSystem, rounder],
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
  ({ type: "action", name: "app.notify", args: bind ? {} : { message }, ...(bind ? { bind } : {}) }) as const;

const text = (id: string, label: string): UiNode => ({ id, kind: "text", props: { text: label } });
const part = (kind: string, id: string, props: UiNode["props"], extra: Partial<UiNode> = {}): UiNode => ({
  id,
  kind,
  props,
  ...extra,
});
const withText = (kind: string, id: string, props: UiNode["props"], extra: Partial<UiNode> = {}) =>
  part(kind, id, props, { children: [text(`${id}/text`, "Content")], ...extra });

/** Every node of the example surface, with one entry per variant and per axis value. */
function nodes(): UiNode[] {
  const list: UiNode[] = [];
  for (const variant of ["default", "plate", "rule", "callout"])
    list.push(withText("box", `root/box-${variant}`, {}, { variant }));
  for (const kind of ["inline", "grid"]) list.push(withText(kind, `root/${kind}`, {}));
  list.push(
    withText("scroll", "root/scroll", { label: "Results" }),
    part("separator", "root/separator", {}),
    text("root/text", "Text"),
    part("hint", "root/hint", { text: "A hint" }),
    part("heading", "root/heading", { text: "Heading", level: 2 }),
    part("icon", "root/icon", { name: "check", label: "Done" }),
    part("image", "root/image", { src: "/logo.png", alt: "Logo" }),
    part("link", "root/link", { label: "Link", href: "https://example.com" }),
  );
  for (const variant of ["default", "primary", "ghost"])
    for (const tone of ["neutral", "critical"])
      list.push(part("button", `root/button-${variant}-${tone}`, { label: "Button", tone }, { variant }));
  list.push(
    part(
      "textField",
      "root/field",
      { label: "Draft", value: "initial", describedBy: "root/hint" },
      { events: { onChange: { type: "setState", key: "query" }, onCommit: notify("", "message") } },
    ),
    part("select", "root/select", { label: "Pick", value: "one", options: [{ label: "One", value: "one" }] }),
    part("checkbox", "root/checkbox", { label: "Check" }),
    part("switch", "root/switch", { label: "Switch" }),
    part("menu", "root/menu", { label: "Menu" }, { children: [part("menuItem", "root/menu/item", { label: "Item" })] }),
    part("popover", "root/popover", { label: "Popover" }),
    part("dialog", "root/dialog", { label: "Dialog", open: false }),
    withText("tooltip", "root/tooltip", { text: "Tip" }),
    part(
      "tabs",
      "root/tabs",
      { label: "Tabs", value: "one" },
      { children: [withText("tab", "root/tabs/one", { label: "One", value: "one" })] },
    ),
    withText("disclosure", "root/disclosure", { label: "More" }),
  );
  return list;
}

/** One surface holding every (kind, variant, axis value) the catalog declares. */
export const examples: UiTree[] = [tree("example", { id: "root", kind: "stack", props: {}, children: nodes() })];

/** The same surface for the server: a menu's items mount only when it opens, in the browser. */
export const serverExamples: UiTree[] = examples.map((example) => ({
  ...example,
  root: {
    ...example.root,
    children: (example.root.children ?? []).filter((node) => node.kind !== "menu"),
  },
}));
