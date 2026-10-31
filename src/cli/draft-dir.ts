import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { PackInput } from "../authoring/index.ts";
import type { LiveframeError, Result } from "../errors.ts";

const maxBytes = 1048576;
const failure = (kind: LiveframeError["kind"], message: string): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer: "/dir", message }],
});
const contained = (root: string, path: string) => {
  const fromRoot = relative(root, path);
  return fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
};

const validDirectory = (dir: unknown): dir is string =>
  typeof dir === "string" &&
  dir.length > 0 &&
  !isAbsolute(dir) &&
  !dir.split(/[\\/]/).includes("..") &&
  !dir.includes("\0");

/** Read only data beneath the host's opt-in root; the packer still validates the documents. */
export async function readDraftDirectory(
  root: string | undefined,
  input: Record<string, unknown>,
): Promise<Result<PackInput>> {
  if (root === undefined) return failure("not-found", "Configure draftRoot to read draft directories");
  const { dir, entry = "entry.tsx" } = input;
  if (!validDirectory(dir))
    return failure("invalid-document", "dir must be a non-empty relative path without .. segments");
  if (["files", "manifest", "scenarios"].some((key) => Object.hasOwn(input, key)))
    return failure("invalid-document", "dir cannot be combined with files, manifest or scenarios");
  try {
    const directory = await realpath(join(root, dir));
    if (!contained(root, directory)) return failure("invalid-document", "Draft directory escapes draftRoot");
    if (!(await lstat(directory)).isDirectory()) return failure("invalid-document", "Expected a draft directory");
    const sources = (await readdir(directory, { withFileTypes: true }))
      .map(({ name }) => name)
      .filter((name) => /\.tsx?$/.test(name));
    if (sources.length > 128) return failure("limit-exceeded", "Draft exceeds 128 source files");
    if (typeof entry !== "string" || !sources.includes(entry))
      return failure("not-found", "Draft entry file is missing");
    const selected: { name: string; path: string }[] = [];
    let size = 0;
    for (const name of [...sources, "manifest.json", "scenarios.json"]) {
      const path = await realpath(join(directory, name));
      if (!contained(root, path)) return failure("invalid-document", `Draft file ${name} escapes draftRoot`);
      const info = await lstat(path);
      if (!info.isFile()) return failure("invalid-document", `Draft file ${name} must be a regular file`);
      size += info.size;
      if (size > maxBytes) return failure("limit-exceeded", "Draft exceeds 1048576 aggregate bytes");
      selected.push({ name, path });
    }
    const contents: Record<string, string> = {};
    let bytesRead = 0;
    for (const { name, path } of selected) {
      // Bound actual reads too, in case a file grew after the size check.
      const bytes = await Bun.file(path)
        .slice(0, maxBytes - bytesRead + 1)
        .bytes();
      bytesRead += bytes.length;
      if (bytesRead > maxBytes) return failure("limit-exceeded", "Draft exceeds 1048576 aggregate bytes");
      contents[name] = new TextDecoder().decode(bytes);
    }
    const manifest: unknown = JSON.parse(contents["manifest.json"]!);
    const scenarios: unknown = JSON.parse(contents["scenarios.json"]!);
    const files = Object.fromEntries(sources.map((name) => [name, contents[name]!]));
    return { ok: true, value: { files, entry, manifest, scenarios } };
  } catch (error) {
    if (error instanceof SyntaxError) return failure("invalid-document", "Draft contains malformed JSON");
    const missing = (error as { code?: string }).code === "ENOENT";
    return failure(missing ? "not-found" : "invalid-document", error instanceof Error ? error.message : String(error));
  }
}
