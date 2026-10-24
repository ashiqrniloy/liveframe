import { afterAll, beforeAll, expect, spyOn, test } from "bun:test";
import { type Browser, chromium, type Page } from "playwright";
import { drafts } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import * as pages from "../host/pages.ts";
import { startHost } from "../host/server.ts";

let server: Awaited<ReturnType<typeof startHost>>;
let browser: Browser;
beforeAll(async () => {
  server = await startHost(0);
  browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});
async function visit(run: (page: Page, session: string) => Promise<void>, query = "") {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${server.url}preview${query}`);
    await page.waitForSelector("[data-lf-ready]");
    const session = new URL(page.url()).searchParams.get("session");
    if (!session) throw new Error("Missing preview session");
    await run(page, session);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}
const post = (session: string, route: string, body: unknown) =>
  fetch(`${server.url}preview/${route}?session=${session}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test(
  "every_proof_scenario_draws_at_three_widths_under_both_design_systems",
  () =>
    visit(async (page, session) => {
      for (const draft of drafts) {
        expect((await (await post(session, "draft", draft)).json()).ok).toBe(true);
        for (const scenario of draft.scenarios) {
          const start = performance.now();
          await page.goto(`${server.url}preview?session=${session}&scenario=${scenario.name}`);
          await page.waitForSelector("[data-lf-ready]");
          if (draft === drafts[0] && scenario.name === "ready")
            console.log(`679-node 12-cell matrix navigation + draw: ${performance.now() - start} ms`);
          const cells = await page.locator("[data-lf-cell]").evaluateAll((elements) =>
            elements.map((element) => {
              const cell = JSON.parse(element.getAttribute("data-lf-cell") ?? "null");
              const surface = element.querySelector<HTMLElement>("[data-lf-theme]");
              return {
                cell,
                width: element.getBoundingClientRect().width,
                errors: element.getAttribute("data-lf-errors"),
                theme: surface?.dataset.lfTheme,
                ds: surface?.dataset.lfDs,
                font: surface && getComputedStyle(surface).fontFamily,
                fallback: element.textContent?.includes("Widget unavailable"),
              };
            }),
          );
          expect(cells).toHaveLength(12);
          for (const cell of cells) {
            expect(cell.width).toBe(cell.cell.width);
            expect(cell.errors).toBe("[]");
            expect(cell.theme).toBe(cell.cell.theme);
            expect(cell.ds).toBe(cell.cell.designSystem);
            expect(cell.font).toContain(cell.cell.theme.startsWith("certified@") ? "Schibsted Grotesk" : "Geist");
            expect(cell.fallback).toBe(false);
          }
        }
      }
    }),
  180000,
);

test(
  "set_state_rerenders_within_the_session_in_the_browser",
  () =>
    visit(async (page) => {
      await page.getByRole("button", { name: "Synthetic task 1", exact: true }).first().click();
      await page.getByRole("heading", { name: "Synthetic task 1", exact: true }).first().waitFor();
      expect(await page.getByRole("heading", { name: "Synthetic task 1", exact: true }).count()).toBe(12);
    }, "?scenario=ready"),
  30000,
);

test(
  "action_appears_in_the_log_and_the_dispatcher_records_no_call",
  () =>
    visit(async (page) => {
      const production = await pages.openPage("full", "harness");
      const dispatcher = spyOn(production, "dispatch");
      const open = spyOn(pages, "openPage").mockResolvedValue(production);
      try {
        await page.getByRole("button", { name: "Reassign the Hansen delivery milestone", exact: true }).first().click();
        await page
          .getByRole("heading", { name: "Reassign the Hansen delivery milestone", exact: true })
          .first()
          .waitFor();
        await page.getByRole("button", { name: "Claim", exact: true }).first().click();
        await page.waitForFunction(() =>
          document.querySelector('[aria-label="Intent log"]')?.textContent?.includes("tasks.claim"),
        );
        expect(dispatcher).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
      } finally {
        open.mockRestore();
        dispatcher.mockRestore();
      }
    }, "?scenario=host-ready"),
  30000,
);

test(
  "no_draft_code_reaches_the_browser_and_publish_stores_the_last_package",
  () =>
    visit(async (page, session) => {
      const original = drafts[0];
      if (!original) throw new Error("Missing draft");
      const marker = "PRIVATE_DRAFT_ONLY_009_T4";
      const draft = {
        ...original,
        files: { ...original.files, "entry.ts": `const ${marker} = 1;\n${original.files["entry.ts"]}` },
      };
      const packed = await (await post(session, "draft", draft)).json();
      expect(packed.ok).toBe(true);
      expect(JSON.stringify(packed)).not.toContain(marker);
      const response = await page.goto(`${server.url}preview?session=${session}&scenario=ready`);
      expect(await response?.text()).not.toContain(marker);
      await page.waitForSelector("[data-lf-ready]");
      expect(await page.content()).not.toContain(marker);
      for (const entry of ["client.js", "preview-client.js"])
        expect(await (await fetch(new URL(entry, server.url))).text()).not.toContain(marker);
      const published = await (await post(session, "publish", {})).json();
      expect(published.hash).toBe(packed.hash);
    }),
  30000,
);

test(
  "preview_routes_reject_bad_requests_and_isolate_sessions",
  () =>
    visit(async (_page, session) => {
      const url = `${server.url}preview/intent?session=${session}`;
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: { Origin: "https://elsewhere.test", "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
      ).toBe(403);
      expect((await fetch(url, { method: "POST", body: "{}" })).status).toBe(415);
      expect((await post("missing", "intent", {})).status).toBe(404);
      expect((await post(session, "draft", { files: null })).status).toBe(400);
      expect(
        (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status,
      ).toBe(400);
      expect(
        (
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: "x".repeat(2_000_000) }),
          })
        ).status,
      ).toBe(413);
      const other = await browser.newPage();
      try {
        await other.goto(`${server.url}preview`);
        await other.waitForSelector("[data-lf-ready]");
        expect(new URL(other.url()).searchParams.get("session")).not.toBe(session);
      } finally {
        await other.close();
      }
    }),
  30000,
);

