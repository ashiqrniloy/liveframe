import { afterAll, expect, test } from "bun:test";
import { createAuthoring } from "@arnilo/liveframe/authoring";
import { quickjsRunner } from "../index.ts";
import { install, libraryDraft, sharedLibrary, textOf, value } from "../../../../src/__tests__/fixtures/libraries.ts";

const runner = await quickjsRunner({ timeoutMs: 5000 });
afterAll(() => runner.close());

test("mcp_tools_render_a_library_widget_on_quickjs", async () => {
  const library = sharedLibrary();
  const authoring = createAuthoring({ ...install, runner, libraries: [library] });
  expect(value(await authoring.listLibraries()).map(({ specifier }) => specifier)).toEqual([
    "liveframe:lib/acme.cards@1.0.0",
  ]);
  value(await authoring.packDraft(libraryDraft()));
  expect(textOf(await authoring.renderScenarios({ scenario: "default" }))).toBe("card:new");
  expect(value(await authoring.renderScenarios({ outcomes: true }))).toEqual([
    expect.objectContaining({ scenario: "default", ok: true }),
  ]);
  // Without the host's library nothing packs, so nothing reaches the runner.
  const bare = createAuthoring({ ...install, runner });
  const refused = await bare.packDraft(libraryDraft());
  expect(refused.ok).toBe(false);
});
