import type { UiNode, UiTree } from "@arnilo/liveframe";
import type { BrowserFixtures } from "@arnilo/liveframe/conformance/react";
import type { Page } from "playwright";
import { notify, tree } from "./host.ts";

const text = (id: string, label: string): UiNode => ({ id, kind: "text", props: { text: label } });
const press = (id: string, label: string): UiNode => ({
  id,
  kind: "button",
  props: { label },
  events: { onPress: notify("saved") },
});
const draft: UiNode = {
  id: "root/scroll/draft",
  kind: "textField",
  props: { label: "Draft", value: "initial" },
  events: { onChange: { type: "setState", key: "query" }, onCommit: notify("", "message") },
};
const interaction = tree("interaction", {
  id: "root",
  kind: "stack",
  props: {},
  children: [
    {
      id: "root/scroll",
      kind: "scroll",
      props: { label: "Results" },
      style: { height: "space.7" },
      children: [draft, ...Array.from({ length: 15 }, (_, i) => text(`root/scroll/row${i}`, `Row ${i}`))],
    },
    press("root/save", "Save"),
    press("root/other", "Other"),
    { id: "root/local", kind: "switch", props: { label: "Local" } },
  ],
});
// A later revision with the same ids and ancestry, and the buttons reordered.
const [scroll, save, other, local] = interaction.root.children as [UiNode, UiNode, UiNode, UiNode];
const next: UiTree = {
  ...interaction,
  revision: 3,
  root: { ...interaction.root, children: [scroll, other, save, local] },
};
const draftBox = (page: Page) => page.getByRole("textbox", { name: "Draft", exact: true });

const dialog = (open: boolean): UiTree =>
  tree(
    "dialog",
    {
      id: "root",
      kind: "stack",
      props: {},
      children: [
        press("root/background", "Background"),
        {
          id: "root/dialog",
          kind: "dialog",
          props: { label: "Lifecycle", open },
          children: [text("root/dialog/text", "Inside")],
        },
      ],
    },
    open ? 2 : 1,
  );

// The slot each state is driven on. A state that several slots style is reached through the first.
const reach = [
  ["button", ["default", "primary", "ghost"], ["hover", "active", "focus", "disabled"], "root"],
  ["link", ["default"], ["hover", "focus"], "root"],
  ["textField", ["default"], ["hover", "focus", "disabled"], "input"],
  ["select", ["default"], ["hover", "focus", "disabled", "selected"], "trigger"],
  ["checkbox", ["default"], ["focus", "disabled", "selected"], "root"],
  ["switch", ["default"], ["focus", "disabled", "selected"], "root"],
  ["menu", ["default"], ["hover", "focus", "disabled"], "trigger"],
  ["menuItem", ["default"], ["hover", "focus", "disabled"], "root"],
  ["popover", ["default"], ["hover", "focus"], "trigger"],
  ["dialog", ["default"], ["hover", "focus"], "close"],
  ["tabs", ["default"], ["focus"], "panel"],
  ["tab", ["default"], ["hover", "focus", "disabled", "selected"], "root"],
  ["disclosure", ["default"], ["hover", "focus"], "summary"],
] as const;

/** A state fixture for one `kind.variant.state`, driven by real pointer and keyboard input where it must be. */
function stateFixtures(): NonNullable<BrowserFixtures["states"]> {
  const result: Record<string, NonNullable<BrowserFixtures["states"]>[string]> = {};
  // A button's tone is an axis: its states are reached one axis value at a time.
  for (const [kind, variants, states, slot] of reach)
    for (const variant of variants)
      for (const tone of kind === "button" ? ["neutral", "critical"] : [undefined])
        for (const state of states) {
          const selected = state === "selected";
          const disabled = state === "disabled";
          const props: Record<string, unknown> = { label: "State target" };
          if (tone) props.tone = tone;
          if (kind === "link") props.href = "#state";
          if (["button", "textField", "select", "checkbox", "switch", "menu", "menuItem", "tab"].includes(kind))
            props.disabled = disabled;
          if (kind === "checkbox" || kind === "switch") props.checked = selected;
          if (kind === "dialog") props.open = true;
          if (kind === "select") Object.assign(props, { value: "one", options: [{ label: "One", value: "one" }] });
          if (kind === "tab" || kind === "tabs") props.value = "one";
          let root: UiNode = { id: "root", kind, variant, props } as UiNode;
          if (kind === "menu")
            root = { ...root, children: [{ id: "root/item", kind: "menuItem", props: { label: "Item" } }] };
          if (kind === "menuItem")
            root = {
              id: "root",
              kind: "menu",
              props: { label: "Menu" },
              children: [{ ...root, id: "root/item" }],
            };
          if (kind === "tab")
            root = {
              id: "root",
              kind: "tabs",
              props: { label: "Tabs", value: "one" },
              children: [{ ...root, id: "root/tab", children: [text("root/tab/text", "Panel")] }],
            };
          if (kind === "tabs")
            root = { ...root, children: [{ id: "root/tab", kind: "tab", props: { label: "One", value: "one" } }] };
          const key = `${kind}.${variant}${tone ? `__${tone}` : ""}.${state}`;
          const className = `.lf_${kind}_${variant}${tone ? `__${tone}` : ""}_${slot}`;
          const target = (page: Page) =>
            // A selected option lives in the opened list.
            page.locator(kind === "select" && selected ? ".lf_select_default_option" : className).first();
          const drives = state === "focus" || kind === "menuItem" || (kind === "select" && selected);
          result[key] = {
            tree: tree(`state-${key}`, root),
            target,
            ...(drives
              ? {
                  async drive(page: Page) {
                    if (kind === "menuItem") await page.locator(".lf_menu_default_trigger").click();
                    if (kind === "select" && selected) await page.locator(".lf_select_default_trigger").click();
                    if (state === "focus") {
                      await page.keyboard.press(kind === "menuItem" ? "ArrowDown" : "Tab");
                      if (kind === "checkbox" || kind === "switch") await target(page).locator("input").focus();
                      else await target(page).focus();
                    } else if (state === "hover") await target(page).hover();
                  },
                }
              : {}),
          };
        }
  return result;
}

