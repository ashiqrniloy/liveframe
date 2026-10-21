import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { startHost } from "../host/server.ts";

test("clay_panels_hydrate_under_rack_and_exercise_three_interaction_tiers", async () => {
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
      expect(await page.locator("#projection").getAttribute("href")).toBe("/styles/rack.css");
      if (name === "git-status") {
        await page.getByRole("heading", { name: "Git", exact: true }).waitFor();
        expect(await page.locator('[data-icon="git.branch"]').count()).toBe(4);
        expect(await page.locator('[data-icon="git.branch"]').first().textContent()).toBe("⑂");
        await page.getByText("Status: 2 changed", { exact: true }).waitFor();
      }
    }
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST") posts++;
    });
    const draft = page.getByRole("textbox", { name: "Message to Coding Agent" });
    await draft.fill("A local composer draft");
    expect(posts).toBe(0);
    const commit = page.waitForResponse((response) => response.url().endsWith("/intent"));
    await draft.blur();
    expect((await commit).ok()).toBe(true);
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
    await page.getByRole("button", { name: "Send", exact: true }).click();
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
