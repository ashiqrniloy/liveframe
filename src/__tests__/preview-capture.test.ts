import { expect, test } from "bun:test";
import { capture, CaptureError, type CaptureAxes } from "@arnilo/liveframe/preview/capture";
import { fakeCapture } from "./fixtures/capture-backend.ts";

const axes: CaptureAxes = {
  scenarios: ["a b", "a-b"],
  widths: [360, 768],
  themes: ["light", "dark"],
  designSystems: ["plain", "other"],
  urlKey: "draft",
};
const url = "https://example.test/preview?keep=yes";
test("capture_with_fake_backend_covers_contract", async () => {
  const fake = fakeCapture(axes);
  const result = await capture(url, {
    backend: fake.backend,
    widths: [360],
    themes: ["dark"],
    designSystems: ["other"],
  });
  expect(result.index.cells).toHaveLength(2);
  expect(result.index.cells.map((cell) => cell.png)).toEqual(["a-b_360_dark_other.png", "a-b_360_dark_other-2.png"]);
  expect(result.files.size).toBe(5);
  expect(JSON.parse(new TextDecoder().decode(result.files.get("index.json")))).toEqual(result.index);
  expect(fake.opened.map((target) => new URL(target).searchParams.get("draft.scenario"))).toEqual([null, "a b", "a-b"]);
  expect(fake.opened.every((target) => new URL(target).searchParams.get("keep") === "yes")).toBe(true);
  expect(fake.waited).toEqual(["[data-lf-ready]", "[data-lf-ready]", "[data-lf-ready]"]);
  expect(fake.closed).toEqual(fake.opened);
  expect(fake.backendClosed).toBe(1);
});

test.each([{ scenarios: ["missing"] }, { widths: [1] }, { themes: ["missing"] }, { designSystems: ["missing"] }])(
  "capture_rejects_unknown_axis: %j",
  async (options) => {
    const fake = fakeCapture();
    await expect(capture(url, { backend: fake.backend, ...options })).rejects.toMatchObject({ kind: "unknown-name" });
    expect(fake.shots).toBe(0);
    expect(fake.closed).toEqual(fake.opened);
    expect(fake.backendClosed).toBe(1);
  },
);

test("capture_bounds_cells_before_screenshots", async () => {
  const fake = fakeCapture();
  await expect(capture(url, { backend: fake.backend, maxCells: 1 })).rejects.toMatchObject({ kind: "limit-exceeded" });
  expect(fake.shots).toBe(0);
});

test("capture_records_null_snapshot", async () => {
  const fake = fakeCapture(undefined, null);
  const { index, files } = await capture(url, { backend: fake.backend, scenarios: ["empty"], widths: [360] });
  expect(index.cells).toHaveLength(1);
  expect(index.cells[0]?.snapshot).toBeNull();
  expect([...files.keys()]).toEqual(["empty_360_light_plain.png", "index.json"]);
});

test("capture_controlled_page_keeps_shown_scenario", async () => {
  const fake = fakeCapture({ ...axes, controlled: true, shown: "a b" });
  const { index } = await capture(url, { backend: fake.backend });
  expect(index.cells.every((cell) => cell.scenario === "a b")).toBe(true);
  expect(fake.opened).toEqual([url]);
  await expect(capture(url, { backend: fake.backend, scenarios: ["a-b"] })).rejects.toMatchObject({
    kind: "not-found",
  });
});

test("capture_closes_sessions_and_backend_on_failure", async () => {
  const fake = fakeCapture();
  const open = fake.backend.open;
  fake.backend.open = async (target) => ({
    ...(await open(target)),
    async waitReady() {
      throw new CaptureError("not-found", "never ready");
    },
  });
  await expect(capture(url, { backend: fake.backend })).rejects.toThrow("never ready");
  expect(fake.closed).toEqual(fake.opened);
  expect(fake.backendClosed).toBe(1);
});

test("capture_subpath_imports_without_playwright", () => {
  const run = Bun.spawnSync(
    [
      "bun",
      "--conditions",
      "liveframe:source",
      "--preload",
      "./src/__tests__/fixtures/no-playwright.ts",
      "--eval",
      'const m = await import("@arnilo/liveframe/preview/capture"); if (typeof m.capture !== "function") throw Error("missing capture")',
    ],
    { stderr: "pipe" },
  );
  expect(run.stderr.toString()).toBe("");
  expect(run.exitCode).toBe(0);
});

test("capture_preserves_cell_errors", async () => {
  const fake = fakeCapture();
  const open = fake.backend.open;
  const errors = [{ kind: "invalid-prop" as const, pointer: "/root/props/text", message: "bad text", nodeId: "root" }];
  fake.backend.open = async (target) => {
    const session = await open(target);
    return {
      ...session,
      async cells() {
        return (await session.cells()).map((cell) => ({ ...cell, errors }));
      },
    };
  };
  const { index } = await capture(url, { backend: fake.backend });
  expect(index.cells.every((cell) => cell.errors === errors)).toBe(true);
});

test("capture_closes_backend_when_open_fails", async () => {
  const fake = fakeCapture();
  fake.backend.open = async () => {
    throw new Error("cannot open");
  };
  await expect(capture(url, { backend: fake.backend })).rejects.toThrow("cannot open");
  expect(fake.backendClosed).toBe(1);
});
