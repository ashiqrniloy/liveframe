import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDraftDirectory } from "../cli/draft-dir.ts";

/** A template draft under a fresh root, with a file beside the root that the draft must never read. */
async function withDraft(work: (root: string, outside: string) => Promise<void>) {
  const base = await fs.realpath(await fs.mkdtemp(join(tmpdir(), "liveframe-draft-")));
  const root = join(base, "root");
  const outside = join(base, "secret.json");
  try {
    await fs.mkdir(join(root, "widget"), { recursive: true });
    await Bun.write(outside, '"outside draftRoot"');
    for (const name of ["template.json", "manifest.json", "scenarios.json"])
      await Bun.write(join(root, "widget", name), "{}");
    await work(root, outside);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
}

const refused = {
  ok: false as const,
  errors: [expect.objectContaining({ kind: "invalid-document", pointer: "/dir" })],
};

test("a_draft_reads_through_its_handles", async () => {
  await withDraft(async (root) => {
    expect(await readDraftDirectory(root, { dir: "widget" })).toMatchObject({ ok: true, value: { template: {} } });
  });
});

test("hard_link_inside_draft_root_is_refused", async () => {
  await withDraft(async (root, outside) => {
    await fs.rm(join(root, "widget/manifest.json"));
    await fs.link(outside, join(root, "widget/manifest.json"));
    expect(await readDraftDirectory(root, { dir: "widget" })).toEqual(refused);
  });
});

test("symlink_swapped_after_the_check_is_not_followed", async () => {
  await withDraft(async (root, outside) => {
    const manifest = join(root, "widget/manifest.json");
    const lstat = fs.lstat;
    // Swap the checked file for a symlink out of the root between its lstat and its open.
    const spy = spyOn(fs, "lstat").mockImplementation((async (path: string) => {
      const info = await lstat(path);
      if (path === manifest) {
        await fs.rm(manifest);
        await fs.symlink(outside, manifest);
      }
      return info;
    }) as typeof fs.lstat);
    try {
      expect(await readDraftDirectory(root, { dir: "widget" })).toEqual(refused);
    } finally {
      spy.mockRestore();
    }
  });
});
