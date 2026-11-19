// DOM implementations for every kind of a catalog, on the shipped `/dom` adapter. Every kind draws as the same
// generic element: the root slot's classes and style around one empty span per other slot and the children, so a
// test can compare its structure with `/react`'s (whose fixture draws the same, inside `diagnostics`' wrapper).
import { type DomImplementation, implement, place } from "../../dom/index.ts";
import type { Catalog } from "../../formats/catalog.ts";
import type { Json } from "../../index.ts";

/** The attribute that carries an element's effective props, so a test can compare bound values. */
export const PROPS_ATTRIBUTE = "data-props";

type Emit = (event: string, value?: Json) => Promise<void> | undefined;

/**
 * Draws each kind generically; `emitters` receives each drawn node's `emit`, keyed by node id, and `draws` each
 * call's node id. A node whose id is in `throwing` throws instead of drawing.
 */
export function domImplementations(
  catalog: Catalog,
  emitters?: Map<string, Emit>,
  draws?: string[],
  throwing?: ReadonlySet<string>,
): DomImplementation[] {
  return catalog.definitions.map((definition) =>
    implement(definition, (node, element) => {
      emitters?.set(node.id, node.emit as Emit);
      draws?.push(node.id);
      if (throwing?.has(node.id)) throw new Error(`Broken ${node.id}`);
      const outer = element ?? document.createElement("div");
      if (!element) {
        outer.setAttribute("style", "display: contents;");
        outer.setAttribute("data-lf-node", node.id);
        const root = document.createElement("div");
        for (const slot of definition.slots) if (slot !== "root") root.append(document.createElement("span"));
        outer.append(root);
      }
      const root = outer.firstElementChild as HTMLElement;
      root.className = node.slot("root");
      root.removeAttribute("style");
      for (const [name, value] of Object.entries(node.style)) root.style.setProperty(name, value);
      root.setAttribute(PROPS_ATTRIBUTE, JSON.stringify(node.props));
      // Slot spans come first; children are the nodes' own `div`s.
      const spans = [...root.children].filter((child) => child.tagName === "SPAN");
      const others = definition.slots.filter((slot) => slot !== "root");
      for (const [i, slot] of others.entries()) (spans[i] as Element).className = node.slot(slot);
      place(root, [...spans.slice(0, others.length), ...node.children]);
      return outer;
    }),
  );
}
