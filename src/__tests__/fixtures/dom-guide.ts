// The `/dom` guide's examples (docs/renderer.md, "Render without a framework"), run in the browser by
// `dom-guide.test.ts`. The blocks between the markers appear in the guide verbatim.
import { createDomRenderer, type DomSurface, implement, place } from "@arnilo/liveframe/dom";
import { type Catalog, compileValidator, type Intent, type UiTree } from "@arnilo/liveframe";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import rawCatalog from "./proof/catalog.json" with { type: "json" };

const catalog = rawCatalog as Catalog;
const validator = compileValidator({ catalog, capabilities, manifest });
const definition = (kind: string) => catalog.definitions.find((d) => d.kind === kind) as Catalog["definitions"][number];
const stackDefinition = definition("stack");
const textDefinition = definition("text");
const buttonDefinition = definition("button");
const theme = { id: "certified", version: "1.0.0" };
const designSystem = { id: "certified", version: "1.0.0" };
const dark = { id: "rack", version: "1.0.0" };
const sent: Intent[] = [];
const send = (intent: Intent) => sent.push(intent);
// The other kinds of the proof catalog draw as a plain box here.
const others = catalog.definitions
  .filter((d) => !["stack", "text", "button"].includes(d.kind))
  .map((d) =>
    implement(d, (node, element) => {
      const el = element ?? document.createElement("div");
      el.id = node.domId;
      el.className = node.slot("root");
      place(el, node.children);
      return el;
    }),
  );
const tree: UiTree = {
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "guide",
  revision: 1,
  root: {
    id: "root",
    kind: "stack",
    props: {},
    style: { gap: "space.2" },
    children: [
      { id: "root/title", kind: "text", props: { text: "Inbox" } },
      {
        id: "root/save",
        kind: "button",
        props: { label: "Save" },
        events: { onPress: { type: "setState", key: "reason", value: "saved" } },
      },
    ],
  },
};

// guide:implement:start
const Stack = implement(stackDefinition, (node, element) => {
  const el = element ?? document.createElement("div");
  el.id = node.domId; // so another node's reference can name it
  el.className = node.slot("root");
  el.removeAttribute("style");
  for (const [name, value] of Object.entries(node.style)) (el as HTMLElement).style.setProperty(name, value);
  place(el, node.children); // keeps the children already in place and moves only the rest
  return el;
});

const Text = implement(textDefinition, (node, element) => {
  const el = element ?? document.createElement("p");
  el.id = node.domId;
  el.className = node.slot("root");
  el.textContent = String(node.props.text);
  return el;
});

const Button = implement(buttonDefinition, (node, element) => {
  const el = (element as HTMLButtonElement | undefined) ?? document.createElement("button");
  if (!element) {
    el.type = "button";
    // Added once: `emit` is stable for the node and raises through its current context.
    el.addEventListener("click", () => node.emit("onPress"));
  }
  el.id = node.domId;
  el.className = node.slot("root");
  el.textContent = String(node.props.label);
  el.disabled = node.props.disabled === true;
  return el;
});
// guide:implement:end

const app = document.createElement("main");
document.body.append(app);

// guide:mount:start
const { mount } = createDomRenderer({ catalog, implementations: [Stack, Text, Button, ...others] });

const surface = mount(app, {
  validator, // the host's compiled validator: every arrival is checked again
  theme,
  designSystem,
  onIntent: (intent) => send(intent), // complete intents only; `setLocal` never arrives here
  fallback: () => Object.assign(document.createElement("p"), { textContent: "Unavailable" }),
});

const drawn = surface.update(tree); // validates, then draws before it returns
if (!drawn.ok) console.warn(drawn.errors); // the fallback is on screen
surface.set({ theme: dark }); // runs the switching sequence on the wrapper and the portal
// guide:mount:end

// guide:element:start
class LiveframeSurface extends HTMLElement {
  #surface: DomSurface | undefined;

  connectedCallback() {
    const fallback = () => Object.assign(document.createElement("p"), { textContent: "Unavailable" });
    this.#surface = mount(this, { validator, theme, designSystem, onIntent: send, fallback });
  }

  disconnectedCallback() {
    this.#surface?.dispose();
    this.#surface = undefined;
  }

  set tree(tree: unknown) {
    this.#surface?.update(tree);
  }
}
customElements.define("liveframe-surface", LiveframeSurface);
// guide:element:end

declare global {
  interface Window {
    domGuide: {
      drawn: boolean;
      sent: Intent[];
      surface: DomSurface;
      element(): { text: string | undefined; disposed: boolean };
    };
  }
}

window.domGuide = {
  drawn: drawn.ok,
  sent,
  surface,
  element() {
    const element = document.createElement("liveframe-surface") as LiveframeSurface;
    document.body.append(element);
    element.tree = { ...tree, surfaceId: "element" };
    const text = element.querySelector(".lf_surface p")?.textContent ?? undefined;
    element.remove();
    return { text, disposed: element.children.length === 0 };
  },
};
