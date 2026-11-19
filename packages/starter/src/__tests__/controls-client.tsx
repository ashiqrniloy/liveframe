import { compileValidator, type Intent, type UiTree } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { catalog } from "../catalog.ts";
import { designSystem } from "../design-system.ts";
import { implementations } from "../implementations.tsx";
import { themes } from "../themes.ts";
import { capabilities, manifest } from "./host.ts";

// The controls' and content kinds' page: it draws each tree the test sends and records the intents the controls raise.
const { Surface } = createRenderer({ catalog, implementations });
const validator = compileValidator({ catalog, capabilities, manifest });
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const intents: Intent[] = [];

/** Draws a tree under one of the starter themes; drawing the same tree under another is a theme switch. */
function mount(json: string, themeIndex = 0) {
  const theme = themes[themeIndex];
  if (!theme) throw new Error("Missing theme");
  intents.length = 0;
  const tree = JSON.parse(json) as UiTree;
  flushSync(() =>
    root.render(
      <Surface
        tree={tree}
        validator={validator}
        theme={theme}
        designSystem={designSystem}
        fallback={<p>Unavailable</p>}
        onIntent={(intent) => {
          intents.push(intent);
        }}
      />,
    ),
  );
}

declare global {
  interface Window {
    controls: { mount: typeof mount; intents: Intent[] };
  }
}
window.controls = { mount, intents };
