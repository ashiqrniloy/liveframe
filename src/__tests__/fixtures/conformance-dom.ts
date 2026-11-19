// DOM implementations of the conformance fixture catalog, written as an app would write them on `/dom`, and the
// page options of `conformance-dom-client.ts`. Each `mode` is one broken subject a shared case must catch.
import { type DomImplementation, type DomNode, implement, place } from "../../dom/index.ts";
import {
  bool,
  type Definition,
  type IntentOrigin,
  type Json,
  obj,
  type Result,
  str,
  validateDesignSystem,
  validateTheme,
} from "../../index.ts";
import { capabilities, catalog, manifest as formManifest } from "./object-events.ts";
import certifiedSystem from "./proof/certified.design-system.json" with { type: "json" };
import certifiedTheme from "./proof/certified.theme.json" with { type: "json" };
import rackSystem from "./proof/rack.design-system.json" with { type: "json" };
import rackTheme from "./proof/rack.theme.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

/** What the `forward-local` subject sends to the host: the `setLocal` intents its buttons raise. */
export const forwarded: { intent: unknown; origin: IntentOrigin }[] = [];

type Node = DomNode<Definition, Record<string, Json>>;
const fallback = () => Object.assign(document.createElement("p"), { textContent: "Unavailable" });

/** Root slot class and style-prop declarations, written on every draw. */
function styled(element: HTMLElement, node: Node, mode: string): void {
  const root = node.slot("root");
  if (mode === "slot" && node.kind === "text") element.removeAttribute("class");
  else element.className = root;
  element.removeAttribute("style");
  for (const [name, value] of Object.entries(node.style)) element.style.setProperty(name, value);
}

/** The native form whose fields stay local until a submit, as the React fixture's `ObjectForm`. */
function form(node: Node, element: Element | undefined): Element {
  const root = (element as HTMLFormElement | undefined) ?? document.createElement("form");
  if (!element) {
    root.setAttribute("aria-label", "Commit fields");
    const reason = Object.assign(document.createElement("input"), { name: "reason", defaultValue: "initial" });
    const confirm = Object.assign(document.createElement("input"), { type: "checkbox", name: "confirm" });
    const label = (text: string, input: HTMLInputElement) => {
      const wrapper = document.createElement("label");
      wrapper.append(text, input);
      return wrapper;
    };
    const submit = Object.assign(document.createElement("button"), { type: "submit", textContent: "Submit fields" });
    root.append(label("Reason", reason), label("Confirm", confirm), submit);
    root.addEventListener("submit", (event) => {
      event.preventDefault();
      const fields = new FormData(root);
      node.emit("onSubmit", { reason: String(fields.get("reason") ?? ""), confirm: fields.has("confirm") });
    });
  }
  styled(root, node, "");
  return root;
}

/** A text field holding its own draft; it raises `onChange` with the draft on blur, bounded in code points. */
function textField(node: Node, element: Element | undefined, mode: string): Element {
  const input = (element as HTMLInputElement | undefined) ?? document.createElement("input");
  if (!element) {
    input.value = String(node.props.value ?? "");
    let last = input.value;
    input.addEventListener("input", () => {
      const max = node.props.maxLength;
      if (mode !== "utf16" && max !== undefined && Array.from(input.value).length > Number(max)) input.value = last;
      last = input.value;
    });
    input.addEventListener("blur", () => void node.emit("onChange", input.value));
  }
  if (mode === "no-dom-id") input.removeAttribute("id");
  else input.id = node.domId;
  input.setAttribute("aria-label", String(node.props.label));
  if (mode === "utf16" && node.props.maxLength !== undefined) input.maxLength = Number(node.props.maxLength);
  styled(input, node, mode);
  return input;
}

function button(node: Node, element: Element | undefined, mode: string): Element {
  const root = (element as HTMLButtonElement | undefined) ?? document.createElement("button");
  if (!element) {
    root.type = "button";
    root.addEventListener("click", () => {
      if (mode === "forward-local" && node.events.onPress?.type === "setLocal")
        forwarded.push({
          intent: { type: "setLocal", label: node.props.label },
          origin: { surfaceId: "local", revision: 1, nodeId: node.domId, event: "onPress" },
        });
      node.emit(mode === "undeclared" ? "missing" : "onPress", mode === "wrong-value" ? "bad" : undefined);
    });
  }
  root.textContent = String(node.props.label);
  root.toggleAttribute("data-selected", mode !== "selected" && Boolean(node.props.pressed));
  styled(root, node, mode);
  return root;
}