export const fixtures = {
  interactions: [
    {
      tree: interaction,
      act: (page: Page) => page.getByRole("button", { name: "Save", exact: true }).click(),
      intents: [notify("saved")],
    },
    { tree: interaction, act: (page: Page) => page.getByRole("switch", { name: "Local" }).press("Space"), intents: [] },
    {
      tree: interaction,
      async act(page: Page) {
        await draftBox(page).fill("draft");
        await draftBox(page).press("Enter");
      },
      intents: [{ type: "setState", key: "query", value: "draft" }, notify("draft")],
    },
  ],
  survival: {
    tree: interaction,
    next,
    focus: draftBox,
    input: draftBox,
    scroll: (page: Page) => page.getByRole("region", { name: "Results" }),
  },
  states: stateFixtures(),
  overlayKinds: ["dialog"],
  overlays: [
    {
      kind: "dialog",
      tree: dialog(false),
      async open(page: Page) {
        await page.evaluate(
          (serialized) => {
            const scope = document.querySelector("[data-lf-conformance] > .lf_surface");
            const [theme, themeVersion] = (scope?.getAttribute("data-lf-theme") ?? "").split("@");
            const [system, systemVersion] = (scope?.getAttribute("data-lf-ds") ?? "").split("@");
            if (!theme || !themeVersion || !system || !systemVersion) throw new Error("Missing fixture scope");
            window.liveframeConformance.mount(JSON.parse(serialized), {
              theme: { id: theme, version: themeVersion },
              designSystem: { id: system, version: systemVersion },
            });
          },
          JSON.stringify(dialog(true)),
        );
        await page.getByRole("dialog", { name: "Lifecycle" }).focus();
      },
      close: (page: Page) => page.keyboard.press("Escape"),
      content: (page: Page) => page.getByRole("dialog", { name: "Lifecycle", includeHidden: true }),
      backdrop: (page: Page) => page.locator(".lf_dialog_default_backdrop"),
      background: (page: Page) => page.getByRole("button", { name: "Background", includeHidden: true }),
      exitCss: `
      @keyframes starter-exit { from { opacity: 1 } to { opacity: 0 } }
      .lf_dialog_default_backdrop[data-exiting] { animation: starter-exit 400ms linear }
      @media (prefers-reduced-motion: reduce) { .lf_dialog_default_backdrop[data-exiting] { animation: none } }
    `,
    },
  ],
  textInputKinds: ["textField"],
  textInputs: [
    {
      kind: "textField",
      tree: tree("text-bound", {
        id: "root",
        kind: "textField",
        props: { label: "Bound", value: "", maxLength: 3 },
        events: { onChange: { type: "setState", key: "query" } },
      }),
      field: (page: Page) => page.getByRole("textbox", { name: "Bound" }),
      maxLength: 3,
    },
  ],
} satisfies BrowserFixtures;

/** Hydration examples may hold deferred content: a dialog that arrives open mounts in its portal after load. */
export const hydrationExamples: UiTree[] = [
  interaction,
  tree("hydrated-overlay", {
    id: "root",
    kind: "dialog",
    props: { label: "Hydrated dialog", open: true },
    children: [text("root/text", "Deferred portal content")],
  }),
];