test(
  "responsive_values_and_design_system_recipes_are_scoped_to_each_cell",
  () =>
    visit(async (page, session) => {
      const original = drafts[0];
      if (!original) throw new Error("Missing draft");
      const draft = {
        ...original,
        entry: "responsive.tsx",
        files: {
          ...original.files,
          "responsive.tsx": `/** @jsxImportSource @arnilo/liveframe/sdk */
import { Grid, Text, Button } from "./ui.gen.ts";
export default function Widget() { return <Grid columns={{ base: ["1fr"], "bp.md": ["1fr", "size.rail"] }}><Button label="Recipe" /><Text text="Cell" /></Grid>; }`,
        },
      };
      expect((await (await post(session, "draft", draft)).json()).ok).toBe(true);
      await page.goto(`${server.url}preview?session=${session}&scenario=ready`);
      await page.waitForSelector("[data-lf-ready]");
      const styles = await page.locator("[data-lf-cell]").evaluateAll((elements) =>
        elements.map((element) => {
          const grid = element.querySelector(".lf_grid_default_root");
          const button = element.querySelector(".lf_button_default_root");
          if (!grid || !button) throw new Error("Missing matrix fixture");
          return {
            cell: JSON.parse(element.getAttribute("data-lf-cell") ?? "null"),
            columns: getComputedStyle(grid).gridTemplateColumns.split(" "),
            radius: getComputedStyle(button).borderRadius,
          };
        }),
      );
      for (const style of styles) expect(style.columns).toHaveLength(style.cell.width === 360 ? 1 : 2);
      const certified = styles.find(
        (style) =>
          style.cell.width === 360 &&
          style.cell.theme === "certified@1.0.0" &&
          style.cell.designSystem === "certified@1.0.0",
      );
      const rack = styles.find(
        (style) =>
          style.cell.width === 360 &&
          style.cell.theme === "certified@1.0.0" &&
          style.cell.designSystem === "rack@1.0.0",
      );
      expect(certified?.radius).toBe("3px");
      expect(rack?.radius).toBe("7px");
    }),
  30000,
);

test(
  "only_scenario_changes_fetch_and_obsolete_responses_are_discarded",
  () =>
    visit(async (page) => {
      const requests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/preview/render") requests.push(request.url());
      });
      await page.locator("[data-lf-cell] > button").nth(5).click();
      expect(requests).toEqual([]);
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/preview/render?**", async (route) => {
        const response = await route.fetch();
        if (new URL(route.request().url()).searchParams.get("scenario") === "empty") await held;
        await route.fulfill({ response });
      });
      const empty = page.waitForRequest((request) => request.url().includes("scenario=empty"));
      await page.getByLabel("Scenario", { exact: true }).selectOption("empty");
      await empty;
      await page.getByLabel("Scenario", { exact: true }).selectOption("failed");
      release();
      await page.waitForSelector("[data-lf-ready]");
      expect(await page.getByLabel("Scenario", { exact: true }).inputValue()).toBe("failed");
      expect(await page.locator("[data-lf-cell]").first().textContent()).toContain("Retry the queue");
      expect(requests).toHaveLength(2);
    }),
  30000,
);
