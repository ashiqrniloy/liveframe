import type { Page } from "playwright";
import { createContext, useContext, useEffect, useState } from "react";
import { type Result, type UiTree, validateDesignSystem, validateTheme } from "../../index.ts";
import { implement } from "../../react/index.ts";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import certifiedSystem from "./proof/certified.design-system.json" with { type: "json" };
import certifiedTheme from "./proof/certified.theme.json" with { type: "json" };
import rackSystem from "./proof/rack.design-system.json" with { type: "json" };
import rackTheme from "./proof/rack.theme.json" with { type: "json" };
import { catalog, tree } from "./react-surface.tsx";

const ThemeContext = createContext("");
export function implementations(mode = "") {
  return catalog.definitions.map((definition) =>
    // biome-ignore lint/correctness/noComponentHookFactories: Test bindings are created once before mounting.
    implement(definition, function Primitive(input) {
      const [draft, setDraft] = useState(String(input.props.value ?? ""));
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
      if (definition.kind === "textField")
        return (
          <input
            aria-label={String(input.props.label)}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={input.slot("root")}
            style={input.style}
          />
        );
      if (definition.kind === "button")
        return (
          <button
            type="button"
            className={input.slot("root")}
            style={input.style}
            data-context={context}
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
export const fixtures = {
  interactions: [
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
