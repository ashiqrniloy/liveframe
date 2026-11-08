import { afterAll, beforeAll, expect, test } from "bun:test";
import { render } from "@arnilo/liveframe/sdk";
import type { Browser } from "playwright";
import { compileValidator, type UiNode, type UiTree } from "../index.ts";
import { launchBrowser } from "./fixtures/browser.ts";
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

let server: ReturnType<typeof Bun.serve>;
let browser: Browser;

beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./fixtures/surface-parity-client.tsx", import.meta.url).pathname],
    target: "browser",
    conditions: ["liveframe:source"],
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
            `<!doctype html><html lang="en"><head><title>Parity</title></head><body><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

async function parity(runs: readonly { manifest: unknown; tree: UiTree; steps?: readonly unknown[] }[]) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => window.ready);
    // Strings cross the boundary: the tree types are too deep for the evaluate argument types.
    const outcomes = await page.evaluate(
      (json) =>
        (JSON.parse(json) as Parameters<typeof window.parity.run>[0][]).map((input) => window.parity.run(input)),
      JSON.stringify(runs),
    );
    expect(errors).toEqual([]);
    return outcomes;
  } finally {
    await page.close();
  }
}

test("dom_renderer_matches_react_structure", async () => {
  const runs: { name: string; manifest: unknown; tree: UiTree }[] = [];
  for (const fixture of proofWidgets) {
    const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
    for (const scenario of fixture.scenarios) {
      const result = render(fixture.widget, scenario, { validator, surfaceId: "proof", revision: 0 });
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      runs.push({ name: `${fixture.name}/${scenario.name}`, manifest: fixture.manifest, tree: result.value });
    }
  }
  expect(runs.length).toBeGreaterThan(10);
  const outcomes = await parity(runs);
  for (const [i, steps] of outcomes.entries()) {
    const [initial] = steps;
    expect(initial?.dom.length, runs[i]?.name).toBe(1);
    // The same data-lf-node structure, slot classes, style declarations and effective props.
    expect(initial?.dom, runs[i]?.name).toEqual(initial?.react as never);
  }
}, 60000);

const local = {
  type: "object",
  properties: { q: { type: "string", maxLength: 64 }, expanded: { type: "boolean" }, count: { type: "integer" } },
  required: ["q", "expanded", "count"],
  additionalProperties: false,
};
const manifest = {
  ...(proofWidgets[0]?.manifest as object),
  local,
  initialLocal: { q: "", expanded: false, count: 0 },
};
const row = (name: string): UiNode => ({
  id: `root/${name}`,
  kind: "text",
  props: { text: name },
  when: { $contains: [name, { $path: "local.q" }] },
});

test("dom_renderer_matches_react_after_local_state_changes", async () => {
  const tree: UiTree = {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId: "s",
    revision: 1,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: [
        {
          id: "root/field",
          kind: "textField",
          props: { label: "Filter" },
          events: { onChange: { type: "setLocal", key: "q" } },
          bind: { placeholder: { $concat: ["Find ", { $path: "local.q" }] } },
        },
        row("alpha"),
        row("beta"),
        { id: "root/static", kind: "text", props: { text: "static" } },
      ],
    },
  };
  const steps = [
    { nodeId: "root/field", event: "onChange", value: "alp" },
    { nodeId: "root/field", event: "onChange", value: "zzz" },
    { nodeId: "root/field", event: "onChange", value: "" },
  ];
  const [outcome] = await parity([{ manifest, tree, steps }]);
  expect(outcome).toHaveLength(4);
  for (const step of outcome ?? []) {
    expect(step.dom).toEqual(step.react as never);
    // `setLocal` is the renderer's own: neither renderer raises an intent.
    expect(step.reactIntents).toEqual([]);
    expect(step.domIntents).toEqual([]);
  }
  const text = (index: number) => JSON.stringify(outcome?.[index]?.dom);
  expect(text(0)).toContain('"root/beta"');
  expect(text(1)).toContain('"root/alpha"');
  expect(text(1)).not.toContain('"root/beta"');
  expect(text(2)).not.toContain('"root/alpha"');
  expect(text(2)).toContain("Find zzz");
  expect(text(3)).toContain('"root/alpha"');
}, 30000);
