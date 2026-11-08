import { createRoot } from "react-dom/client";
import { Surface, treeFor, v1, v2, validators } from "./react-catalogs.tsx";

const identity = { id: "certified", version: "1.0.0" };
const common = { theme: identity, designSystem: identity, onIntent: () => {}, fallback: <p>Unavailable</p> };
const app = document.getElementById("app");
if (!app) throw new Error("Missing #app");
createRoot(app).render(
  <>
    <section id="one">
      <Surface {...common} validator={validators.v1} tree={treeFor(v1)} />
    </section>
    <section id="two">
      <Surface {...common} validator={validators.v2} tree={treeFor(v2)} />
    </section>
    <section id="crossed">
      <Surface {...common} validator={validators.v2} tree={treeFor(v1)} />
    </section>
  </>,
);
