import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { UiTree } from "../../index.ts";
import { catalog, renderer, surfaceProps } from "./react-surface.tsx";

const { Surface } = renderer();
const errors: string[] = [];
window.addEventListener("error", (event) => errors.push(String(event.message)));

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

let revision = 1;
let set: (state: { tree: UiTree; theme: string; designSystem: string }) => void = () => {};
let state = { tree: rows([], 1), theme: "certified", designSystem: "motion" };

function App() {
  const [current, setCurrent] = useState(state);
  set = (next) => {
    state = next;
    setCurrent(next);
  };
  return (
    <Surface
      {...surfaceProps}
      tree={current.tree}
      theme={{ id: current.theme, version: "1.0.0" }}
      designSystem={{ id: current.designSystem, version: "1.0.0" }}
    />
  );
}

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app");
const root = createRoot(app);

window.motionTest = {
  mount(ids, designSystem = "motion") {
    revision = 1;
    state = { tree: rows(ids, revision), theme: "certified", designSystem };
    flushSync(() => root.render(<App />));
  },
  arrive(ids, options = {}) {
    revision++;
    flushSync(() =>
      set({
        tree: rows(ids, revision, options.surfaceId),
        theme: options.theme ?? state.theme,
        designSystem: state.designSystem,
      }),
    );
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

declare global {
  interface Window {
    motionTest: {
      mount(ids: readonly string[], designSystem?: string): void;
      arrive(ids: readonly string[], options?: { readonly theme?: string; readonly surfaceId?: string }): void;
      row(id: string): HTMLElement | undefined;
      order(): string[];
      errors(): string[];
    };
  }
}
