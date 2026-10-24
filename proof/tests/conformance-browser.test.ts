import { afterAll, beforeAll, test } from "bun:test";
import { rendererBrowserSuite } from "@arnilo/liveframe/conformance/react";
import { type Browser, chromium } from "playwright";
import { browserHost } from "../../src/__tests__/fixtures/conformance-browser-host.ts";
import { primitiveCss } from "../renderer/primitives/base.ts";
import { browserExamples, fixtures, lifecycleRules, pageOptions } from "./fixtures/conformance.ts";

let server: Awaited<ReturnType<typeof browserHost>>;
let browser: Browser;
beforeAll(async () => {
  server = await browserHost(new URL("../host/conformance-client.tsx", import.meta.url).pathname, primitiveCss);
  browser = await chromium.launch();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

test("proof_host_passes_the_renderer_browser_cases", async () => {
  const start = performance.now();
  for (const c of rendererBrowserSuite({
    ...pageOptions,
    page: () => browser.newPage(),
    url: server.url.href,
    examples: browserExamples,
    fixtures,
  }))
    if (c.name !== "every_styled_state_is_reachable" && !lifecycleRules.includes(c.name)) await c.run();
  console.log(`Renderer browser conformance (Certified × Rack): ${(performance.now() - start).toFixed(2)} ms`);
}, 120000);

test("proof_host_reaches_every_styled_state", async () => {
  const c = rendererBrowserSuite({
    ...pageOptions,
    page: () => browser.newPage(),
    url: server.url.href,
    examples: browserExamples,
    fixtures,
  }).find((c) => c.name === "every_styled_state_is_reachable");
  const start = performance.now();
  if (!c) throw new Error("Missing state case");
  await c.run();
  console.log(`Styled-state conformance (Certified × Rack): ${(performance.now() - start).toFixed(2)} ms`);
}, 120000);

test("proof_host_passes_the_overlay_and_text_cases", async () => {
  const start = performance.now();
  for (const c of rendererBrowserSuite({
    ...pageOptions,
    page: () => browser.newPage(),
    url: server.url.href,
    examples: browserExamples,
    fixtures,
  })) {
    if (lifecycleRules.includes(c.name)) await c.run();
  }
  console.log(`Overlay/text conformance (Certified × Rack): ${(performance.now() - start).toFixed(2)} ms`);
}, 120000);
