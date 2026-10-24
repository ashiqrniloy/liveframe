import { expect, test } from "bun:test";
import { catalogSuite, designSystemSuite, storeSuite } from "@arnilo/liveframe/conformance";
import {
  type BrowserFixtures,
  type PageOptions,
  rendererBrowserSuite,
  rendererSuite,
} from "@arnilo/liveframe/conformance/react";
import { memoryStore } from "@arnilo/liveframe/store";
import { chromium, type Page } from "playwright";
import { capabilities, catalog, examples, manifest } from "./fixtures/conformance/index.ts";
import { fixtures, examples as hydrationExamples, pageOptions } from "./fixtures/conformance-browser.tsx";
import { browserHost } from "./fixtures/conformance-browser-host.ts";

const styles = { ...pageOptions, sheets: ["button { display: inline-flex }"] };
// guide:start
const cases = [
  ...storeSuite({ create: () => memoryStore() }),
  ...catalogSuite({ catalog, capabilities, manifest, examples, published: catalog }),
  ...designSystemSuite(styles),
];
for (const c of cases) test(c.name, c.run, c.timeout);
// guide:end

test("conformance_guide_example_runs", async () => {
  const source = await Bun.file(import.meta.path).text();
  const guide = await Bun.file(new URL("../../docs/conformance.md", import.meta.url)).text();
  const example = source.split("// guide:start\n")[1]?.split("// guide:end")[0];
  if (!example) throw new Error("Missing guide source block");
  expect(guide).toContain(example.trimEnd());
  expect(cases.length).toBeGreaterThan(5);
  // A broken fixture must fail the coverage case used by the guide.
  const missing = catalogSuite({ catalog, capabilities, manifest, examples: [] }).find(
    (c) => c.name === "every_kind_and_variant_has_a_valid_example",
  );
  if (!missing) throw new Error("Missing coverage case");
  try {
    await missing.run();
    throw new Error("Missing examples passed");
  } catch (error) {
    expect(error).toMatchObject({ rule: "every_kind_and_variant_has_a_valid_example" });
  }
});

// renderer:start
function rendererCases(
  options: PageOptions,
  serverExamples: readonly unknown[],
  hydrationExamples: readonly unknown[],
  fixtures: BrowserFixtures,
  page: () => Promise<Page>,
  url: string,
) {
  return [
    ...rendererSuite({ ...options, examples: serverExamples }),
    ...rendererBrowserSuite({ ...options, examples: hydrationExamples, fixtures, page, url }),
  ];
}
// renderer:end

test("conformance_guide_renderer_examples_run", async () => {
  const server = await browserHost(new URL("./fixtures/conformance-guide-client.ts", import.meta.url).pathname);
  const browser = await chromium.launch();
  try {
    const cases = rendererCases(
      pageOptions,
      [fixtures.survival.tree],
      hydrationExamples,
      fixtures,
      () => browser.newPage(),
      server.url.href,
    );
    // Full browser coverage already lives in conformance-renderer-browser.test.tsx.
    const serverCases = rendererSuite({ ...pageOptions, examples: [fixtures.survival.tree] });
    for (const c of cases.filter(
      (c) =>
        serverCases.some((server) => server.name === c.name) || c.name === "every_example_hydrates_without_mismatch",
    ))
      await c.run();
    const guide = await Bun.file(new URL("../../docs/conformance.md", import.meta.url)).text();
    const source = await Bun.file(import.meta.path).text();
    const example = source.split("// renderer:start\n")[1]?.split("// renderer:end")[0];
    if (!example) throw new Error("Missing renderer source block");
    expect(guide).toContain(example.trimEnd());
    const client = await Bun.file(new URL("./fixtures/conformance-guide-client.ts", import.meta.url)).text();
    expect(guide).toContain(client.replace("./conformance-browser.tsx", "./renderer-host.ts").trimEnd());
  } finally {
    await browser.close();
    await server.stop(true);
  }
}, 30000);
