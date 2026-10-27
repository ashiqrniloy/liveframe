import { createPortal, flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import type { Intent, UiTree } from "../../index.ts";
import type { ImplementationProps } from "../../react/index.ts";
import { createRenderer, implement } from "../../react/index.ts";
import * as form from "./object-events.ts";
import { ObjectForm } from "./object-form.tsx";
import agentHome from "./proof/agent-home.tree.json" with { type: "json" };
import { catalog, hydrationTree, renderer, surfaceProps, tree, validator } from "./react-surface.tsx";

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
let normalStyle = styles[0];

const firstPortals: Record<string, boolean> = {};
let button: ImplementationProps | undefined;
const { Surface } = renderer((kind, props) => {
  firstPortals[kind] ??= props.portal !== undefined;
  if (kind === "button") button = props;
});
let intents: Intent[] = [];
let onIntent = intents.push.bind(intents);
const container = document.getElementById("app");
if (!container) throw new Error("Missing app");
const mode = new URL(location.href).searchParams.get("ssr");
const hydrationErrors: string[] = [];
const serverNodes = [...container.querySelectorAll("*")];
let checks = 0;
const checkedValidator = {
  ...validator,
  validateTree: (...args: Parameters<typeof validator.validateTree>) => {
    checks++;
    return validator.validateTree(...args);
  },
};
let input: unknown = mode ? hydrationTree(mode) : tree();
let currentValidator = checkedValidator;
const root = mode
  ? hydrateRoot(
      container,
      <Surface {...surfaceProps} validator={currentValidator} tree={input} onIntent={onIntent} />,
      { onCaughtError: () => {}, onRecoverableError: (error) => hydrationErrors.push(String(error)) },
    )
  : createRoot(container, { onCaughtError: () => {} });
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
    root.render(
      <Surface {...surfaceProps} {...normalStyle} validator={currentValidator} tree={input} onIntent={onIntent} />,
    ),
  );
}
declare global {
  interface Window {
    surfaceTest: {
      update(value: unknown): void;
      redraw(): void;
      replaceValidator(): void;
      checks(): number;
      hydration(): { errors: string[]; firstPortals: Record<string, boolean>; retained: boolean };
      intents(): readonly Intent[];
      emit(): void;
      replaceIntentHandler(): void;
      tree(revision?: number, surfaceId?: string): UiTree;
      mountSwitching(): void;
      mountForm(): void;
      switchStyles(index: number, theme: string, designSystem?: string, version?: string): void;
      renders(): number;
      unmount(): void;
      setScope(system: string): void;
    };
  }
}
window.surfaceTest = {
  mountForm() {
    const { Surface: FormSurface } = createRenderer({
      catalog: form.catalog,
      implementations: form.catalog.definitions.map((definition) => implement(definition, ObjectForm)),
    });
    flushSync(() =>
      root.render(
        <FormSurface {...surfaceProps} validator={form.validator} tree={form.formTree()} onIntent={onIntent} />,
      ),
    );
  },
  setScope(system) {
    normalStyle = { theme: { id: system, version: "1.0.0" }, designSystem: { id: system, version: "1.0.0" } };
    draw();
  },
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
  hydration: () => ({
    errors: hydrationErrors,
    firstPortals,
    retained: serverNodes.every((node) => container.contains(node)),
  }),
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
if (!mode) draw();
