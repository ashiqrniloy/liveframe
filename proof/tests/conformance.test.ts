import { expect, test } from "bun:test";
import { catalogSuite, designSystemSuite } from "@arnilo/liveframe/conformance";
import { rendererSuite } from "@arnilo/liveframe/conformance/react";
import { implementations } from "../renderer/primitives/index.tsx";
import { serverExamples } from "./fixtures/conformance-server.ts";
import { catalog, capabilities, manifest, examples } from "../../src/__tests__/fixtures/conformance/index.ts";
import { themes, systems } from "../css/sheets.ts";
import { primitiveCss } from "../renderer/primitives/base.ts";

for (const c of [
  ...catalogSuite({ catalog, capabilities, manifest, examples }),
  ...designSystemSuite({
    catalog,
    themes: Object.values(themes),
    designSystems: Object.values(systems),
    sheets: [primitiveCss],
  }),
])
  test(c.name, c.run, c.timeout);

const rendererOptions = {
  catalog,
  capabilities,
  manifest,
  implementations,
  themes: Object.values(themes),
  designSystems: Object.values(systems),
  examples: serverExamples,
  fallback: "Unavailable",
};
for (const c of rendererSuite(rendererOptions)) test(c.name, c.run, c.timeout);

test("proof_implementations_pass_the_renderer_server_cases", async () => {
  const start = performance.now();
  for (const c of rendererSuite(rendererOptions)) await c.run();
  // Full scenarios also render successfully, including content deferred until the browser mounts.
  const render = rendererSuite({ ...rendererOptions, examples }).find(
    (c) => c.name === "every_example_renders_on_the_server_under_every_design_system",
  );
  expect(render).toBeDefined();
  await render?.run();
  console.log(`Renderer server conformance (Certified × Rack): ${(performance.now() - start).toFixed(2)} ms`);
});
