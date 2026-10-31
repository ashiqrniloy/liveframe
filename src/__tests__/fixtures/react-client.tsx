import { createPortal, flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { applyPatch, compileValidator, type Intent, type TreePatch, type UiTree } from "../../index.ts";
import type { ImplementationProps } from "../../react/index.ts";
import { createRenderer, implement } from "../../react/index.ts";
import * as form from "./object-events.ts";
import { ObjectForm } from "./object-form.tsx";
import { installConfirmation } from "./confirmation.tsx";
import agentHome from "./proof/agent-home.tree.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
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
          {
            id: "root/scope-dialog/responsive",
            kind: "stack",
            props: {},
            style: { gap: { base: "space.1", "bp.md": "space.4" } },
          },
        ],
      },
    ],
  },
};
const styles: {
  theme: { id: string; version: string };
  designSystem: { id: string; version: string };
  transparency?: "auto" | "reduced";
}[] = [
  { theme: surfaceProps.theme, designSystem: surfaceProps.designSystem },
  { theme: { id: "rack", version: "1.0.0" }, designSystem: { id: "rack", version: "1.0.0" } },
];
let switching = false;
let normalStyle = styles[0];
let fallback = surfaceProps.fallback;
let diagnostics: readonly import("../../index.ts").LiveframeError[] | undefined;

const firstPortals: Record<string, boolean> = {};
let button: ImplementationProps | undefined;
const nodeRenders: Record<string, number> = {};
let rootItems: readonly import("../../react/index.ts").Item[] = [];
const { Surface } = renderer((kind, props) => {
  nodeRenders[kind] = (nodeRenders[kind] ?? 0) + 1;
  if (kind === "stack") rootItems = props.items;
  firstPortals[kind] ??= props.portal !== undefined;
  if (kind === "button") button = props;
});
let intents: Intent[] = [];
const origins: import("../../index.ts").IntentOrigin[] = [];
let onIntent = (intent: Intent, origin: import("../../index.ts").IntentOrigin) => {
  intents.push(intent);
  origins.push(origin);
};
const container = document.getElementById("app");
if (!container) throw new Error("Missing app");
const mode = new URL(location.href).searchParams.get("ssr");
const hydrationErrors: string[] = [];
const serverNodes = [...container.querySelectorAll("*")];
let checks = 0;
function countingValidator() {
  const compiled = compileValidator({ catalog, capabilities, manifest });
  return Object.assign(compiled, {
    validateTree: (...args: Parameters<typeof validator.validateTree>) => {
      checks++;
      return validator.validateTree(...args);
    },
  });
}
const checkedValidator = countingValidator();
let input: unknown = mode ? hydrationTree(mode) : tree();
let currentValidator = checkedValidator;
const root = mode
  ? hydrateRoot(
      container,
      <Surface
        {...surfaceProps}
        validator={currentValidator}
        tree={input}
        onIntent={onIntent}
        fallback={fallback}
        {...(diagnostics ? { diagnostics } : {})}
      />,
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
            <SwitchSurface
              {...surfaceProps}
              {...style}
              tree={switchTree}
              wrapperProps={{ className: "host-scope", style: { minHeight: 0 } }}
              portalProps={{ className: "host-scope" }}
            />
          </section>
        )),
      ),
    );
    return;
  }
  flushSync(() =>
    root.render(
      <Surface
        {...surfaceProps}
        {...normalStyle}
        validator={currentValidator}
        tree={input}
        onIntent={onIntent}
        fallback={fallback}
        {...(diagnostics ? { diagnostics } : {})}
      />,
    ),
  );
}
declare global {
  interface Window {
    surfaceTest: {
      presentation(message: string, errors?: readonly import("../../index.ts").LiveframeError[]): void;
      patch(value: TreePatch): void;
      reuse(): { renders: Record<string, number>; items: boolean; elements: boolean };
      update(value: unknown): void;
      redraw(): void;
      replaceValidator(): void;
      checks(): number;
      hydration(): { errors: string[]; firstPortals: Record<string, boolean>; retained: boolean };
      intents(): readonly Intent[];
      origins(): readonly import("../../index.ts").IntentOrigin[];
      emit(): void;
      replaceIntentHandler(): void;
      tree(revision?: number, surfaceId?: string): UiTree;
      mountSwitching(): void;
      mountForm(): void;
      switchStyles(index: number, theme: string, designSystem?: string, version?: string): void;
      setTransparency(index: number, value: "auto" | "reduced"): void;
      renders(): number;
      unmount(): void;
      setScope(system: string): void;
    };
  }
}
let previousItems = rootItems;
window.surfaceTest = {
  presentation(message, errors) {
    fallback = <p>{message}</p>;
    diagnostics = errors;
    draw();
  },
  patch(value) {
    previousItems = rootItems;
    for (const key of Object.keys(nodeRenders)) nodeRenders[key] = 0;
    const result = applyPatch(input as UiTree, value);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    input = result.value;
    draw();
  },
  reuse: () => ({
    renders: { ...nodeRenders },
    items: rootItems.slice(1).every((item, i) => item === previousItems[i + 1]),
    elements: rootItems.slice(1).every((item, i) => item.render() === previousItems[i + 1]?.render()),
  }),
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
    currentValidator = countingValidator();
    draw();
  },
  checks: () => checks,
  hydration: () => ({
    errors: hydrationErrors,
    firstPortals,
    retained: serverNodes.every((node) => container.contains(node)),
  }),
  intents: () => intents,
  origins: () => origins,
  emit: () => button?.emit("onPress"),
  replaceIntentHandler() {
    intents = [];
    onIntent = (intent, origin) => {
      intents.push(intent);
      origins.push(origin);
    };
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
  setTransparency(index, value) {
    styles[index] = { ...styles[index]!, transparency: value };
    draw();
  },
  renders: () => renders,
  unmount() {
    flushSync(() => root.unmount());
  },
};
installConfirmation(root);
if (!mode) draw();
