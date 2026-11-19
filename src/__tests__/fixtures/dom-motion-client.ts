// Browser half of `dom-motion-browser.test.ts`: the `motionTest` page of `react-motion-client.tsx`, mounted with
// `/dom`. Every kind draws as `react-surface.tsx`'s generic primitive does: a box with its text, then its children.
import { createDomRenderer, implement, place } from "../../dom/index.ts";
import { compileValidator, type UiTree } from "../../index.ts";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import { catalog } from "./react-surface.tsx";

const errors: string[] = [];
window.addEventListener("error", (event) => errors.push(String(event.message)));

const { mount } = createDomRenderer({
  catalog,
  implementations: catalog.definitions.map((definition) =>
    implement(definition, (node, element) => {
      const root = (element as HTMLElement | undefined) ?? document.createElement("div");
      root.id = node.domId;
      root.className = node.slot("root");
      root.removeAttribute("style");
      for (const [name, value] of Object.entries(node.style)) root.style.setProperty(name, value);
      const text = typeof node.props.text === "string" ? [document.createTextNode(node.props.text)] : [];
      if (element?.firstChild?.nodeType === 3 && text[0]) {
        (element.firstChild as Text).data = (text[0] as Text).data;
        text[0] = element.firstChild as Text;
      }
      place(root, [...text, ...node.children]);
      return root;
    }),
  ),
});
const validator = compileValidator({ catalog, capabilities, manifest });

/** A stack of text rows, one per id, in order. */
function rows(ids: readonly string[], revision: number, surfaceId = "motion"): UiTree {
  return {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId,
    revision,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: ids.map((id) => ({ id: `root/${id}`, kind: "text", props: { text: `Row ${id}` } })),
    },
  };
}

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app");
let surface: ReturnType<typeof mount> | undefined;
let revision = 1;
let theme = "certified";

window.motionTest = {
  mount(ids, designSystem = "motion") {
    surface?.dispose();
    revision = 1;
    theme = "certified";
    surface = mount(app, {
      validator,
      theme: { id: theme, version: "1.0.0" },
      designSystem: { id: designSystem, version: "1.0.0" },
      onIntent: () => {},
      fallback: () => Object.assign(document.createElement("p"), { textContent: "Unavailable" }),
    });
    surface.update(rows(ids, revision));
  },
  arrive(ids, options = {}) {
    revision++;
    // As `<Surface>` gets a new theme and a new tree in one render: the switch starts, then the tree draws.
    if (options.theme && options.theme !== theme) {
      theme = options.theme;
      surface?.set({ theme: { id: theme, version: "1.0.0" } });
    }
    surface?.update(rows(ids, revision, options.surfaceId));
  },
  row(id) {
    return [...document.querySelectorAll<HTMLElement>("#app .lf_surface div")].find(
      (element) => element.textContent === `Row ${id}`,
    );
  },
  order() {
    return [...document.querySelectorAll<HTMLElement>("#app .lf_surface > div > div")].map((element) =>
      (element.textContent ?? "").replace("Row ", ""),
    );
  },
  errors: () => errors,
};
