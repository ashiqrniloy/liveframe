import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drafts } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { capture, CaptureError, PlaywrightMissing } from "../../src/cli/capture.ts";
import { startHost } from "../host/server.ts";

let server: Awaited<ReturnType<typeof startHost>>;
let out: string;
beforeAll(async () => {
  server = await startHost(0);
}, 30000);
afterAll(async () => {
  await server?.stop(true);
});
const temp = async () => {
  out = await mkdtemp(join(tmpdir(), "liveframe-capture-"));
  return out;
};
const page = (query = "") => `${server.url}preview${query}`;

test("capture_writes_png_snapshot_and_index_per_cell", async () => {
  const dir = await temp();
  try {
    const index = await capture(page(), { out: dir, scenarios: ["ready"], widths: [360, 768] });
    expect(index.cells).toHaveLength(2 * 2 * 2);
    expect(new Set(index.cells.map((cell) => cell.png)).size).toBe(index.cells.length);
    for (const cell of index.cells) {
      const png = new Uint8Array(await Bun.file(join(dir, cell.png)).arrayBuffer());
      expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      if (cell.snapshot === null) throw new Error("Playwright omitted its snapshot");
      expect(await Bun.file(join(dir, cell.snapshot)).text()).toContain("- ");
      expect(cell.errors).toEqual([]);
    }
    expect(await Bun.file(join(dir, "index.json")).json()).toEqual(index);
  } finally {
    await rm(dir, { recursive: true });
  }
}, 120000);

test("flags_narrow_the_cells", async () => {
  const dir = await temp();
  try {
    const all = await capture(page(), { out: dir, scenarios: ["ready"], widths: [768] });
    const [first] = all.cells;
    if (!first) throw new Error("no cells");
    const index = await capture(page(), {
      out: dir,
      scenarios: ["ready"],
      widths: [768],
      themes: [first.theme],
      designSystems: [first.designSystem],
    });
    expect(
      index.cells.map(({ scenario, width, theme, designSystem }) => ({ scenario, width, theme, designSystem })),
    ).toEqual([{ scenario: "ready", width: 768, theme: first.theme, designSystem: first.designSystem }]);
    expect((await readdir(dir)).filter((name) => name.endsWith(".png"))).toHaveLength(all.cells.length);
    await expect(capture(page(), { out: dir, widths: [1] })).rejects.toThrow("declares no width 1");
  } finally {
    await rm(dir, { recursive: true });
  }
}, 120000);

test("cell_errors_reach_the_index", async () => {
  const dir = await temp();
  try {
    const html = await (await fetch(page())).text();
    const session = /"session":"([^"]+)"/.exec(html)?.[1];
    const draft = drafts[0] as (typeof drafts)[0] & { files: Record<string, string> };
    if (!draft) throw new Error("no draft");
    const broken = {
      ...draft,
      files: {
        ...draft.files,
        "agent-home/queue.tsx": draft.files["agent-home/queue.tsx"]?.replace(
          '<Stack gap="space.3">',
          '<Stack gap="space.99">',
        ),
      },
    };
    const posted = await fetch(`${server.url}preview/draft?session=${session}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(broken),
    });
    const body = await posted.json();
    expect(body.ok).toBe(true);
    const index = await capture(page(`?session=${session}`), { out: dir, scenarios: ["ready"], widths: [360] });
    expect(index.cells.length).toBeGreaterThan(0);
    for (const cell of index.cells) expect(cell.errors.length).toBeGreaterThan(0);
  } finally {
    await rm(dir, { recursive: true });
  }
}, 120000);

test("cells_whose_names_sanitise_alike_keep_distinct_files", async () => {
  const dir = await temp();
  try {
    const html = await (await fetch(page())).text();
    const session = /"session":"([^"]+)"/.exec(html)?.[1];
    const draft = drafts[0];
    const ready = draft?.scenarios.find((scenario) => scenario.name === "ready");
    if (!draft || !ready) throw new Error("no ready scenario");
    const posted = await fetch(`${server.url}preview/draft?session=${session}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        scenarios: [
          { ...ready, name: "a b" },
          { ...ready, name: "a-b" },
        ],
      }),
    });
    expect((await posted.json()).ok).toBe(true);
    const index = await capture(page(`?session=${session}`), { out: dir, widths: [360] });
    expect(index.cells).toHaveLength(2 * 4);
    expect(new Set(index.cells.map((cell) => cell.png)).size).toBe(index.cells.length);
    expect(new Set(index.cells.map((cell) => cell.snapshot)).size).toBe(index.cells.length);
    for (const cell of index.cells) expect(await Bun.file(join(dir, cell.png)).exists()).toBe(true);
  } finally {
    await rm(dir, { recursive: true });
  }
}, 120000);

test("missing_playwright_reports_how_to_install", async () => {
  const error = await capture("http://127.0.0.1:1/", { out: "unused" }, () => Promise.reject(new Error("no"))).catch(
    (e) => e,
  );
  expect(error).toBeInstanceOf(PlaywrightMissing);
  expect(error.message).toContain("playwright install chromium");
  const cli = Bun.spawnSync(["bun", "--conditions", "liveframe:source", "src/cli/liveframe.ts", "preview", "capture"], {
    stderr: "pipe",
  });
  expect(cli.exitCode).toBe(2);
  expect(cli.stderr.toString()).toContain("Usage: liveframe preview capture");
});

