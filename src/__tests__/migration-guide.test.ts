import { expect, test } from "bun:test";
import type { CaptureBackend } from "@arnilo/liveframe/preview/capture";
import { memoryStore, type Placement } from "@arnilo/liveframe/store";
import { readApiSurface } from "../../scripts/release/api-surface.ts";
import register from "../../scripts/release/api/register-0.3.0.json" with { type: "json" };
import { captureOnce, scopedState } from "./fixtures/migration-0.2.ts";

const guide = new URL("../../docs/migration-0.2.md", import.meta.url);
const fixture = new URL("./fixtures/migration-0.2.ts", import.meta.url);

const guide03 = new URL("../../docs/migration-0.3.md", import.meta.url);
const root = new URL("../../", import.meta.url).pathname;

type Entry = { change: string; migration?: string };

/** The `### ` entries under one `## ` section of the 0.3 guide, by heading. */
function entries(markdown: string, section: string): Map<string, string> {
  const body = markdown.split(`\n## ${section}\n`)[1]?.split(/\n## /)[0] ?? "";
  const found = new Map<string, string>();
  for (const part of body.split(/^### /m).slice(1)) {
    const newline = part.indexOf("\n");
    found.set(part.slice(0, newline).trim(), part.slice(newline + 1));
  }
  return found;
}

test("every_break_has_a_migration_entry", async () => {
  const markdown = await Bun.file(guide03).text();
  const breaking = entries(markdown, "Breaking changes");
  const registered = new Set<string>();
  for (const entry of register as Entry[]) {
    if (entry.change !== "changed" && entry.change !== "removed") continue;
    expect(entry.migration, "a break names its migration heading").toBeTruthy();
    registered.add(entry.migration as string);
  }

  // Register to guide: every break has a heading with before, after, a sample and a checklist.
  for (const heading of registered) {
    const section = breaking.get(heading);
    expect(section, `no "### ${heading}" under Breaking changes`).toBeDefined();
    for (const text of ["Before", "After", "```", "Adopter checklist"]) expect(section, heading).toContain(text);
  }
  // Guide to register: a heading under Breaking changes that no break names is documentation drift.
  for (const heading of breaking.keys()) expect(registered.has(heading), `unregistered heading: ${heading}`).toBe(true);
});

/** A fenced `ts`/`tsx` sample, with the heading it sits under. */
function samples(markdown: string): { heading: string; lang: string; code: string }[] {
  const found: { heading: string; lang: string; code: string }[] = [];
  let heading = "";
  for (const part of markdown.split(/^(### .*)$/m)) {
    if (part.startsWith("### ")) heading = part.slice(4).trim();
    for (const match of part.matchAll(/^```(tsx?)\n([\s\S]*?)^```/gm)) {
      found.push({ heading, lang: match[1] as string, code: match[2] as string });
    }
  }
  return found;
}

test("every_migration_sample_compiles", async () => {
  const markdown = await Bun.file(guide03).text();
  const found = samples(markdown);
  expect(found.length).toBeGreaterThan(10);

  // A sample must parse as TypeScript or TSX, and every name it imports from a package subpath must be an
  // export of the checkout. Free names stand for the reader's own variables.
  const surface = (await readApiSurface(root)).exports;
  const failures: string[] = [];
  for (const { heading, lang, code } of found) {
    try {
      new Bun.Transpiler({ loader: lang as "ts" | "tsx" }).transformSync(code);
    } catch (error) {
      failures.push(`${heading}: does not parse: ${String(error).split("\n")[0]}`);
      continue;
    }
    for (const match of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"@arnilo\/liveframe(\/[^"]*)?"/g)) {
      const exports = surface[match[2] ? `.${match[2]}` : "."];
      if (!exports) failures.push(`${heading}: no subpath ${match[2] ?? "."}`);
      for (const part of (match[1] ?? "").split(",")) {
        const name =
          part
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0] ?? "";
        if (name && !exports?.[name]) failures.push(`${heading}: ${name} is not exported from ${match[2] ?? "."}`);
      }
    }
  }
  expect(failures).toEqual([]);
});

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
