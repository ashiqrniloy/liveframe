import { afterAll, beforeAll, test } from "bun:test";
import { rendererBrowserSuite } from "@arnilo/liveframe/conformance/react";
import { type Browser, chromium } from "playwright";
import { browserHost } from "../../src/__tests__/fixtures/conformance-browser-host.ts";
import { primitiveCss } from "../renderer/primitives/base.ts";
import { browserExamples, fixtures, pageOptions } from "./fixtures/conformance.ts";

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
    await c.run();
  console.log(`Renderer browser conformance (Certified × Rack): ${(performance.now() - start).toFixed(2)} ms`);
}, 120000);
