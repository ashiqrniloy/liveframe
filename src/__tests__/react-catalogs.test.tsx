import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Browser } from "playwright";
import { renderToString } from "react-dom/server";
import { type Catalog, defineComponent, obj, str } from "../index.ts";
import { createRenderer, type Implementation, implement } from "../react/index.ts";
import { RendererError } from "../react/renderer.tsx";
import { createSurfaceCore } from "../surface/index.ts";
import { launchBrowser } from "./fixtures/browser.ts";
import { Surface, treeFor, v1, v2, validators } from "./fixtures/react-catalogs.tsx";
import vocabulary from "./fixtures/vocabulary.json" with { type: "json" };

const button = defineComponent({
  kind: "button",
  description: "Runs an intent.",
  props: obj({ label: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default", "primary"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: { onPress: { carries: "none", description: "Pressed." } },
  styleProps: [],
  a11y: { role: "button", name: "label" },
});
const make = (catalogId: string, definition: Catalog["definitions"][number] = button): Catalog => ({
  format: "liveframe-catalog/1",
  catalogId,
  description: "Primitives.",
  vocabulary,
  definitions: [definition],
});
const one = make("acme.ui@1");
const two = make("acme.ui@2", { ...button, description: "Major 2." });
const messages = (error: unknown) => {
  expect(error).toBeInstanceOf(RendererError);
  return (error as RendererError).errors.map((e) => `${e.pointer} ${e.message}`);
};
function failure(options: Parameters<typeof createRenderer>[0]) {
  try {
    createRenderer(options);
  } catch (error) {
    return messages(error);
  }
  throw new Error("Expected rejection");
}

test("registry_check_per_catalog", () => {
  const impl1 = implement(button, () => null);
  const impl2 = implement({ ...button, description: "Major 2." }, () => null);
  expect(() =>
    createRenderer({
      catalogs: [
        { catalog: one, implementations: [impl1] },
        { catalog: two, implementations: [impl2] },
      ],
    }),
  ).not.toThrow();
  // Each catalog is checked on its own, with its own pointer prefix.
  expect(
    failure({
      catalogs: [
        { catalog: one, implementations: [impl1] },
        { catalog: two, implementations: [] },
      ],
    }),
  ).toEqual(["/catalogs/1/catalog/definitions/0/kind Missing implementation: button"]);
  expect(failure({ catalogs: [] })).toEqual(["/catalogs Expected at least one catalog"]);
  expect(
    failure({
      catalogs: [
        { catalog: one, implementations: [impl1] },
        { catalog: one, implementations: [impl1] },
      ],
    }),
  ).toEqual(["/catalogs/1/catalog/catalogId Duplicate catalog: acme.ui@1"]);
});

test("shared_implementation_requires_equal_definitions", () => {
  const shared: Implementation = implement(button, () => null);
  expect(
    failure({
      catalogs: [
        { catalog: one, implementations: [shared] },
        { catalog: two, implementations: [shared] },
      ],
    }),
  ).toEqual(["/catalogs/1/implementations/0 Definition differs from catalog: button"]);
  // Equal definitions in two catalogs share one implementation.
  const same = make("acme.ui@3");
  expect(() =>
    createRenderer({
      catalogs: [
        { catalog: one, implementations: [shared] },
        { catalog: same, implementations: [shared] },
      ],
    }),
  ).not.toThrow();
});

test("single_catalog_form_still_works", () => {
  expect(() => createRenderer({ catalog: one, implementations: [implement(button, () => null)] })).not.toThrow();
});

const props = {
  theme: { id: "t", version: "1" },
  designSystem: { id: "d", version: "1" },
  onIntent: () => {},
  fallback: <p>Unavailable</p>,
};

test("each_surface_uses_its_validators_catalog", () => {
  expect(renderToString(<Surface {...props} validator={validators.v1} tree={treeFor(v1)} />)).toContain(
    'data-major="1"',
  );
  expect(renderToString(<Surface {...props} validator={validators.v2} tree={treeFor(v2)} />)).toContain(
    'data-major="2"',
  );
});

test("catalog_id_mismatch_falls_back", () => {
  const events: unknown[] = [];
  const onEvent = (event: unknown) => events.push(event);
  const html = renderToString(<Surface {...props} validator={validators.v2} tree={treeFor(v1)} onEvent={onEvent} />);
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("data-major");
  expect(events).toEqual([
    {
      type: "arrival-rejected",
      errors: [{ kind: "catalog-mismatch", pointer: "/catalogId", message: expect.any(String) }],
    },
  ]);
});

test("core_refuses_a_tree_its_validator_accepted_for_another_catalog", () => {
  const lenient = { ...validators.v1, validateTree: (tree: unknown) => ({ ok: true as const, value: tree as never }) };
  const core = createSurfaceCore({ catalog: v1, validator: lenient, onIntent: () => {} });
  const result = core.accept(treeFor(v2));
  expect(result).toMatchObject({ ok: false, errors: [{ kind: "catalog-mismatch", pointer: "/catalogId" }] });
  expect(core.snapshot().valid).toBe(false);
});

test("validator_of_no_registered_catalog_falls_back_and_reports", () => {
  const events: { errors: { kind: string; pointer: string }[] }[] = [];
  // With two catalogs the validator picks the catalog; one that was not compiled for either is refused.
  const html = renderToString(
    <Surface {...props} validator={{ ...validators.v1 }} tree={treeFor(v1)} onEvent={(e) => events.push(e as never)} />,
  );
  expect(html).toContain("Unavailable");
  expect(events).toHaveLength(1);
  expect(events[0]?.errors[0]).toMatchObject({ kind: "catalog-mismatch", pointer: "/validator" });
});

let server: ReturnType<typeof Bun.serve>;
let browser: Browser;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./fixtures/react-catalogs-client.tsx", import.meta.url).pathname],
    target: "browser",
  });
  if (!build.success) throw new AggregateError(build.logs);
  const bundle = await build.outputs[0]?.text();
  if (!bundle) throw new Error("Missing bundle");
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            '<!doctype html><html lang="en"><head><title>Catalogs</title></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>',
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

test("two_catalog_majors_on_one_page", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("#one button");
    expect(await page.locator("#one button").getAttribute("data-major")).toBe("1");
    expect(await page.locator("#one button").textContent()).toBe("Go proof.ui@1");
    expect(await page.locator("#two button").getAttribute("data-major")).toBe("2");
    expect(await page.locator("#two button").textContent()).toBe("Go proof.ui@2");
    // A major-1 tree handed to a major-2 validator draws the fallback, not a button.
    expect(await page.locator("#crossed").textContent()).toBe("Unavailable");
    expect(await page.locator("#crossed button").count()).toBe(0);
  } finally {
    await page.close();
  }
});
