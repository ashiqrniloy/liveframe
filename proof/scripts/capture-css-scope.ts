// Capture the migrated proof host server render; no browser or translation required.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { openPage } from "../host/pages.ts";
import { ProofSurface } from "../host/view.tsx";

const snapshot = (await openPage("full", "agent-home", "ready")).snapshot();
const html = renderToString(createElement(ProofSurface, { snapshot, onIntent: () => {} }));
if (!html.includes("lf_heading_default_root") || /(?:class="[^"]*lf-|--lf-(?:colour|type|value)-)/.test(html))
  throw new Error("Capture must contain projected agent-home markup, with no legacy CSS names");
await Bun.write(
  "src/__tests__/fixtures/css/agent-home.html",
  `<!-- biome-ignore-all lint: Generated proof-host markup; regenerate with proof/scripts/capture-css-scope.ts -->\n<!-- biome-ignore-all format: Preserve the captured server markup -->\n${html}\n`,
);
console.log(`Captured agent-home server markup: ${new TextEncoder().encode(html).length} bytes`);
