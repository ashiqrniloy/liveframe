import type { UiNode, UiTree } from "@arnilo/liveframe";
import type { BrowserFixtures } from "@arnilo/liveframe/conformance/react";
import type { Page } from "playwright";
import { notify, pageOptions, tree } from "../conformance-host.ts";

const text = (id: string, label: string): UiNode => ({ id, kind: "text", props: { text: label } });
const press = (id: string, label: string): UiNode => ({
  id,
  kind: "button",
  props: { label },
  events: { onPress: notify("saved") },
});
const draft: UiNode = {
  id: "root/draft",
  kind: "textField",
  props: { label: "Draft", value: "initial" },
  events: { onChange: { type: "setState", key: "query" }, onCommit: notify("", "message") },
};
const interaction = tree("interaction", {
  id: "root",
  kind: "stack",
  props: {},
  children: [draft, press("root/save", "Save"), press("root/other", "Other")],
});
// A later revision with the same ids and ancestry, and the buttons reordered.
const next: UiTree = {
  ...interaction,
  revision: 3,
  root: { ...interaction.root, children: [draft, press("root/other", "Other"), press("root/save", "Save")] },
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

/** A state fixture for one `kind.variant.state`, driven by real pointer and keyboard input where it must be. */
function stateFixtures(): NonNullable<BrowserFixtures["states"]> {
  const result: Record<string, NonNullable<BrowserFixtures["states"]>[string]> = {};
  for (const [kind, variants, states, slot] of [
    ["button", ["default", "primary", "danger", "ghost"], ["hover", "active", "focus", "disabled"], "root"],
    ["textField", ["default"], ["hover", "focus", "disabled"], "input"],
    ["dialog", ["default"], ["hover", "active", "focus"], "close"],
  ] as const)
    for (const variant of variants)
      for (const state of states) {
        const root: UiNode = {
          id: "root",
          kind,
          variant,
          props: {
            label: "State target",
            ...(kind === "dialog" ? { open: true } : { disabled: state === "disabled" }),
          },
        };
        const target = (page: Page) => page.locator(`.lf_${kind}_${variant}_${slot}`).first();
        result[`${kind}.${variant}.${state}`] = {
          tree: tree(`state-${kind}-${variant}-${state}`, root),
          target,
          ...(state === "focus" || state === "hover" || state === "active"
            ? {
                async drive(page: Page) {
                  if (state === "focus") {
                    await page.keyboard.press("Tab");
                    await target(page).focus();
                  } else {
                    await target(page).hover();
                    if (state === "active") await page.mouse.down();
                  }
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
    {
      tree: interaction,
      async act(page: Page) {
        await draftBox(page).fill("draft");
        await draftBox(page).press("Enter");
      },
      intents: [{ type: "setState", key: "query", value: "draft" }, notify("draft")],
    },
  ],
  survival: { tree: interaction, next, focus: draftBox, input: draftBox },
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
      @keyframes demo-exit { from { opacity: 1 } to { opacity: 0 } }
      .lf_dialog_default_backdrop[data-exiting] { animation: demo-exit 400ms linear }
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

export { pageOptions };
