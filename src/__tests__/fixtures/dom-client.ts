// Browser half of `dom-browser.test.ts`: mounts `/dom` surfaces over the proof catalog's generic DOM fixture.
import { createDomRenderer, type DomSurface, type MountOptions } from "../../dom/index.ts";
import { type Catalog, compileValidator, type UiNode, type UiTree } from "../../index.ts";
import type { SurfaceEvent } from "../../surface/index.ts";
import { domImplementations } from "./dom-renderer.ts";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import rawCatalog from "./proof/catalog.json" with { type: "json" };

const catalog = rawCatalog as Catalog;
const validator = compileValidator({ catalog, capabilities, manifest });
const draws: string[] = [];
const throwing = new Set<string>();
const events: SurfaceEvent[] = [];
const { mount } = createDomRenderer({
  catalog,
  implementations: domImplementations(catalog, undefined, draws, throwing),
});
const identity = { id: "certified", version: "1.0.0" };

function tree(revision: number, rows: readonly (readonly [string, string])[], surfaceId = "s"): UiTree {
  const children: UiNode[] = rows.map(([id, text]) => ({ id: `root/${id}`, kind: "text", props: { text } }));
  return {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId,
    revision,
    root: { id: "root", kind: "stack", props: {}, children },
  };
}

declare global {
  interface Window {
    domTest: {
      container: HTMLElement;
      surface: DomSurface;
      draws: string[];
      /** Node ids whose implementation throws while they are listed. */
      throwing: Set<string>;
      events: SurfaceEvent[];
      mount(options?: Partial<MountOptions>): void;
      update(revision: number, rows: readonly (readonly [string, string])[], surfaceId?: string): boolean;
      updateRaw(input: unknown): boolean;
      element(id: string): HTMLElement | null;
    };
    ready: boolean;
  }
}

window.domTest = {
  container: document.createElement("main"),
  surface: undefined as never,
  draws,
  throwing,
  events,
  mount(options = {}) {
    this.surface?.dispose();
    this.container.replaceChildren();
    document.body.append(this.container);
    draws.length = 0;
    events.length = 0;
    throwing.clear();
    this.surface = mount(this.container, {
      validator,
      theme: identity,
      designSystem: identity,
      onIntent: () => {},
      fallback: () => Object.assign(document.createElement("p"), { className: "fallback", textContent: "Unavailable" }),
      onEvent: (event) => {
        events.push(event);
      },
      ...options,
    });
  },
  update(revision, rows, surfaceId) {
    return this.surface.update(tree(revision, rows, surfaceId)).ok;
  },
  updateRaw(input) {
    return this.surface.update(input).ok;
  },
  element(id) {
    return this.container.querySelector<HTMLElement>(`[data-lf-node="${id}"]`);
  },
};
window.ready = true;
