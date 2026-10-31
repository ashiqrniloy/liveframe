import { expect, test } from "bun:test";
import { capture, CaptureError, type CaptureAxes, type CellLayout } from "@arnilo/liveframe/preview/capture";
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

const layoutOf = (width: number): CellLayout => ({
  width,
  height: 100,
  overflowX: false,
  overflowing: [],
  nodes: [{ id: "n1", x: 0, y: 0, width, height: 40 }],
});
const decode = (bytes: Uint8Array | undefined) => JSON.parse(new TextDecoder().decode(bytes));

test("layout_off_results_unchanged", async () => {
  const withMethod = await capture(url, { backend: fakeCapture(axes, '- text "Hello"', layoutOf).backend });
  const without = await capture(url, { backend: fakeCapture(axes).backend });
  expect(withMethod.index).toEqual(without.index);
  expect([...withMethod.files.keys()]).toEqual([...without.files.keys()]);
  expect(withMethod.index.cells.every((cell) => !("layout" in cell))).toBe(true);
});

test("layout_on_writes_a_file_per_cell", async () => {
  const result = await capture(url, {
    backend: fakeCapture(axes, '- text "Hello"', layoutOf).backend,
    scenarios: ["a b"],
    widths: [360],
    themes: ["light"],
    designSystems: ["plain"],
    layout: true,
  });
  expect(result.index.cells).toEqual([expect.objectContaining({ layout: "a-b_360_light_plain.layout.json" })]);
  expect(decode(result.files.get("a-b_360_light_plain.layout.json"))).toEqual(layoutOf(360));
  expect(decode(result.files.get("index.json"))).toEqual(result.index);
});

test("custom_backend_without_layout_gives_null", async () => {
  const result = await capture(url, { backend: fakeCapture(axes).backend, layout: true });
  expect(result.index.cells.every((cell) => cell.layout === null)).toBe(true);
  expect([...result.files.keys()].some((name) => name.endsWith(".layout.json"))).toBe(false);
});

test("layout_over_bound_is_limit_exceeded", async () => {
  const huge = (width: number): CellLayout => ({
    ...layoutOf(width),
    nodes: Array.from({ length: 6000 }, (_, i) => ({ id: `node-${i}`, x: 0, y: i, width, height: 1 })),
  });
  const error = await capture(url, {
    backend: fakeCapture(axes, null, huge).backend,
    scenarios: ["a b"],
    widths: [360],
    themes: ["light"],
    designSystems: ["plain"],
    layout: true,
  }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(CaptureError);
  expect(error).toMatchObject({ kind: "limit-exceeded", pointer: "/layout" });
  expect((error as Error).message).toContain("a b 360 light plain");
});

test.each([
  ["a non-finite number", { ...layoutOf(1), height: Number.NaN }],
  ["a missing field", { width: 1, height: 1, overflowX: false, nodes: [] }],
  ["an extra field", { ...layoutOf(1), text: "page content" }],
  ["a node with an extra field", { ...layoutOf(1), nodes: [{ id: "n", x: 0, y: 0, width: 1, height: 1, text: "t" }] }],
])("layout_rejects_malformed_backend_result: %s", async (_name, bad) => {
  const fake = fakeCapture(axes, null, () => bad as unknown as CellLayout);
  await expect(capture(url, { backend: fake.backend, layout: true })).rejects.toThrow(/layout/i);
});
