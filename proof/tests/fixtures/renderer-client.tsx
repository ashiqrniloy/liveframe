import type { Intent, UiTree } from "@arnilo/liveframe";
import { flushSync } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import { Surface, scope, systems, themes } from "./renderer.ts";

declare global {
  interface Window {
    switchSystem: (system: string) => void;
    update: (tree: UiTree) => void;
    intents: Intent[];
    ready: boolean;
  }
}
const container = document.getElementById("app");
if (!container) throw new Error("Missing test container");
window.intents = [];
let designSystem: "certified" | "rack" = "certified";
const fallback = <p>Unavailable</p>;
const onIntent = (intent: Intent) => window.intents.push(intent);
const surface = (tree: UiTree) => (
  <Surface
    tree={tree}
    {...scope}
    theme={themes[designSystem]}
    designSystem={systems[designSystem]}
    fallback={fallback}
    onIntent={onIntent}
  />
);
let tree = JSON.parse(document.getElementById("tree")?.textContent ?? "null") as UiTree;
const root = hydrateRoot(container, surface(tree));
window.update = (next) => {
  tree = next;
  flushSync(() => root.render(surface(tree)));
};
window.switchSystem = (system) => {
  designSystem = system as typeof designSystem;
  flushSync(() => root.render(surface(tree)));
};
window.ready = true;
