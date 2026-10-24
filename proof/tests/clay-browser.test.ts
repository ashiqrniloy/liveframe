import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { themeSheets } from "../css/sheets.ts";
import { startHost } from "../host/server.ts";

for (const system of ["certified", "rack"])
  test(`clay_panels_hydrate_and_exercise_three_interaction_tiers_${system}`, async () => {
    const server = await startHost(0);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      for (const name of ["git-status", "rack-module"]) {
        await page.goto(new URL(`/ui/${name}`, server.url).toString());
        await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
        expect(await page.getByLabel("Design system").inputValue()).toBe("rack");
        expect(await page.locator("#app > div:first-child").getAttribute("data-lf-ds")).toBe("rack@1.0.0");
        if (name === "git-status") {
          await page.getByRole("heading", { name: "Git", exact: true }).waitFor();
          expect(await page.locator('[data-icon="git.branch"]').count()).toBe(4);
          expect(await page.locator('[data-icon="git.branch"]').first().textContent()).toBe("⑂");
          await page.getByText("Status: 2 changed", { exact: true }).waitFor();
        }
      }
      await page.getByLabel("Design system").selectOption(system);
      let posts = 0;
      page.on("request", (request) => {
        if (request.method() === "POST") posts++;
      });
      const draft = page.getByRole("textbox", { name: "Message to Coding Agent" });
      await draft.fill("A local composer draft");
      expect(posts).toBe(0);
      const commit = page.waitForResponse((response) => response.url().endsWith("/intent"));
      await draft.blur();
      const committed = await commit;
      expect(committed.ok()).toBe(true);
      const committedTree = (await committed.json()).tree;
      for (const name of ["OM", "Context", "Files"]) {
        const response = page.waitForResponse((response) => response.url().endsWith("/intent"));
        await page.getByRole("tab", { name, exact: true }).click();
        const result = await (await response).json();
        expect(result.tree.root).toBeDefined();
        await page.waitForFunction(() => document.getElementById("status")?.textContent === "");
        expect(await page.getByRole("tab", { name, exact: true }).getAttribute("aria-selected")).toBe("true");
        expect(await draft.inputValue()).toBe("A local composer draft");
      }
      await page.getByText("ContainerTrack.tsx", { exact: true }).waitFor();
      const sent = page.waitForResponse((response) => response.url().endsWith("/intent"));
      const beforeSend = posts;
      await page.getByRole("button", { name: "Send", exact: true }).click();
      const sentResponse = await sent;
      const sentResult = await sentResponse.json();
      expect(sentResult.tree.revision).toBe(sentResponse.request().postDataJSON().revision);
      expect(sentResult.tree.revision).toBe(committedTree.revision + 3);
      expect(sentResult.actions).toEqual([
        {
          type: "action",
          name: "agent.send",
          args: { sessionId: "clay/coding-agent", message: "A local composer draft" },
        },
      ]);
      expect(posts).toBe(beforeSend + 1);
      await page.waitForFunction(() =>
        document.getElementById("actions")?.textContent?.includes("A local composer draft"),
      );
      await page.getByRole("button", { name: "Close container", exact: true }).click();
      await page.waitForFunction(() => document.getElementById("actions")?.textContent?.includes("container.close"));
      expect(await page.locator("#status").textContent()).toBe("");
      await draft.fill("");
      const emptyCommit = page.waitForResponse((response) => response.url().endsWith("/intent"));
      await draft.blur();
      expect((await emptyCommit).ok()).toBe(true);
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("button")).some(
          (button) => button.textContent === "Send" && button.disabled,
        ),
      );
      expect(await page.getByRole("button", { name: "Send", exact: true }).isDisabled()).toBe(true);
      // Indicators draw declared fill roles, so the switch repaints them: identity (patch) for both
      // presentations of the session, accent for the Working lamp and the effort pips.
      const indicators = () =>
        page.evaluate(() => {
          const pick = (role: string) =>
            Array.from(document.querySelectorAll<HTMLElement>(`[style*="--lf-c-${role}"]`)).map((element) => {
              const style = getComputedStyle(element);
              return {
                role: style.getPropertyValue(`--lf-c-${role}`).trim(),
                fill: style.backgroundColor,
                radius: style.borderTopLeftRadius,
                width: style.width,
                height: style.height,
              };
            });
          return { patch: pick("patch_1"), accent: pick("accent_primary") };
        });
      await page.getByLabel("Design system").selectOption("rack");
      const rack = await indicators();
      // The rail patch and the composer patch carry the session's identity colour.
      expect(rack.patch).toHaveLength(2);
      for (const marker of rack.patch) {
        expect(marker.role).toBe(themeSheets.rack.match(/--lf-c-patch_1:([^;}]+)/)?.[1] ?? "missing role");
        expect([marker.radius, marker.width, marker.height]).toEqual(["9999px", "8px", "8px"]);
      }
      expect(new Set(rack.patch.map((marker) => marker.fill)).size).toBe(1);
      // One round lamp beside three narrow pips.
      expect(rack.accent).toHaveLength(4);
      expect(
        rack.accent.filter((marker) => marker.radius === "9999px" && marker.width === "8px" && marker.height === "8px"),
      ).toHaveLength(1);
      expect(
        rack.accent.filter((marker) => marker.radius !== "9999px" && marker.width === "4px" && marker.height === "8px"),
      ).toHaveLength(3);
      expect(new Set(rack.accent.map((marker) => marker.fill)).size).toBe(1);
      expect(rack.patch[0]?.fill).not.toBe("rgba(0, 0, 0, 0)");
      await page.getByLabel("Design system").selectOption("certified");
      const certified = await indicators();
      // Under Certified the same roles resolve through its palette aliases; the limitation stays data,
      // not a widget workaround, and the pip corner follows the theme's radius value.
      for (const marker of certified.patch)
        expect(marker.role).toBe(themeSheets.certified.match(/--lf-c-patch_1:([^;}]+)/)?.[1] ?? "missing role");
      expect(certified.patch[0]?.fill).not.toBe(rack.patch[0]?.fill);
      expect(certified.accent[0]?.fill).not.toBe(rack.accent[0]?.fill);
      expect(certified.accent.filter((marker) => marker.radius !== "9999px").map((marker) => marker.radius)).toEqual([
        "2px",
        "2px",
        "2px",
      ]);
      await page.getByLabel("Design system").selectOption("rack");
      await page.goto(new URL("/ui/git-status?scenario=empty", server.url).toString());
      await page.getByText("No workspace roots", { exact: true }).waitFor();
      const bundle = await (await fetch(new URL("/client.js", server.url))).text();
      for (const name of ["GitStatus", "RackModule", "gitStatusModel", "rootLabel"]) expect(bundle).not.toContain(name);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await server.stop(true);
    }
  }, 30000);
