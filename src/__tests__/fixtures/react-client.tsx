import { StrictMode, startTransition, use, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { applyPatch, compileValidator, type Intent, type TreePatch, type UiNode, type UiTree } from "../../index.ts";
import type { ImplementationProps } from "../../react/index.ts";
import { createRenderer, implement } from "../../react/index.ts";
import { installConfirmation } from "./confirmation.tsx";
import * as form from "./object-events.ts";
import { ObjectForm } from "./object-form.tsx";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import agentHome from "./proof/agent-home.tree.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import { catalog, failing, hydrationTree, renderer, surfaceProps, tree, validator } from "./react-surface.tsx";

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
let continuity: boolean | undefined;
let invalidMode: "fallback" | "keep-last" | undefined;
let normalStyle = styles[0];
let fallback = surfaceProps.fallback;
// A host that writes `fallback={<p>…</p>}` inline hands Surface a new element on every parent render.
let inlineFallback = false;
let diagnostics: readonly import("../../index.ts").LiveframeError[] | undefined;
let currentLimits: import("../../index.ts").ValidateTreeOptions["limits"];

const firstPortals: Record<string, boolean> = {};
const withoutPortal = new Set<string>();
let button: ImplementationProps | undefined;
const nodeRenders: Record<string, number> = {};
let rootItems: readonly import("../../react/index.ts").Item[] = [];
const { Surface } = renderer((kind, props) => {
  nodeRenders[kind] = (nodeRenders[kind] ?? 0) + 1;
  if (kind === "stack") rootItems = props.items;
  firstPortals[kind] ??= props.portal !== undefined;
  if (props.portal === undefined) withoutPortal.add(kind);
  if (kind === "button") button = props;
});
let intents: Intent[] = [];
const events: import("../../surface/index.ts").SurfaceEvent[] = [];
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
function begin(value: unknown) {
  previousItems = rootItems;
  for (const key of Object.keys(nodeRenders)) nodeRenders[key] = 0;
  input = value;
  draw();
}
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
        {...(continuity === undefined ? {} : { focusContinuity: continuity })}
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
        onEvent={(event) => void events.push(event)}
        fallback={inlineFallback ? <p>Unavailable</p> : fallback}
        {...(currentLimits === undefined ? {} : { limits: currentLimits })}
        {...(continuity === undefined ? {} : { focusContinuity: continuity })}
        {...(invalidMode === undefined ? {} : { invalid: invalidMode })}
        {...(diagnostics ? { diagnostics } : {})}
      />,
    ),
  );
}
declare global {
  interface Window {
    surfaceTest: {
      presentation(message: string, errors?: readonly import("../../index.ts").LiveframeError[]): void;
      setInlineFallback(on: boolean): void;
      patch(value: TreePatch): void;
      arrive(value: unknown): void;
      failText(broken: boolean): void;
      setFocusContinuity(on: boolean): void;
      setInvalidMode(mode: "fallback" | "keep-last"): void;
      reuse(): { renders: Record<string, number>; items: boolean; elements: boolean };
      update(value: unknown): void;
      updateWithLimits(value: unknown, limits: import("../../index.ts").ValidateTreeOptions["limits"]): void;
      redraw(): void;
      replaceValidator(): void;
      checks(): number;
      hydration(): { errors: string[]; firstPortals: Record<string, boolean>; retained: boolean };
      intents(): readonly Intent[];
      events(): readonly import("../../surface/index.ts").SurfaceEvent[];
      origins(): readonly import("../../index.ts").IntentOrigin[];
      emit(): void;
      replaceIntentHandler(): void;
      tree(revision?: number, surfaceId?: string): UiTree;
      mountSwitching(): void;
      mountForm(): void;
      /** A list filtered by local state, with an empty row that reads `shown`; buttons write the filter. */
      mountFiltered(): void;
      /** Two sibling surfaces, `#a` and `#b`, each drawing its own tree. */
      mountPair(a: unknown, b: unknown): void;
      arrivePair(index: number, value: unknown): void;
      switchStyles(index: number, theme: string, designSystem?: string, version?: string): void;
      setTransparency(index: number, value: "auto" | "reduced"): void;
      renders(): number;
      clientMount(mode?: "valid" | "invalid"): Promise<{
        renders: Record<string, number>;
        withoutPortal: string[];
        frames: ("empty" | "wrapper" | "drawn" | "fallback")[];
        text: string;
      }>;
      unmount(): void;
      mountTransition(strict?: boolean): void;
      transitionTo(revision: number, surfaceId: string): Promise<void>;
      interrupt(label: string): void;
      setScope(system: string): void;
    };
  }
}
// A host that holds `tree` in state. A transition to the held tree suspends forever, so its render runs but
// never commits, and an urgent update can interrupt it.
let held: unknown;
let hostTree: (value: unknown) => void = () => {};
let hostLabel: (value: string) => void = () => {};
const never = new Promise<never>(() => {});
function Gate({ value }: { value: unknown }) {
  if (value === held) use(never);
  return null;
}
function TransitionHost({ initial }: { initial: unknown }) {
  const [value, setValue] = useState(initial);
  const [label, setLabel] = useState("idle");
  hostTree = setValue;
  hostLabel = setLabel;
  return (
    <>
      <p data-host-label="">{label}</p>
      <Surface {...surfaceProps} validator={checkedValidator} tree={value} onIntent={onIntent} />
      <Gate value={value} />
    </>
  );
}
function pressable(revision: number, surfaceId: string): UiTree {
  const value = tree(revision, surfaceId);
  const [first, second] = value.root.children ?? [];
  if (!first || !second) throw new Error("Missing children");
  return {
    ...value,
    root: {
      ...value.root,
      children: [first, { ...second, events: { onPress: { type: "setState", key: "reason", value: "pressed" } } }],
    },
  };
}
let previousItems = rootItems;
const pair: unknown[] = [];
function drawPair() {
  flushSync(() =>
    root.render(
      pair.map((value, i) => (
        <section key={i ? "b" : "a"} id={i ? "b" : "a"}>
          <Surface
            {...surfaceProps}
            validator={checkedValidator}
            tree={value}
            onIntent={onIntent}
            onEvent={(event) => void events.push(event)}
          />
        </section>
      )),
    ),
  );
}
window.surfaceTest = {
  presentation(message, errors) {
    fallback = <p>{message}</p>;
    diagnostics = errors;
    for (const key of Object.keys(nodeRenders)) nodeRenders[key] = 0;
    draw();
  },
  setInlineFallback(on) {
    inlineFallback = on;
  },
  patch(value) {
    const result = applyPatch(input as UiTree, value);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    begin(result.value);
  },
  arrive(value) {
    begin(value);
  },
  failText(broken) {
    failing.text = broken;
  },
  setFocusContinuity(on) {
    continuity = on;
    draw();
  },
  setInvalidMode(mode) {
    invalidMode = mode;
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
  mountFiltered() {
    const filterManifest = {
      ...manifest,
      local: {
        type: "object",
        properties: { q: { type: "string", maxLength: 16 } },
        required: ["q"],
        additionalProperties: false,
      },
      initialLocal: { q: "" },
    };
    const filterValidator = compileValidator({ catalog, capabilities, manifest: filterManifest });
    const filter = (label: string, q: string): UiNode => ({
      id: `root/show-${label}`,
      kind: "button",
      props: { label },
      events: { onPress: { type: "setLocal", key: "q", value: q } },
    });
    const row = (name: string): UiNode => ({
      id: `root/${name}`,
      kind: "text",
      props: { text: name },
      when: { $contains: [name, { $path: "local.q" }] },
    });
    const filtered: UiTree = {
      ...tree(1, "filtered"),
      root: {
        id: "root",
        kind: "stack",
        props: {},
        children: [
          filter("none", "zzz"),
          filter("alpha", "alp"),
          row("alpha"),
          row("beta"),
          { id: "root/empty", kind: "text", props: { text: "No matches" }, when: { $eq: [{ $path: "shown" }, 0] } },
        ],
      },
    };
    flushSync(() =>
      root.render(<Surface {...surfaceProps} validator={filterValidator} tree={filtered} onIntent={onIntent} />),
    );
  },
  mountPair(a, b) {
    pair.splice(0, pair.length, a, b);
    drawPair();
  },
  arrivePair(index, value) {
    pair[index] = value;
    drawPair();
  },
  setScope(system) {
    normalStyle = { theme: { id: system, version: "1.0.0" }, designSystem: { id: system, version: "1.0.0" } };
    draw();
  },
  update(value) {
    input = value;
    draw();
  },
  updateWithLimits(value, limits) {
    currentLimits = limits;
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
  events: () => events,
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
  async clientMount(mode = "valid") {
    // A fresh, non-hydrating root; every frame before paint records what the browser would show.
    for (const key of Object.keys(nodeRenders)) nodeRenders[key] = 0;
    withoutPortal.clear();
    const target = document.createElement("div");
    document.body.append(target);
    const frames: ("empty" | "wrapper" | "drawn" | "fallback")[] = [];
    const observe = () =>
      frames.push(
        target.querySelector("button, [role=dialog]")
          ? "drawn"
          : target.textContent?.includes("Unavailable")
            ? "fallback"
            : target.firstElementChild
              ? "wrapper"
              : "empty",
      );
    let watching = true;
    const loop = () => {
      observe();
      if (watching) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const fresh = createRoot(target);
    fresh.render(<Surface {...surfaceProps} tree={hydrationTree(mode)} />);
    while (!frames.includes("drawn") && !frames.includes("fallback")) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    watching = false;
    const text = target.textContent ?? "";
    fresh.unmount();
    target.remove();
    return { renders: { ...nodeRenders }, withoutPortal: [...withoutPortal], frames, text };
  },
  unmount() {
    flushSync(() => root.unmount());
  },
  mountTransition(strict = false) {
    const host = <TransitionHost initial={pressable(1, "a")} />;
    flushSync(() => root.render(strict ? <StrictMode>{host}</StrictMode> : host));
  },
  async transitionTo(revision, surfaceId) {
    // Resolves once the transition's render has validated the new tree, which it never commits.
    const before = checks;
    held = pressable(revision, surfaceId);
    startTransition(() => hostTree(held));
    while (checks === before) await new Promise((resolve) => setTimeout(resolve, 5));
  },
  interrupt(label) {
    flushSync(() => hostLabel(label));
  },
};
installConfirmation(root);
if (!mode) draw();
