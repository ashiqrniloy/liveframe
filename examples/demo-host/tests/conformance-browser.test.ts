import { afterAll, beforeAll, describe, test } from "bun:test";
import { rendererBrowserSuite } from "@arnilo/liveframe/conformance/react";
import { type Browser, chromium } from "playwright";
import { primitiveCss } from "../primitives/css.ts";
import { fixtures, hydrationExamples, pageOptions } from "./conformance-fixtures.ts";

let server: Bun.Server<undefined>;
let browser: Browser;
beforeAll(async () => {
  // The app bundles and serves its own page entry; the kit only drives it. Development React: its Profiler counts renders.
  const build = await Bun.build({
    entrypoints: [new URL("../conformance-client.tsx", import.meta.url).pathname],
    target: "browser",
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
  browser = await chromium.launch();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

describe("renderer in the browser", () => {
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
