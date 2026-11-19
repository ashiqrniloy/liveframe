import type { Intent, UiTree } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { catalog } from "../catalog.ts";
import { designSystem } from "../design-system.ts";
import { implementations } from "../implementations.tsx";
import { themes } from "../themes.ts";
import { validator } from "./windowed.tsx";

// The windowed list's page: it draws each tree the test sends and records the intents a scroll raises.
const { Surface } = createRenderer({ catalog, implementations });
const [theme] = themes;
if (!theme) throw new Error("Missing theme");
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const intents: Intent[] = [];

function update(json: string) {
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
    windowed: { update: typeof update; intents: Intent[] };
  }
}
window.windowed = { update, intents };
