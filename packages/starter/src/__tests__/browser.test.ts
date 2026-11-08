import { afterAll, beforeAll, describe, test } from "bun:test";
import { rendererBrowserSuite } from "@arnilo/liveframe/conformance/react";
import type { Browser } from "playwright";
import { browserName, launchBrowser } from "../../../../src/__tests__/fixtures/browser.ts";
import { primitiveCss } from "../styles.ts";
import { fixtures, hydrationExamples } from "./browser-fixtures.ts";
import { pageOptions } from "./host.ts";

let server: Bun.Server<undefined>;
let browser: Browser;
beforeAll(async () => {
  // The app bundles and serves its own page entry; the kit only drives it. Development React: its Profiler counts renders.
  const build = await Bun.build({
    entrypoints: [new URL("./client.tsx", import.meta.url).pathname],
    target: "browser",
    conditions: ["liveframe:source"],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  });
  const [bundle] = build.outputs;
  if (!build.success || !bundle) throw new AggregateError(build.logs, "Conformance page build failed");
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><title>Conformance</title><style>${primitiveCss}</style></head><body><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await launchBrowser();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

describe(`starter_passes_renderer_browser_suite (${browserName})`, () => {
  // The cases request their own pages, so the suite is created at registration and reads `server` when a case runs.
  const cases = rendererBrowserSuite({
    ...pageOptions,
    page: () => browser.newPage(),
    get url() {
      return server.url.href;
    },
    examples: hydrationExamples,
    fixtures,
  });
  for (const c of cases) test(c.name, c.run, c.timeout);
});
