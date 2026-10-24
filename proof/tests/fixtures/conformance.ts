import type { UiTree } from "@arnilo/liveframe";
import type { BrowserFixtures } from "@arnilo/liveframe/conformance/react";
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
const overlay: UiTree = {
  ...tree,
  surfaceId: "lifecycle-dialog",
  root: {
    id: "root",
    kind: "stack",
    props: {},
    children: [
      {
        id: "root/background",
        kind: "button",
        props: { label: "Background" },
        events: { onPress: { type: "action", name: "save", args: {} } },
      },
      { id: "root/dialog", kind: "dialog", props: { label: "Lifecycle", open: false } },
    ],
  },
};
export const lifecycleRules = [
  "overlay_keeps_surface_scope",
  "overlay_exit_finishes_before_unmount",
  "open_overlay_locks_scroll_and_makes_background_inert",
  "text_input_counts_code_points",
];
export const fixtures = {
  overlayKinds: ["dialog"],
  overlays: [
    {
      kind: "dialog",
      tree: overlay,
      open: async (p: Page) => {
        await p.evaluate((serialized) => {
          const tree = JSON.parse(serialized) as UiTree;
          const scope = document.querySelector("[data-lf-conformance] > .lf_surface");
          const [theme, tv] = (scope?.getAttribute("data-lf-theme") ?? "").split("@");
          const [system, sv] = (scope?.getAttribute("data-lf-ds") ?? "").split("@");
          if (!theme || !tv || !system || !sv) throw new Error("Missing fixture scope");
          window.liveframeConformance.mount(
            {
              ...tree,
              revision: 2,
              root: {
                ...tree.root,
                children: tree.root.children?.map((node) =>
                  node.kind === "dialog" ? { ...node, props: { ...node.props, open: true } } : node,
                ),
              },
            },
            { theme: { id: theme, version: tv }, designSystem: { id: system, version: sv } },
          );
        }, JSON.stringify(overlay));
        await p.getByRole("dialog", { name: "Lifecycle" }).focus();
      },
      close: (p: Page) => p.keyboard.press("Escape"),
      content: (p: Page) => p.getByRole("dialog", { name: "Lifecycle", includeHidden: true }),
      backdrop: (p: Page) => p.locator(".lf_dialog_default_backdrop"),
      background: (p: Page) => p.getByRole("button", { name: "Background", includeHidden: true }),
      exitCss: `
      @keyframes conformance-exit { from { opacity: 1 } to { opacity: 0 } }
      .lf_dialog_default_backdrop[data-exiting] { animation: conformance-exit 400ms linear }
      @media (prefers-reduced-motion: reduce) { .lf_dialog_default_backdrop[data-exiting] { animation: none } }
    `,
    },
  ],
  textInputKinds: ["textField"],
  textInputs: [
    {
      kind: "textField",
      tree: {
        ...tree,
        surfaceId: "text-bound",
        root: {
          id: "root",
          kind: "textField",
          props: { label: "Bound", value: "", maxLength: 3 },
          events: { onChange: { type: "setState", key: "query" } },
        },
      },
      field: (p: Page) => p.getByRole("textbox", { name: "Bound" }),
      maxLength: 3,
    },
  ],
  states: stateFixtures(),
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
} satisfies BrowserFixtures;

function stateFixtures(): NonNullable<BrowserFixtures["states"]> {
  const result: Record<string, NonNullable<BrowserFixtures["states"]>[string]> = {};
  for (const [kind, variants, states, slot] of [
    ["button", ["default", "primary", "danger", "ghost"], ["hover", "active", "focus", "disabled"], "root"],
    ["link", ["default"], ["hover", "focus"], "root"],
    ["textField", ["default"], ["hover", "focus", "disabled"], "input"],
    ["select", ["default"], ["hover", "active", "focus", "disabled", "selected"], "trigger"],
    ["checkbox", ["default"], ["focus", "disabled", "selected"], "root"],
    ["switch", ["default"], ["focus", "disabled", "selected"], "root"],
    ["menu", ["default"], ["hover", "active", "focus", "disabled", "open"], "trigger"],
    ["menuItem", ["default", "danger"], ["hover", "active", "focus", "disabled"], "root"],
    ["popover", ["default"], ["hover", "active", "focus"], "trigger"],
    ["dialog", ["default"], ["hover", "active", "focus"], "close"],
    ["disclosure", ["default"], ["hover", "focus"], "summary"],
    ["tab", ["default"], ["hover", "active", "focus", "disabled", "selected"], "root"],
  ] as const) {
    for (const variant of variants)
      for (const state of states) {
        const selected = state === "selected",
          disabled = state === "disabled";
        let root: UiTree["root"] = { id: "root", kind, variant, props: { label: "State target" } };
        if (kind === "link") root = { ...root, props: { ...root.props, href: "#state" } };
        if (["button", "textField", "select", "checkbox", "switch", "menu", "menuItem", "tab"].includes(kind))
          root = { ...root, props: { ...root.props, disabled } };
        if (kind === "checkbox" || kind === "switch") root = { ...root, props: { ...root.props, checked: selected } };
        if (kind === "dialog") root = { ...root, props: { ...root.props, open: true } };
        if (kind === "menu" || kind === "menuItem") {
          const item =
            kind === "menuItem"
              ? { ...root, id: "root/item" }
              : { id: "root/item", kind: "menuItem", props: { label: "Item" } };
          root = {
            id: "root",
            kind: "menu",
            props: { label: "Menu", ...(kind === "menu" ? { disabled } : {}) },
            children: [item],
          };
        }
        if (kind === "select")
          root = { ...root, props: { ...root.props, value: "one", options: [{ label: "One", value: "one" }] } };
        if (kind === "tab") {
          root = { ...root, props: { ...root.props, value: "one" } };
          root = {
            id: "root",
            kind: "tabs",
            props: { label: "Tabs", value: "one" },
            children: [{ ...root, id: "root/tab" }],
          };
        }
        const targetSlot =
          kind === "select" && selected ? "option" : kind === "menu" && state === "open" ? "content" : slot;
        const target = (page: Page) => page.locator(`.lf_${kind}_${variant}_${targetSlot}`).first();
        result[`${kind}.${variant}.${state}`] = {
          tree: { ...tree, surfaceId: `state-${kind}-${variant}-${state}`, root },
          target,
          ...(state === "focus" || kind === "menuItem" || (kind === "select" && selected) || state === "open"
            ? {
                async drive(page: Page) {
                  if (kind === "menuItem" || state === "open") await page.locator(".lf_menu_default_trigger").click();
                  if (kind === "select" && selected) await page.locator(".lf_select_default_trigger").click();
                  if (state === "focus") {
                    await page.keyboard.press(kind === "menuItem" ? "ArrowDown" : "Tab");
                    if (kind === "checkbox" || kind === "switch") await target(page).locator("input").focus();
                    else await target(page).focus();
                  } else if (state === "hover" || state === "active") {
                    await target(page).hover();
                    if (state === "active") await page.mouse.down();
                  }
                },
              }
            : {}),
        };
      }
  }
  return result;
}
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
