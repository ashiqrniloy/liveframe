import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startHost } from "../../proof/host/server.ts";
import { capture, PlaywrightMissing } from "../cli/capture.ts";
import { drafts } from "./fixtures/widgets/drafts.ts";

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

test("missing_playwright_reports_how_to_install", async () => {
  const error = await capture("http://127.0.0.1:1/", { out: "unused" }, () => Promise.reject(new Error("no"))).catch(
    (e) => e,
  );
  expect(error).toBeInstanceOf(PlaywrightMissing);
  expect(error.message).toContain("playwright install chromium");
  const cli = Bun.spawnSync(["bun", "src/cli/liveframe.ts", "preview", "capture"], { stderr: "pipe" });
  expect(cli.exitCode).toBe(2);
  expect(cli.stderr.toString()).toContain("Usage: liveframe preview capture");
});

test("gen_runs_without_playwright", async () => {
  const dir = await temp();
  try {
    const run = Bun.spawnSync(
      [
        "bun",
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
