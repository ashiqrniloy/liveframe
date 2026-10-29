import { expect, test } from "bun:test";
import type { CaptureBackend } from "@arnilo/liveframe/preview/capture";
import { memoryStore, type Placement } from "@arnilo/liveframe/store";
import { captureOnce, scopedState } from "./fixtures/migration-0.2.ts";

const guide = new URL("../../docs/migration-0.2.md", import.meta.url);
const fixture = new URL("./fixtures/migration-0.2.ts", import.meta.url);

/** One exported function of the fixture, exactly as the guide prints it. */
async function sample(name: string): Promise<string> {
  const source = await Bun.file(fixture).text();
  const start = source.indexOf(`export async function ${name}`);
  const end = source.indexOf("\n}\n", start) + 3;
  return source.slice(start, end).trimEnd();
}

test("migration_guide_examples_run", async () => {
  const markdown = await Bun.file(guide).text();
  for (const name of ["scopedState", "captureOnce"]) {
    expect(markdown, name).toContain(["```ts", await sample(name), "```"].join("\n"));
  }

  // The guide's store sample: two viewers, one shared state, deletion removes both.
  const placement: Placement = { id: "home", slot: "main", widget: { id: "w", version: "1" }, params: {} };
  const stored = await scopedState(memoryStore(), placement, { filter: "all" });
  expect(stored.shared).toEqual({ filter: "all" });
  expect(stored.mine).toEqual({ filter: "all" });
  expect(stored.afterDelete).toBeUndefined();

  // The guide's capture sample, driven by a backend that needs no browser.
  const backend: CaptureBackend<number> = {
    open: async () => ({
      waitReady: async () => {},
      axes: async () => ({ scenarios: ["ready"], widths: [320], themes: ["acme"], designSystems: ["default"] }),
      cells: async () => [
        { handle: 1, scenario: "ready", width: 320, theme: "acme", designSystem: "default", errors: [] },
      ],
      screenshot: async () => new Uint8Array([1, 2, 3]),
      ariaSnapshot: async () => null,
      close: async () => {},
    }),
  };
  const captured = await captureOnce("http://preview.test/", backend);
  expect(captured.index.cells).toHaveLength(1);
  expect(captured.files.has("index.json")).toBe(true);
  expect([...captured.files.keys()].some((name) => name.endsWith(".png"))).toBe(true);
});
