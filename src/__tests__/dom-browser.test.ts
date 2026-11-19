import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Browser, Page } from "playwright";
import { launchBrowser } from "./fixtures/browser.ts";

let server: ReturnType<typeof Bun.serve>;
let browser: Browser;

beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./fixtures/dom-client.ts", import.meta.url).pathname],
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
            `<!doctype html><html lang="en"><head><title>DOM</title></head><body><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

async function withPage(run: (page: Page) => Promise<void>): Promise<void> {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => window.ready);
    await page.evaluate(() => window.domTest.mount());
    await run(page);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}

test("dom_keeps_elements_for_unchanged_nodes_across_revisions_and_reorders", async () => {
  await withPage(async (page) => {
    const outcome = await page.evaluate(() => {
      const t = window.domTest;
      t.update(1, [
        ["a", "A"],
        ["b", "B"],
        ["c", "C"],
        ["d", "D"],
      ]);
      const first = Object.fromEntries(
        ["root", "root/a", "root/b", "root/c", "root/d"].map((id) => [id, t.element(id)]),
      );
      // A focused row that keeps its place among the moved ones keeps its focus. The node's outer element is
      // `display: contents`, which takes no focus, so its box is focused.
      const focused = first["root/b"]?.firstElementChild as HTMLElement;
      focused.tabIndex = 0;
      focused.focus();
      const focusTaken = document.activeElement === focused;
      t.draws.length = 0;
      // `d` moves to the front, `b`'s text changes, `c` leaves and `e` arrives.
      const ok = t.update(2, [
        ["d", "D"],
        ["a", "A"],
        ["b", "B2"],
        ["e", "E"],
      ]);
      const drawsOnChange = [...t.draws].sort();
      const order = [...(t.element("root")?.firstElementChild?.children ?? [])].map((child) =>
        child.getAttribute("data-lf-node"),
      );
      const same = Object.fromEntries(
        ["root", "root/a", "root/b", "root/d"].map((id) => [id, t.element(id) === first[id]]),
      );
      const focusKept = document.activeElement === focused;
      const bProps = t.element("root/b")?.firstElementChild?.getAttribute("data-props");
      const cGone = t.element("root/c") === null && !(first["root/c"] as HTMLElement).isConnected;
      // An identical revision draws nothing.
      t.draws.length = 0;
      t.update(3, [
        ["d", "D"],
        ["a", "A"],
        ["b", "B2"],
        ["e", "E"],
      ]);
      return { ok, focusTaken, drawsOnChange, order, same, focusKept, bProps, cGone, drawsOnSame: [...t.draws] };
    });
    expect(outcome.ok).toBe(true);
    // Only the changed node, the new node and their parent are drawn again.
    expect(outcome.drawsOnChange).toEqual(["root", "root/b", "root/e"]);
    expect(outcome.order).toEqual(["root/d", "root/a", "root/b", "root/e"]);
    expect(outcome.same).toEqual({ root: true, "root/a": true, "root/b": true, "root/d": true });
    expect(outcome.focusTaken).toBe(true);
    expect(outcome.focusKept).toBe(true);
    expect(outcome.bProps).toBe(JSON.stringify({ text: "B2" }));
    expect(outcome.cGone).toBe(true);
    expect(outcome.drawsOnSame).toEqual([]);
  });
}, 30000);

test("dom_invalid_arrival_draws_only_the_fallback", async () => {
  await withPage(async (page) => {
    const outcome = await page.evaluate(() => {
      const t = window.domTest;
      t.update(1, [["a", "A"]]);
      const [wrapper, portal] = [...t.container.children] as HTMLElement[];
      // Valid JSON in shape, but a node of a kind outside the catalog: no part of it may draw.
      const invalid = t.updateRaw({
        format: "liveframe/1",
        catalogId: "proof.ui@1",
        surfaceId: "s",
        revision: 2,
        root: { id: "root", kind: "stack", props: {}, children: [{ id: "root/x", kind: "script", props: {} }] },
      });
      const drawn = {
        wrapper: [...(wrapper?.children ?? [])].map((child) => child.outerHTML),
        portal: portal?.children.length,
        nodes: t.container.querySelectorAll("[data-lf-node]").length,
      };
      // A later valid revision draws again.
      const recovered = t.update(3, [["a", "A"]]) && t.element("root/a") !== null;
      return { invalid, drawn, recovered, fallbackGone: t.container.querySelector(".fallback") === null };
    });
    expect(outcome.invalid).toBe(false);
    expect(outcome.drawn).toEqual({ wrapper: ['<p class="fallback">Unavailable</p>'], portal: 0, nodes: 0 });
    expect(outcome.recovered).toBe(true);
    expect(outcome.fallbackGone).toBe(true);
  });
}, 30000);

test("dom_wrapper_and_portal_carry_scope_and_switch_together", async () => {
  await withPage(async (page) => {
    const outcome = await page.evaluate(async () => {
      const t = window.domTest;
      t.update(1, [["a", "A"]]);
      const [wrapper, portal] = [...t.container.children] as HTMLElement[];
      const attributes = (element: HTMLElement | undefined) =>
        Object.fromEntries(
          ["class", "data-lf-theme", "data-lf-ds", "data-lf-switching", "data-lf-portal"].map((name) => [
            name,
            element?.getAttribute(name) ?? null,
          ]),
        );
      const before = [attributes(wrapper), attributes(portal)];
      t.surface.set({ theme: { id: "rack", version: "1.0.0" } });
      const during = [attributes(wrapper), attributes(portal)];
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const after = [attributes(wrapper), attributes(portal)];
      t.surface.dispose();
      return { before, during, after, left: t.container.children.length };
    });
    const scope = { class: "lf_surface", "data-lf-ds": "certified@1.0.0", "data-lf-switching": null };
    expect(outcome.before).toEqual([
      { ...scope, "data-lf-theme": "certified@1.0.0", "data-lf-portal": null },
      { ...scope, "data-lf-theme": "certified@1.0.0", "data-lf-portal": "" },
    ]);
    expect(outcome.during).toEqual([
      { ...scope, "data-lf-theme": "rack@1.0.0", "data-lf-switching": "", "data-lf-portal": null },
      { ...scope, "data-lf-theme": "rack@1.0.0", "data-lf-switching": "", "data-lf-portal": "" },
    ]);
    expect(outcome.after).toEqual([
      { ...scope, "data-lf-theme": "rack@1.0.0", "data-lf-portal": null },
      { ...scope, "data-lf-theme": "rack@1.0.0", "data-lf-portal": "" },
    ]);
    expect(outcome.left).toBe(0);
  });
}, 30000);

test("dom_throwing_implementation_falls_back_at_that_node_and_retries", async () => {
  await withPage(async (page) => {
    const outcome = await page.evaluate(() => {
      const t = window.domTest;
      t.throwing.add("root/b");
      const ok = t.update(1, [
        ["a", "A"],
        ["b", "B"],
      ]);
      const stack = t.element("root")?.firstElementChild;
      const drawn = [...(stack?.children ?? [])].map((child) => child.getAttribute("data-lf-node") ?? child.className);
      const failed = t.events.filter((event) => event.type === "implementation-failed");
      // The next arrival retries the node, even with the same props, and draws it once it no longer throws.
      t.throwing.clear();
      t.draws.length = 0;
      t.update(2, [
        ["a", "A"],
        ["b", "B"],
      ]);
      return {
        ok,
        drawn,
        failed,
        retried: t.draws.includes("root/b"),
        recovered: t.element("root/b") !== null && t.container.querySelector(".fallback") === null,
      };
    });
    expect(outcome.ok).toBe(true);
    // Only the throwing node is replaced; its sibling and the surface draw as usual.
    expect(outcome.drawn).toEqual(["root/a", "fallback"]);
    expect(outcome.failed).toEqual([{ type: "implementation-failed", nodeId: "root/b", kind: "text" }]);
    expect(outcome.retried).toBe(true);
    expect(outcome.recovered).toBe(true);
  });
}, 30000);

test("dom_focus_continuity_matches_the_spec", async () => {
  await withPage(async (page) => {
    const outcome = await page.evaluate((): Record<string, unknown> => {
      const t = window.domTest;
      const rows = (ids: string) => [...ids].map((id) => [id, id.toUpperCase()] as const);
      const focusRow = (id: string) => {
        const box = t.element(`root/${id}`)?.firstElementChild as HTMLElement;
        box.tabIndex = 0;
        box.focus();
        return box;
      };
      const tabbable = (ids: string) => {
        for (const id of ids) (t.element(`root/${id}`)?.firstElementChild as HTMLElement).tabIndex = 0;
      };
      const wrapper = t.container.firstElementChild as HTMLElement;
      t.update(1, rows("abc"));
      tabbable("abc");
      focusRow("b");
      // The focused row leaves: focus goes to the nearest tabbable successor.
      t.update(2, rows("ac"));
      const successor = document.activeElement === t.element("root/c")?.firstElementChild;
      // The last row leaves: no successor, so the closest predecessor.
      t.update(3, rows("a"));
      const predecessor = document.activeElement === t.element("root/a")?.firstElementChild;
      // Nothing tabbable is left: the wrapper, which carries `tabindex="-1"`.
      t.update(4, []);
      const toWrapper = document.activeElement === wrapper && wrapper.getAttribute("tabindex") === "-1";
      // Focus outside the surface is never taken.
      t.update(5, rows("x"));
      tabbable("x");
      const outside = document.createElement("button");
      document.body.append(outside);
      outside.focus();
      t.update(6, []);
      const untouched = document.activeElement === outside;
      outside.remove();
      // Opted out: no tabindex on the wrapper, and a removed element's focus is not restored.
      t.mount({ focusContinuity: false });
      const plain = t.container.firstElementChild as HTMLElement;
      t.update(1, rows("ab"));
      tabbable("ab");
      focusRow("a");
      t.update(2, rows("b"));
      return {
        successor,
        predecessor,
        toWrapper,
        untouched,
        optedOut: !plain.hasAttribute("tabindex") && document.activeElement === document.body,
      };
    });
    expect(outcome).toEqual({ successor: true, predecessor: true, toWrapper: true, untouched: true, optedOut: true });
  });
}, 30000);
