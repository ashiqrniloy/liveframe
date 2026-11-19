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
  state: {
    ...empty,
    properties: {
      query: { type: "string", maxLength: 100 },
      help: { type: "boolean" },
      // The 0.4 controls carry into these.
      priority: { type: "string", maxLength: 128 },
      level: { type: "number", minimum: 0, maximum: 100 },
      due: { type: "string", maxLength: 10 },
    },
  },
  // The renderer conformance cases for local state, compound writes and fromLocal read these.
  local: {
    ...empty,
    properties: { open: { type: "boolean" }, title: { type: "string", maxLength: 100 } },
    required: ["open", "title"],
  },
  initialLocal: { open: false, title: "" },
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
    part(
      "radioGroup",
      "root/radios",
      { label: "Priority", value: "low", describedBy: "root/hint" },
      {
        events: { onChange: { type: "setState", key: "priority" } },
        children: [
          part("radio", "root/radios/low", { label: "Low", value: "low" }),
          part("radio", "root/radios/high", { label: "High", value: "high" }),
        ],
      },
    ),
    part(
      "slider",
      "root/slider",
      { label: "Level", value: 40, valueText: "40 percent" },
      { events: { onChange: { type: "setState", key: "level" } } },
    ),
    part("progress", "root/progress", { label: "Upload", value: 30 }),
    part("progress", "root/progress-indeterminate", { label: "Waiting" }),
    part(
      "dateField",
      "root/date",
      { label: "Due", value: "2026-11-19", minimum: "2026-01-01" },
      { events: { onChange: { type: "setState", key: "due" } } },
    ),
    part("richText", "root/rich", {
      text: "## Done\n\n**Closed** *three* tasks; see `log` or the [report](https://example.com/r).\n\n- one\n- two",
    }),
    part("chart", "root/chart-bar", {
      label: "Closed per day",
      type: "bar",
      labels: ["Mon", "Tue"],
      series: [
        { name: "Closed", values: [3, 5] },
        { name: "Opened", values: [2, 4] },
        { name: "Moved", values: [1, 0] },
        { name: "Dropped", values: [0, 1] },
      ],
    }),
    part("chart", "root/chart-line", {
      label: "Backlog",
      type: "line",
      labels: ["Mon", "Tue"],
      series: [{ name: "Open", values: [8, 6] }],
      summary: "The backlog shrinks.",
    }),
    part(
      "table",
      "root/table",
      { label: "Tasks", caption: "Open tasks" },
      {
        children: [
          part(
            "tableRow",
            "root/table/head",
            {},
            {
              children: [
                withText("tableCell", "root/table/head/name", { header: "column" }),
                withText("tableCell", "root/table/head/owner", { header: "column" }),
              ],
            },
          ),
          part(
            "tableRow",
            "root/table/row",
            {},
            {
              children: [
                withText("tableCell", "root/table/row/name", { header: "row" }),
                withText("tableCell", "root/table/row/owner", {}),
              ],
            },
          ),
          part(
            "tableRow",
            "root/table/wide",
            {},
            {
              children: [withText("tableCell", "root/table/wide/cell", { span: 2 })],
            },
          ),
        ],
      },
    ),
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