test("capture_errors_carry_their_kind", async () => {
  const missing = await capture("http://127.0.0.1:1/", { out: "unused" }, () => Promise.reject(new Error("no"))).catch(
    (error) => error,
  );
  expect(missing).toBeInstanceOf(PlaywrightMissing);
  expect(missing.kind).toBe("not-found");
  expect(missing.message).toContain("playwright install chromium");

  // Playwright has no error class for a missing browser, so the tag comes from the one launch site.
  const launchFails = (message: string) =>
    (async () => ({
      chromium: {
        launch: async () => {
          throw new Error(message);
        },
      },
    })) as never;
  const noBrowser = await capture(
    "http://127.0.0.1:1/",
    { out: "unused" },
    launchFails("browserType.launch: Executable doesn't exist at /browsers/chromium-1228/chrome"),
  ).catch((error) => error);
  expect(noBrowser).toBeInstanceOf(CaptureError);
  expect(noBrowser.kind).toBe("not-found");
  expect(noBrowser.message).toContain("playwright install chromium");

  // An unreachable page is not-found too, and a launch failure that is not about installation stays as it was.
  const unreachable = await capture("http://127.0.0.1:1/", { out: "unused" }).catch((error) => error);
  expect(unreachable).toBeInstanceOf(CaptureError);
  expect(unreachable.kind).toBe("not-found");
  const sandbox = await capture(
    "http://127.0.0.1:1/",
    { out: "unused" },
    launchFails("browserType.launch: sandbox is unavailable"),
  ).catch((error) => error);
  expect(sandbox).not.toBeInstanceOf(CaptureError);
}, 120000);

test("capture_without_playwright_reports_install_hint", async () => {
  const dir = await temp();
  try {
    // The preload blocks both Playwright specifiers; without it the installed peer would load and
    // report an unreachable page instead of the install hint, so this fails if the block goes away.
    const run = Bun.spawnSync(
      [
        "bun",
        "--conditions",
        "liveframe:source",
        "--preload",
        "./src/__tests__/fixtures/no-playwright.ts",
        "src/cli/liveframe.ts",
        "preview",
        "capture",
        "http://127.0.0.1:1/",
        "--out",
        join(dir, "cells"),
      ],
      { stderr: "pipe" },
    );
    expect(run.exitCode).toBe(1);
    expect(run.stderr.toString()).toContain("bunx playwright install chromium");
    expect(run.stderr.toString()).not.toContain("Cannot open");
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("gen_runs_without_playwright", async () => {
  const dir = await temp();
  try {
    const run = Bun.spawnSync(
      [
        "bun",
        "--conditions",
        "liveframe:source",
        "--preload",
        "./src/__tests__/fixtures/no-playwright.ts",
        "src/cli/liveframe.ts",
        "gen",
        "src/__tests__/fixtures/proof/catalog.json",
        "--out",
        join(dir, "ui.gen.ts"),
      ],
      { stderr: "pipe" },
    );
    expect(run.stderr.toString()).toBe("");
    expect(run.exitCode).toBe(0);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("capture_preserves_page_cookies_across_scenarios", async () => {
  const cookies: boolean[] = [];
  const local = Bun.serve({
    port: 0,
    fetch(request) {
      const scenario = new URL(request.url).searchParams.get("scenario");
      if (scenario) cookies.push(request.headers.get("cookie")?.includes("capture-session=ready") === true);
      const axes = { scenarios: ["one", "two"], widths: [360], themes: ["light"], designSystems: ["plain"] };
      const cell = { scenario: scenario ?? "one", width: 360, theme: "light", designSystem: "plain" };
      return new Response(
        `<main data-lf-ready data-lf-preview='${JSON.stringify(axes)}'><div data-lf-cell='${JSON.stringify(cell)}'>Hello</div></main>`,
        {
          headers: { "content-type": "text/html", "set-cookie": "capture-session=ready; Path=/" },
        },
      );
    },
  });
  const dir = await temp();
  try {
    const index = await capture(local.url.href, { out: dir });
    expect(index.cells).toHaveLength(2);
    expect(cookies).toEqual([true, true]);
  } finally {
    await local.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);

test("layout_files_hold_node_boxes_from_the_real_host", async () => {
  const dir = await temp();
  try {
    const index = await capture(page(), { out: dir, scenarios: ["ready"], widths: [360], layout: true });
    expect(index.cells.length).toBeGreaterThan(0);
    for (const cell of index.cells) {
      expect(cell.layout).toBe(cell.png.replace(/\.png$/, ".layout.json"));
      const layout = await Bun.file(join(dir, cell.layout as string)).json();
      expect(layout.width).toBe(360);
      expect(layout.nodes.length).toBeGreaterThan(0);
      expect(layout.nodes.some((node: { height: number }) => node.height > 0)).toBe(true);
    }
    const plain = await capture(page(), { out: dir, scenarios: ["ready"], widths: [360] });
    expect(plain.cells.every((cell) => !("layout" in cell))).toBe(true);
  } finally {
    await rm(dir, { recursive: true });
  }
}, 120000);

test("cli_layout_flag_writes_layout_files", async () => {
  const dir = await temp();
  try {
    const run = Bun.spawn(
      [
        "bun",
        "--conditions",
        "liveframe:source",
        "src/cli/liveframe.ts",
        "preview",
        "capture",
        page(),
        "--out",
        dir,
        "--scenario",
        "ready",
        "--width",
        "360",
        "--layout",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(await run.exited).toBe(0);
    expect((await readdir(dir)).filter((name) => name.endsWith(".layout.json")).length).toBeGreaterThan(0);
    expect((await Bun.file(join(dir, "index.json")).json()).cells[0].layout).toMatch(/\.layout\.json$/);
  } finally {
    await rm(dir, { recursive: true });
  }
}, 120000);
