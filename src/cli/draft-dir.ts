import { constants, type FileHandle, lstat, open, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { boundedDirectoryDraft, MAX_DRAFT_BYTES } from "../authoring/draft-limits.ts";
import type { PackInput } from "../authoring/index.ts";
import type { LiveframeError, Result } from "../errors.ts";

const failure = (kind: LiveframeError["kind"], message: string): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer: "/dir", message }],
});
const contained = (root: string, path: string) => {
  const fromRoot = relative(root, path);
  return fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
};

/** A read error described relative to `draftRoot`: Node's own message carries the host's absolute path. */
function readFailure(error: unknown, dir: string, target: string | undefined): Result<never> {
  const code = (error as { code?: unknown }).code;
  const what = target === undefined ? `draft directory "${dir}"` : `draft file "${target}" in "${dir}"`;
  if (code === "ENOENT") return failure("not-found", `${what} not found`);
  return failure("invalid-document", `${what} could not be read${typeof code === "string" ? ` (${code})` : ""}`);
}

const validDirectory = (dir: unknown): dir is string =>
  typeof dir === "string" &&
  dir.length > 0 &&
  !isAbsolute(dir) &&
  !dir.split(/[\\/]/).includes("..") &&
  !dir.includes("\0");

/** Which files a directory's draft reads: a template's `template.json`, or the sources of a code draft. */
function draftFiles(names: string[], input: Record<string, unknown>): Result<{ files: string[]; template: boolean }> {
  const sources = names.filter((name) => /\.tsx?$/.test(name));
  // A directory holding template.json is a template draft: data only, no entry and no source files.
  const template = names.includes("template.json");
  if (template && (sources.length > 0 || Object.hasOwn(input, "entry")))
    return failure("invalid-document", "A template draft has template.json and no source files or entry");
  if (sources.length > 128) return failure("limit-exceeded", "Draft exceeds 128 source files");
  const { entry = "entry.tsx" } = input;
  if (!template && (typeof entry !== "string" || !sources.includes(entry)))
    return failure("not-found", "Draft entry file is missing");
  return { ok: true, value: { files: template ? ["template.json"] : sources, template } };
}

/**
 * Open one draft file and return its size, adding the handle to `opened` for the caller to close.
 * The checks run on the open file, not the path: a symlink swapped in after the containment check is
 * refused by O_NOFOLLOW or by its inode, a FIFO cannot block the open, and a second link may be a hard
 * link to a file outside draftRoot.
 */
async function openDraftFile(root: string, directory: string, name: string, opened: FileHandle[]) {
  const path = await realpath(join(directory, name));
  if (!contained(root, path)) return failure("invalid-document", `Draft file ${name} escapes draftRoot`);
  const checked = await lstat(path);
  if (!checked.isFile()) return failure("invalid-document", `Draft file ${name} must be a regular file`);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  opened.push(handle);
  const info = await handle.stat();
  if (!info.isFile() || info.nlink !== 1 || info.dev !== checked.dev || info.ino !== checked.ino)
    return failure("invalid-document", `Draft file ${name} must be a regular file with exactly one link`);
  return { ok: true, value: info.size } as const;
}

/** Read a handle into `buffer` from `offset` until end of file or a full buffer; returns the new end. */
async function readInto(handle: FileHandle, buffer: Uint8Array, offset: number): Promise<number> {
  let end = offset;
  while (end < buffer.length) {
    const { bytesRead } = await handle.read(buffer, end, buffer.length - end, end - offset);
    if (bytesRead === 0) break;
    end += bytesRead;
  }
  return end;
}

/** Read only data beneath the host's opt-in root; the packer still validates the documents. */
export async function readDraftDirectory(
  root: string | undefined,
  input: Record<string, unknown>,
): Promise<Result<PackInput>> {
  if (root === undefined) return failure("not-found", "Configure draftRoot to read draft directories");
  const { dir, entry = "entry.tsx" } = input;
  if (!validDirectory(dir))
    return failure("invalid-document", "dir must be a non-empty relative path without .. segments");
  if (["files", "template", "manifest", "scenarios"].some((key) => Object.hasOwn(input, key)))
    return failure("invalid-document", "dir cannot be combined with files, template, manifest or scenarios");
  /** The file being read, or undefined while the directory itself is. Errors name it relative to `draftRoot`. */
  let target: string | undefined;
  try {
    const directory = await realpath(join(root, dir));
    if (!contained(root, directory)) return failure("invalid-document", "Draft directory escapes draftRoot");
    if (!(await lstat(directory)).isDirectory()) return failure("invalid-document", "Expected a draft directory");
    const names = (await readdir(directory, { withFileTypes: true })).map(({ name }) => name);
    const chosen = draftFiles(names, input);
    if (!chosen.ok) return chosen;
    const contents: Record<string, string> = {};
    const opened: FileHandle[] = [];
    try {
      const names = [...chosen.value.files, "manifest.json", "scenarios.json"];
      let size = 0;
      for (const name of names) {
        target = name;
        const opening = await openDraftFile(root, directory, name, opened);
        if (!opening.ok) return opening;
        size += opening.value;
        if (size > MAX_DRAFT_BYTES)
          return failure("limit-exceeded", `Draft exceeds ${MAX_DRAFT_BYTES} aggregate bytes`);
      }
      // One buffer bounds the actual reads too, in case a file grew after the size check.
      const buffer = new Uint8Array(MAX_DRAFT_BYTES + 1);
      let bytesRead = 0;
      for (const [index, name] of names.entries()) {
        target = name;
        const start = bytesRead;
        bytesRead = await readInto(opened[index] as FileHandle, buffer, start);
        if (bytesRead > MAX_DRAFT_BYTES)
          return failure("limit-exceeded", `Draft exceeds ${MAX_DRAFT_BYTES} aggregate bytes`);
        contents[name] = new TextDecoder().decode(buffer.subarray(start, bytesRead));
      }
    } finally {
      await Promise.all(opened.map((handle) => handle.close()));
    }
    // Sources end in .ts or .tsx, so the rest is exactly the source files, in read order.
    const {
      "manifest.json": manifestText,
      "scenarios.json": scenariosText,
      "template.json": templateText,
      ...files
    } = contents;
    if (manifestText === undefined || scenariosText === undefined)
      return failure("not-found", "Draft manifest.json or scenarios.json is missing");
    const manifest: unknown = JSON.parse(manifestText);
    const scenarios: unknown = JSON.parse(scenariosText);
    const bounded = { [boundedDirectoryDraft]: true };
    if (templateText !== undefined)
      return { ok: true, value: { ...bounded, template: JSON.parse(templateText), manifest, scenarios } };
    // `entry` was checked above for every draft that is not a template.
    return { ok: true, value: { ...bounded, files, entry: entry as string, manifest, scenarios } };
  } catch (error) {
    if (error instanceof SyntaxError) return failure("invalid-document", "Draft contains malformed JSON");
    return readFailure(error, dir, target);
  }
}
