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
    const selected: { name: string; path: string }[] = [];
    let size = 0;
    for (const name of [...chosen.value.files, "manifest.json", "scenarios.json"]) {
      target = name;
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
      target = name;
      // Bound actual reads too, in case a file grew after the size check.
      const bytes = await Bun.file(path)
        .slice(0, maxBytes - bytesRead + 1)
        .bytes();
      bytesRead += bytes.length;
      if (bytesRead > maxBytes) return failure("limit-exceeded", "Draft exceeds 1048576 aggregate bytes");
      contents[name] = new TextDecoder().decode(bytes);
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
    if (templateText !== undefined)
      return { ok: true, value: { template: JSON.parse(templateText), manifest, scenarios } };
    // `entry` was checked above for every draft that is not a template.
    return { ok: true, value: { files, entry: entry as string, manifest, scenarios } };
  } catch (error) {
    if (error instanceof SyntaxError) return failure("invalid-document", "Draft contains malformed JSON");
    return readFailure(error, dir, target);
  }
}
