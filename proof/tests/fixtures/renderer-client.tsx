import { flushSync } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import { definitions } from "../../catalog/definitions.ts";
import { implementations } from "../../renderer/primitives/index.tsx";
import { registry } from "../../renderer/registry.ts";
import { Surface } from "../../renderer/surface.tsx";
import type { Intent, RenderOptions, UiTree } from "../../runtime/types.ts";

declare global {
  interface Window {
    update: (tree: UiTree) => void;
    intents: Intent[];
    ready: boolean;
  }
}
const options: RenderOptions = {
  catalog: { catalogId: "proof@1", definitions },
  actions: ["save", "close"],
  state: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: 100 },
      selected: { type: "string", maxLength: 100 },
      enabled: { type: "boolean" },
    },
    required: [],
    additionalProperties: false,
  },
};
const registered = registry(options.catalog, implementations);
const container = document.getElementById("app");
if (!container) throw new Error("Missing test container");
window.intents = [];
const surface = (tree: UiTree) => (
  <Surface
    tree={tree}
    options={options}
    registry={registered}
    fallback={<p>Unavailable</p>}
    onIntent={(intent) => window.intents.push(intent)}
  />
);
const tree = JSON.parse(document.getElementById("tree")?.textContent ?? "null") as UiTree;
const root = hydrateRoot(container, surface(tree));
window.update = (next) => flushSync(() => root.render(surface(next)));
window.ready = true;
