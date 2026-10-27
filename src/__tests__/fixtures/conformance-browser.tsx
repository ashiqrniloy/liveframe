import type { Page } from "playwright";
import { createContext, useContext, useEffect, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import { type Definition, type Result, type UiTree, validateDesignSystem, validateTheme } from "../../index.ts";
import { implement } from "../../react/index.ts";
import { catalog, capabilities, manifest, formTree } from "./object-events.ts";
import { ObjectForm } from "./object-form.tsx";
import certifiedSystem from "./proof/certified.design-system.json" with { type: "json" };
import certifiedTheme from "./proof/certified.theme.json" with { type: "json" };
import rackSystem from "./proof/rack.design-system.json" with { type: "json" };
import rackTheme from "./proof/rack.theme.json" with { type: "json" };
import { tree } from "./react-surface.tsx";

const ThemeContext = createContext("");
export function implementations(mode = "") {
  return catalog.definitions.map((definition) =>
    // biome-ignore lint/correctness/noComponentHookFactories: Test bindings are created once before mounting.
    implement<Definition>(definition, function Primitive(input) {
      const [draft, setDraft] = useState(String(input.props.value ?? ""));
      const [open, setOpen] = useState(Boolean(input.props.open));
      useEffect(() => setOpen(Boolean(input.props.open)), [input.props.open]);
      const [theme, setTheme] = useState("");
      const context = useContext(ThemeContext);
      useEffect(() => {
        if (mode !== "context" || definition.kind !== "stack") return;
        const observer = new MutationObserver(() =>
          setTheme(document.querySelector("[data-lf-theme]")?.getAttribute("data-lf-theme") ?? ""),
        );
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ["data-lf-theme", "data-lf-ds"],
        });
        return () => observer.disconnect();
      }, []);
      if (definition.kind === "stack" && input.props.semantics === "form") return <ObjectForm {...input} />;
      if (definition.kind === "textField")
        return (
          <input
            aria-label={String(input.props.label)}
            value={draft}
            maxLength={mode === "utf16" ? Number(input.props.maxLength) : undefined}
            onChange={(e) => {
              if (
                input.props.maxLength === undefined ||
                Array.from(e.target.value).length <= Number(input.props.maxLength)
              ) {
                setDraft(e.target.value);
                if (mode === "live-change") input.emit("onChange", e.target.value);
              }
            }}
            onBlur={() => {
              if (mode !== "live-change") input.emit("onChange", mode === "text-intent" ? "wrong" : draft);
            }}
            className={input.slot("root")}
            style={input.style}
          />
        );
      if (definition.kind === "dialog")
        return (
          <div className={input.slot("root")} style={input.style}>
            {mode === "nonmodal" ? (
              open && (
                <div
                  role="dialog"
                  tabIndex={-1}
                  aria-label={String(input.props.label)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setOpen(false);
                  }}
                >
                  Overlay content{input.children}
                </div>
              )
            ) : mode === "instant-exit" && !open ? null : (
              <ModalOverlay
                {...(mode === "scope"
                  ? { UNSTABLE_portalContainer: document.body }
                  : input.portal
                    ? { UNSTABLE_portalContainer: input.portal }
                    : {})}
                isOpen={open}
                onOpenChange={setOpen}
                className={input.slot("backdrop")}
              >
                <Modal>
                  <Dialog aria-label={String(input.props.label)}>Overlay content{input.children}</Dialog>
                </Modal>
              </ModalOverlay>
            )}
          </div>
        );
      if (definition.kind === "button")
        return (
          <button
            type="button"
            className={input.slot("root")}
            style={input.style}
            data-context={context}
            data-selected={mode !== "selected" && input.props.pressed ? "" : undefined}
            onClick={() => {
              input.emit(mode === "undeclared" ? "missing" : "onPress", mode === "wrong-value" ? "bad" : undefined);
            }}
          >
            {String(input.props.label)}
            {mode === "hydration" && typeof window !== "undefined" ? " client" : ""}
          </button>
        );
      return (
        <ThemeContext value={theme}>
          <div className={input.slot("root")} style={input.style}>
            {definition.kind === "stack" && mode === "index"
              ? input.items.map((item, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Deliberately broken implementation proves the survival case.
                  <div key={i}>{item.render()}</div>
                ))
              : input.children}
            {input.props.text as string | undefined}
          </div>
        </ThemeContext>
      );
    }),
  );
}
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
export const pageOptions = {
  catalog,
  capabilities,
  manifest,
  implementations: implementations(),
  themes: [certifiedTheme, rackTheme].map((theme) => value(validateTheme(theme, catalog.vocabulary))),
  designSystems: [certifiedSystem, rackSystem].map((system) =>
    value(validateDesignSystem(system, { catalog, registry: {} })),
  ),
  fallback: "Unavailable",
};
const current: UiTree = {
  ...tree(),
  root: {
    id: "root",
    kind: "stack",
    props: {},
    children: [
      { id: "root/draft", kind: "textField", props: { label: "Draft", value: "initial" } },
      { id: "root/other", kind: "textField", props: { label: "Other", value: "other" } },
      {
        id: "root/save",
        kind: "button",
        props: { label: "Save" },
        events: { onPress: { type: "setState", key: "reason", value: "saved" } },
      },
    ],
  },
};
const focus = (p: Page) => p.getByRole("textbox", { name: "Draft", exact: true });
const overlayTree: UiTree = {
  ...current,
  surfaceId: "overlay",
  root: {
    ...current.root,
    children: [
      ...(current.root.children ?? []),
      { id: "root/dialog", kind: "dialog", props: { label: "Overlay", open: false } },
    ],
  },
};
export const overlayFixtures = [
  {
    kind: "dialog",
    tree: overlayTree,
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
      }, JSON.stringify(overlayTree));
      await p.getByRole("dialog", { name: "Overlay" }).focus();
    },
    close: (p: Page) => p.keyboard.press("Escape"),
    content: (p: Page) => p.getByRole("dialog", { name: "Overlay", includeHidden: true }),
    backdrop: (p: Page) => p.locator(".lf_dialog_default_backdrop"),
    background: (p: Page) => p.getByRole("button", { name: "Save", exact: true, includeHidden: true }),
    exitCss: `
    .lf_dialog_default_backdrop { position: fixed; inset: 0; display: grid; place-items: center }
    @keyframes conformance-exit { from { opacity: 1 } to { opacity: 0 } }
    .lf_dialog_default_backdrop[data-exiting] { animation: conformance-exit 400ms linear }
    @media (prefers-reduced-motion: reduce) { .lf_dialog_default_backdrop[data-exiting] { animation: none } }
  `,
  },
];
export const textFixtures = [
  {
    kind: "textField",
    tree: {
      ...current,
      surfaceId: "text-bound",
      root: {
        id: "root",
        kind: "textField",
        props: { label: "Bound", value: "", maxLength: 3 },
        events: { onChange: { type: "setState", key: "reason" } },
      },
    },
    field: (p: Page) => p.getByRole("textbox", { name: "Bound" }),
    maxLength: 3,
  },
] satisfies { kind: string; tree: UiTree; field: (p: Page) => import("playwright").Locator; maxLength: number }[];
export const fixtures = {
  interactions: [
    {
      tree: formTree(),
      act: async (p: Page) => {
        await p.getByRole("textbox", { name: "Reason" }).fill("current fields");
        await p.getByRole("checkbox", { name: "Confirm" }).check();
        await p.getByRole("button", { name: "Submit fields" }).click();
      },
      intents: [{ type: "action", name: "form.submit", args: { id: "row", reason: "current fields", confirm: true } }],
    },
    {
      tree: current,
      act: (p: Page) => p.getByRole("button", { name: "Save", exact: true }).click(),
      intents: [{ type: "setState", key: "reason", value: "saved" }],
    },
  ],
  survival: {
    tree: current,
    next: {
      ...current,
      revision: 3,
      root: { ...current.root, children: [...(current.root.children ?? [])].reverse() },
    },
    focus,
    input: focus,
  },
};
export const examples = [current];