/** A modal dialog drawn into the surface's portal: scroll lock, inert background and an exit that plays out. */
type Overlay = { open: boolean; seen: boolean; backdrop: HTMLElement | undefined; close(): void };
const overlays = new WeakMap<Element, Overlay>();
function dialog(node: Node, element: Element | undefined, mode: string): Element {
  const root = (element as HTMLElement | undefined) ?? document.createElement("div");
  styled(root, node, mode);
  let overlay = overlays.get(root);
  if (!overlay) {
    const state: Overlay = {
      open: false,
      seen: false,
      backdrop: undefined,
      close() {
        const backdrop = state.backdrop;
        state.open = false;
        state.backdrop = undefined;
        if (!backdrop) return;
        document.documentElement.style.removeProperty("overflow");
        for (const sibling of node.portal.parentElement?.children ?? []) sibling.removeAttribute("inert");
        backdrop.setAttribute("data-exiting", "");
        if (mode === "instant-exit" || !backdrop.getAnimations().length) backdrop.remove();
        else backdrop.addEventListener("animationend", () => backdrop.remove(), { once: true });
      },
    };
    overlay = state;
    overlays.set(root, overlay);
  }
  // The `open` prop opens or closes it when it changes; Escape closes it locally.
  const open = Boolean(node.props.open);
  if (open !== overlay.seen) {
    overlay.seen = open;
    if (open && !overlay.open) {
      overlay.open = true;
      const backdrop = document.createElement("div");
      backdrop.className = node.slot("backdrop");
      const content = document.createElement("div");
      content.setAttribute("role", "dialog");
      content.tabIndex = -1;
      content.setAttribute("aria-label", String(node.props.label));
      content.append("Overlay content");
      const close = overlay.close;
      content.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
      backdrop.append(content);
      overlay.backdrop = backdrop;
      (mode === "scope" ? document.body : node.portal).append(backdrop);
      if (mode !== "no-lock") {
        document.documentElement.style.overflow = "hidden";
        for (const sibling of node.portal.parentElement?.children ?? [])
          if (sibling !== node.portal) sibling.setAttribute("inert", "");
      }
    } else if (!open && overlay.open) overlay.close();
  }
  return root;
}

/** Everything else: a box with its children and its `text`. */
function box(node: Node, element: Element | undefined, mode: string): Element {
  const root = (element as HTMLElement | undefined) ?? document.createElement("div");
  styled(root, node, mode);
  if (mode === "id" && node.kind === "hint") root.removeAttribute("id");
  else root.id = node.domId;
  let text = root.lastChild?.nodeType === 3 ? (root.lastChild as Text) : undefined;
  text ??= document.createTextNode("");
  text.data = typeof node.props.text === "string" ? node.props.text : "";
  const kept = stale.get(root) ?? new Map<string, Element>();
  if (mode === "stale-children" && node.kind === "stack") {
    // Keeps drawing children the renderer removed.
    for (const item of node.items) kept.set(item.id, item.render());
    stale.set(root, kept);
    place(root, [...kept.values(), text]);
  } else if (mode === "proxy-text" && node.kind === "stack")
    // Draws text children from their props instead of through the renderer, so a failed binding is ignored.
    place(root, [
      ...node.items.map((item) =>
        item.kind === "text"
          ? Object.assign(document.createElement("div"), { className: item.slot("root") })
          : item.render(),
      ),
      text,
    ]);
  else if (mode === "replace" && node.kind === "stack")
    // Draws copies of its children instead of the elements the renderer drew, so none survives a revision.
    place(root, [...node.children.map((child) => child.cloneNode(true)), text]);
  else place(root, [...node.children, text]);
  if (mode === "context" && node.kind === "stack" && !element) {
    // Re-creates its children when the scope changes, as a primitive reading the theme would.
    new MutationObserver(() => {
      for (const child of [...root.children]) child.replaceWith(child.cloneNode(true));
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lf-theme"] });
  }
  return root;
}
const stale = new WeakMap<Element, Map<string, Element>>();

export function domImplementations(mode = ""): DomImplementation[] {
  return catalog.definitions.map((definition) =>
    implement<Definition, Record<string, Json>>(
      definition,
      (node, element) => {
        if (mode === "throw" && definition.kind === "button") throw new Error("Broken button");
        if (definition.kind === "stack" && node.props.semantics === "form") return form(node, element);
        if (definition.kind === "textField") return textField(node, element, mode);
        if (definition.kind === "button") return button(node, element, mode);
        if (definition.kind === "dialog") return dialog(node, element, mode);
        return box(node, element, mode);
      },
      { dispose: (element) => overlays.get(element)?.close() },
    ),
  );
}

// Local state for the local, compound and fromLocal fixtures, as `conformance-browser.tsx` declares it.
const manifest = {
  ...formManifest,
  local: obj({ open: bool(), title: str({ maxLength: 80 }) }),
  initialLocal: { open: false, title: "" },
};
export const domPageOptions = {
  catalog,
  capabilities,
  manifest,
  themes: [certifiedTheme, rackTheme].map((theme) => value(validateTheme(theme, catalog.vocabulary))),
  designSystems: [certifiedSystem, rackSystem].map((system) =>
    value(validateDesignSystem(system, { catalog, registry: {} })),
  ),
  fallback,
};
