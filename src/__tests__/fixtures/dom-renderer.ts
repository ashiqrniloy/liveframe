// A renderer for plain DOM built only on `@arnilo/liveframe/surface`: no React, no framework. It exists to
// prove the surface core is enough to write a second renderer (plan 029 Task 4), and it is not shipped.
// Every kind draws as the same generic element: the root slot's classes and style around one empty span per
// other slot and the children, so a test can compare its structure with `/react`'s.
import type { Catalog } from "../../formats/catalog.ts";
import type { CompiledValidator, Intent, IntentOrigin } from "../../index.ts";
import { createSurfaceCore, type NodeContext, type SurfaceCore } from "../../surface/index.ts";

/** The attribute that carries an element's effective props, so a test can compare bound values. */
export const PROPS_ATTRIBUTE = "data-props";

function hyphenated(name: string): string {
  return name.startsWith("--") ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

export type DomSurface = {
  readonly core: SurfaceCore;
  /** Accepts an arrival and draws the result; an invalid arrival draws the fallback. */
  update(tree: unknown): void;
  dispose(): void;
};

export function createDomSurface(options: {
  readonly catalog: Catalog;
  readonly validator: CompiledValidator;
  readonly container: Element;
  readonly onIntent?: (intent: Intent, origin: IntentOrigin) => unknown;
  readonly fallback?: () => Element;
}): DomSurface {
  const { catalog, container } = options;
  const slots = new Map(catalog.definitions.map((definition) => [definition.kind, definition.slots]));
  const core = createSurfaceCore({
    catalog,
    validator: options.validator,
    onIntent: options.onIntent ?? (() => undefined),
  });
  const fallback =
    options.fallback ?? (() => Object.assign(document.createElement("p"), { textContent: "Unavailable" }));

  function element(context: NodeContext): Element {
    if (context.fault) return fallback();
    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    wrapper.setAttribute("data-lf-node", context.id);
    const root = document.createElement("div");
    root.className = context.slot("root");
    for (const [name, value] of Object.entries(context.style)) root.style.setProperty(hyphenated(name), value);
    root.setAttribute(PROPS_ATTRIBUTE, JSON.stringify(context.props));
    for (const slot of slots.get(context.kind) ?? []) {
      if (slot === "root") continue;
      const part = document.createElement("span");
      part.className = context.slot(slot);
      root.append(part);
    }
    for (const item of context.items) root.append(element(item));
    wrapper.append(root);
    return wrapper;
  }

  function draw(): void {
    const { valid, root } = core.snapshot();
    container.replaceChildren(...(valid ? (root ? [element(root)] : []) : [fallback()]));
  }

  const unsubscribe = core.subscribe(draw);
  const detach = core.attach();
  return {
    core,
    update(tree) {
      core.accept(tree);
      draw();
    },
    dispose() {
      unsubscribe();
      detach();
      container.replaceChildren();
    },
  };
}
