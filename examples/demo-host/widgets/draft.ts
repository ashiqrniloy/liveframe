import { readdir } from "node:fs/promises";
import { join } from "node:path";

/** Read a widget directory into the draft `POST /widgets` takes: sources, entry, manifest and scenarios. */
export async function readDraft(dir: string, entry = "entry.tsx") {
  const files: Record<string, string> = {};
  for (const name of await readdir(dir)) {
    if (/\.tsx?$/.test(name)) files[name] = await Bun.file(join(dir, name)).text();
  }
  return {
    files,
    entry,
    manifest: await Bun.file(join(dir, "manifest.json")).json(),
    scenarios: await Bun.file(join(dir, "scenarios.json")).json(),
  };
}
