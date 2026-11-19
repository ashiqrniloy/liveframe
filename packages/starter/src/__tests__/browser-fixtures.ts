import type { TreeIntent, UiNode, UiTree } from "@arnilo/liveframe";
import type { BrowserFixtures } from "@arnilo/liveframe/conformance/react";
import type { Locator, Page } from "playwright";
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
  ["scroll", ["default"], ["focus"], "viewport"],
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

const keyboardFocus = (target: (page: Page) => Locator) => async (page: Page) => {
  // A key press first puts the engine and React Aria in keyboard modality, so the focus is visible.
  await page.keyboard.press("Tab");
  await target(page).focus();
};
const first = (selector: string) => (page: Page) => page.locator(selector).first();

/** The 0.4 controls and content kinds: each state is reached on the element that carries its attribute. */
function controlStateFixtures(): NonNullable<BrowserFixtures["states"]> {
  const label = "State target";
  const group = (props: UiNode["props"] = {}, radio: UiNode["props"] = {}): UiNode => ({
    id: "root",
    kind: "radioGroup",
    props: { label, ...props },
    children: [
      { id: "root/a", kind: "radio", props: { label: "A", value: "a", ...radio } },
      { id: "root/b", kind: "radio", props: { label: "B", value: "b" } },
    ],
  });
  const slider = (props: UiNode["props"] = {}): UiNode => ({
    id: "root",
    kind: "slider",
    props: { label, value: 40, ...props },
  });
  const date = (props: UiNode["props"] = {}): UiNode => ({
    id: "root",
    kind: "dateField",
    props: { label, value: "2026-11-19", ...props },
  });
  const rich: UiNode = { id: "root", kind: "richText", props: { text: "See the [report](#state)." } };
  const link = first(".lf_richText_default_link");
  const radioInput = first(".lf_radio_default_root input");
  const thumbInput = first(".lf_slider_default_thumb input");
  const segment = first(".lf_dateField_default_segment[role=spinbutton]");
  const entries: [string, UiNode, (page: Page) => Locator, ((page: Page) => Promise<unknown>)?][] = [
    [
      "radioGroup.default.focus",
      group({ value: "a" }),
      first(".lf_radioGroup_default_root"),
      keyboardFocus(radioInput),
    ],
    ["radioGroup.default.disabled", group({ disabled: true }), first(".lf_radioGroup_default_root")],
    ["radio.default.hover", group(), first(".lf_radio_default_root")],
    ["radio.default.active", group(), first(".lf_radio_default_root")],
    ["radio.default.focus", group({ value: "a" }), first(".lf_radio_default_root"), keyboardFocus(radioInput)],
    ["radio.default.disabled", group({}, { disabled: true }), first(".lf_radio_default_root")],
    ["radio.default.selected", group({ value: "a" }), first(".lf_radio_default_root")],
    ["slider.default.hover", slider(), first(".lf_slider_default_thumb")],
    ["slider.default.active", slider(), first(".lf_slider_default_thumb")],
    ["slider.default.focus", slider(), first(".lf_slider_default_thumb"), keyboardFocus(thumbInput)],
    ["slider.default.disabled", slider({ disabled: true }), first(".lf_slider_default_root")],
    // No value: indeterminate.
    ["progress.default.mixed", { id: "root", kind: "progress", props: { label } }, first(".lf_progress_default_root")],
    ["dateField.default.hover", date(), first(".lf_dateField_default_input")],
    ["dateField.default.focus", date(), first(".lf_dateField_default_input"), keyboardFocus(segment)],
    ["dateField.default.readonly", date({ readOnly: true }), first(".lf_dateField_default_root")],
    // A value after `maximum` is out of range, shown as it arrives.
    ["dateField.default.invalid", date({ maximum: "2026-01-01" }), first(".lf_dateField_default_root")],
    ["dateField.default.disabled", date({ disabled: true }), first(".lf_dateField_default_root")],
    // The content kinds raise nothing; a formatted text's links are its one styled interaction.
    ["richText.default.hover", rich, link],
    ["richText.default.focus", rich, link, keyboardFocus(link)],
  ];
  return Object.fromEntries(
    entries.map(([key, root, target, drive]) => [
      key,
      { tree: tree(`state-${key}`, root), target, ...(drive ? { drive } : {}) },
    ]),
  );
}

const screen = (surfaceId: string, children: UiNode[]) =>
  tree(surfaceId, { id: "root", kind: "stack", props: {}, children });
const button = (id: string, label: string, onPress: TreeIntent): UiNode => ({
  id,
  kind: "button",
  props: { label },
  events: { onPress },
});
const gated: UiNode = { id: "root/shown", kind: "text", props: { text: "Shown" }, when: { $path: "local.open" } };
const shown = (page: Page) => page.getByText("Shown", { exact: true });
const click = (name: string) => (page: Page) => page.getByRole("button", { name, exact: true }).click();

export const fixtures = {
  local: {
    tree: screen("local", [
      button("root/show", "Show", { type: "setLocal", key: "open", value: true }),
      button("root/hide", "Hide", { type: "setLocal", key: "open", value: false }),
      gated,
    ]),
    show: click("Show"),
    hide: click("Hide"),
    gated: shown,
  },
  compound: {
    tree: screen("compound", [
      button("root/save", "Save", { ...notify("saved"), local: [{ key: "open", value: true }] }),
      gated,
    ]),
    act: click("Save"),
    intents: [notify("saved")],
    gated: shown,
  },
  fromLocal: {
    tree: screen("from-local", [
      {
        id: "root/title",
        kind: "textField",
        props: { label: "Title", value: "" },
        events: { onChange: { type: "setLocal", key: "title" } },
      },
      button("root/save", "Save", { type: "action", name: "app.notify", args: {}, fromLocal: { message: "title" } }),
    ]),
    async act(page: Page) {
      await page.getByRole("textbox", { name: "Title" }).fill("draft");
      await click("Save")(page);
    },
    intents: [notify("draft")],
  },
  focus: {
    tree: interaction,
    next: { ...interaction, revision: 2, focus: "root/scroll/draft" },
    target: draftBox,
  },
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
  states: { ...stateFixtures(), ...controlStateFixtures() },
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
