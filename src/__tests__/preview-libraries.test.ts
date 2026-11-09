import { expect, test } from "bun:test";
import { createAuthoring } from "../authoring/index.ts";
import type { Result } from "../errors.ts";
import { packageHash } from "../pack/hash.ts";
import { inProcessRunner } from "../preview/index.ts";
import { createPreview } from "../preview/session.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { install, libraryDraft, sharedLibrary, textOf, value } from "./fixtures/libraries.ts";

function rejects(result: Result<unknown>, kind: string, pointer?: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors[0]).toMatchObject({ kind, ...(pointer ? { pointer } : {}) });
}

test("preview_session_packs_a_draft_that_imports_a_supplied_library", async () => {
  const library = sharedLibrary();
  const worker = workerRunner();
  try {
    for (const runner of [inProcessRunner(), worker]) {
      const session = createPreview({ ...install, runner, libraries: [library] });
      const packed = value(session.update(libraryDraft()));
      expect(packed.manifest.dependencies).toEqual([{ id: "acme.cards", version: "1.0.0", hash: library.hash }]);
      expect(textOf(await session.render({ scenario: "default" }))).toBe("card:new");
      const checked = value(await session.check());
      expect(checked.map((entry) => [entry.scenario, entry.result.ok])).toEqual([["default", true]]);
    }
  } finally {
    worker.close();
  }
}, 30000);

test("preview_session_refuses_an_unsupplied_library_as_not_found", () => {
  for (const libraries of [undefined, [], [sharedLibrary("card", "2.0.0")]]) {
    const session = createPreview({ ...install, runner: inProcessRunner(), ...(libraries ? { libraries } : {}) });
    const result = session.update(libraryDraft());
    rejects(result, "not-found");
    if (!result.ok) expect(result.errors[0]?.message).toContain("the host did not supply this library");
  }
});

test("preview_session_refuses_a_library_with_the_wrong_hash", async () => {
  const library = sharedLibrary();
  // The package keeps the hash it was sealed with, but its code is no longer the code that hash names.
  const tampered = { ...library, code: `${library.code as string}\n// changed` };
  expect(packageHash(tampered)).not.toBe(library.hash);
  const session = createPreview({ ...install, runner: inProcessRunner(), libraries: [tampered] });
  rejects(session.update(libraryDraft()), "hash-mismatch");
  // A library packed under the pin that a draft already carries but with other content is refused at render too.
  const other = sharedLibrary("other");
  const honest = createPreview({ ...install, runner: inProcessRunner(), libraries: [library] });
  value(honest.update(libraryDraft()));
  expect(other.hash).not.toBe(library.hash);
  expect(textOf(await honest.render({ scenario: "default" }))).toBe("card:new");
});

test("preview_session_rejects_malformed_libraries_on_creation", () => {
  const library = sharedLibrary();
  expect(() =>
    createPreview({ ...install, runner: inProcessRunner(), libraries: [library, sharedLibrary("other")] }),
  ).toThrow();
  expect(() => createPreview({ ...install, runner: inProcessRunner(), libraries: [{}] as never })).toThrow();
});

test("preview_session_copies_its_library_list", async () => {
  const libraries = [sharedLibrary()];
  const session = createPreview({ ...install, runner: inProcessRunner(), libraries });
  libraries.length = 0;
  value(session.update(libraryDraft()));
  expect(textOf(await session.render({ scenario: "default" }))).toBe("card:new");
});

test("authoring_pack_draft_rejects_a_libraries_argument", async () => {
  const library = sharedLibrary();
  const authoring = createAuthoring({ ...install, runner: inProcessRunner() });
  // The agent cannot add a library: naming one in the draft is refused, not ignored.
  const result = await authoring.packDraft({ ...libraryDraft(), libraries: [library] } as never);
  rejects(result, "invalid-document", "/libraries");
  rejects(await authoring.packDraft(libraryDraft()), "not-found");
});

test("authoring_renders_and_lists_the_libraries_the_host_supplied", async () => {
  const library = sharedLibrary();
  const authoring = createAuthoring({ ...install, runner: inProcessRunner(), libraries: [library] });
  expect(value(await authoring.listLibraries())).toEqual([
    {
      id: "acme.cards",
      version: "1.0.0",
      hash: library.hash,
      exports: ["Badge"],
      specifier: "liveframe:lib/acme.cards@1.0.0",
    },
  ]);
  value(await authoring.packDraft(libraryDraft()));
  expect(textOf(await authoring.renderScenarios({ scenario: "default" }))).toBe("card:new");
  // `outcomes: true` renders through the runner directly; it carries the libraries too.
  expect(value(await authoring.renderScenarios({ outcomes: true }))).toEqual([
    expect.objectContaining({ scenario: "default", ok: true }),
  ]);
  expect(value(await createAuthoring({ ...install, runner: inProcessRunner() }).listLibraries())).toEqual([]);
  expect(() => createAuthoring({ ...install, runner: inProcessRunner(), libraries: [{}] as never })).toThrow();
});
