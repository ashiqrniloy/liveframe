import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Intent, UiTree } from "../../index.ts";
import type { ImplementationProps } from "../../react/index.ts";
import { createRenderer, implement } from "../../react/index.ts";
import agentHome from "./proof/agent-home.tree.json" with { type: "json" };
import { catalog, renderer, surfaceProps, tree, validator } from "./react-surface.tsx";

let renders = 0;
const switchingRenderer = createRenderer({
  catalog,
  implementations: catalog.definitions.map((definition) =>
    implement(definition, (input) => {
      renders++;
      if (definition.kind === "button")
        return (
          <button type="button" className={input.slot("root")} style={input.style}>
            {String(input.props.label)}
          </button>
        );
      if (definition.kind === "dialog")
        return input.portal
          ? createPortal(
              <div className={input.slot("root")} data-open="">
                <div className={input.slot("backdrop")} />
                <div role="dialog" aria-label="Scope proof" className={input.slot("content")}>
                  {input.children}
                </div>
              </div>,
              input.portal,
            )
          : null;
      return (
        <div className={input.slot("root")} style={input.style}>
          {input.props.text as string | undefined}
          {input.children}
        </div>
      );
    }),
  ),
});
const switchTree: UiTree = {
  ...(agentHome as UiTree),
  root: {
    ...(agentHome as UiTree).root,
    children: [
      ...((agentHome as UiTree).root.children ?? []),
      {
        id: "root/scope-dialog",
        kind: "dialog",
        props: { label: "Scope proof", open: true },
        children: [
          { id: "root/scope-dialog/button", kind: "button", variant: "primary", props: { label: "Overlay focus" } },
        ],
      },
    ],
  },
};
const styles = [
  { theme: surfaceProps.theme, designSystem: surfaceProps.designSystem },
  { theme: { id: "rack", version: "1.0.0" }, designSystem: { id: "rack", version: "1.0.0" } },
];
let switching = false;

let button: ImplementationProps | undefined;
const { Surface } = renderer((kind, props) => {
  if (kind === "button") button = props;
});
let intents: Intent[] = [];
let onIntent = intents.push.bind(intents);
const container = document.getElementById("app");
if (!container) throw new Error("Missing app");
const root = createRoot(container, { onCaughtError: () => {} });
let checks = 0;
const checkedValidator = {
  ...validator,
  validateTree: (...args: Parameters<typeof validator.validateTree>) => {
    checks++;
    return validator.validateTree(...args);
  },
};
let input: unknown = tree();
let currentValidator = checkedValidator;
function draw() {
  if (switching) {
    const SwitchSurface = switchingRenderer.Surface;
    flushSync(() =>
      root.render(
        styles.map((style, i) => (
          <section key={i ? "b" : "a"} id={i ? "b" : "a"}>
            <SwitchSurface {...surfaceProps} {...style} tree={switchTree} />
          </section>
        )),
      ),
    );
    return;
  }
  flushSync(() =>
    root.render(<Surface {...surfaceProps} validator={currentValidator} tree={input} onIntent={onIntent} />),
  );
}
declare global {
  interface Window {
    surfaceTest: {
      update(value: unknown): void;
      redraw(): void;
      replaceValidator(): void;
      checks(): number;
      intents(): readonly Intent[];
      emit(): void;
      replaceIntentHandler(): void;
      tree(revision?: number, surfaceId?: string): UiTree;
      mountSwitching(): void;
      switchStyles(index: number, theme: string, designSystem?: string, version?: string): void;
      renders(): number;
      unmount(): void;
    };
  }
}
window.surfaceTest = {
  update(value) {
    input = value;
    draw();
  },
  redraw: draw,
  replaceValidator() {
    currentValidator = { ...checkedValidator };
    draw();
  },
  checks: () => checks,
  intents: () => intents,
  emit: () => button?.emit("onPress"),
  replaceIntentHandler() {
    intents = [];
    onIntent = intents.push.bind(intents);
    draw();
  },
  tree,
  mountSwitching() {
    switching = true;
    draw();
  },
  switchStyles(index, theme, designSystem = theme, version = "1.0.0") {
    styles[index] = { theme: { id: theme, version }, designSystem: { id: designSystem, version } };
    draw();
  },
  renders: () => renders,
  unmount() {
    flushSync(() => root.unmount());
  },
};
draw();
