import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LiveframeError } from "../../errors.ts";
import type { WidgetPackage } from "../../formats/package.ts";
import type { Placement, StyleRecord } from "../../formats/records.ts";
import type { Json } from "../../formats/tree.ts";
import type { Store } from "../index.ts";

// Serialize package checks and writes across store instances in this writing process.
let packages = Promise.resolve();

function segment(value: string): string {
  return [...Buffer.from(value, "utf8")]
    .map((byte) =>
      (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57) || byte === 95 || byte === 45
        ? String.fromCharCode(byte)
        : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
    )
    .join("");
}

function missing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function read<T>(file: string): Promise<T | undefined> {
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    if (missing(error)) return undefined;
    throw error;
  }
  try {
    return JSON.parse(source);
  } catch {
    throw { kind: "invalid-document", pointer: "", message: `Invalid JSON record: ${file}` } satisfies LiveframeError;
  }
}

async function write(file: string, source: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, source, { flag: "wx" });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

/** One JSON file per record, replaced atomically. Assumes one writing process. */
export function fileStore(dir: string): Store {
  const path = (kind: string, ...keys: string[]) => join(dir, kind, `${keys.map(segment).join("/")}.json`);
  return {
    putPackage(pkg) {
      const source = JSON.stringify(pkg);
      const { id, version } = pkg.manifest;
      const hash = pkg.hash;
      const file = path("packages", id, version);
      const pending = packages.then(async () => {
        const existing = await read<WidgetPackage>(file);
        if (existing !== undefined) {
          if (existing.hash === hash) return;
          throw {
            kind: "version-conflict",
            pointer: "",
            message: `${id}@${version} already stored with another hash`,
            expected: "a new version for changed content",
          } satisfies LiveframeError;
        }
        await write(file, source);
      });
      packages = pending.catch(() => {});
      return pending;
    },
    getPackage: (id, version) => read<WidgetPackage>(path("packages", id, version)),
    putPlacement: (placement) => write(path("placements", placement.id), JSON.stringify(placement)),
    async deletePlacement(id) {
      await rm(path("placements", id), { force: true });
      await rm(path("states", id), { force: true });
    },
    async listPlacements() {
      const directory = join(dir, "placements");
      let files: string[];
      try {
        files = await readdir(directory);
      } catch (error) {
        if (missing(error)) return [];
        throw error;
      }
      const records: Placement[] = [];
      for (const file of files.filter((file) => file.endsWith(".json"))) {
        const record = await read<Placement>(join(directory, file));
        if (record !== undefined) records.push(record);
      }
      return records.sort((a, b) => (a?.id < b?.id ? -1 : a?.id > b?.id ? 1 : 0));
    },
    putState: (id, state) => write(path("states", id), JSON.stringify(state)),
    getState: (id) => read<Json>(path("states", id)),
    putStyle: (style) => write(path("styles", style.kind, style.id, style.version), JSON.stringify(style)),
    getStyle: (kind, id, version) => read<StyleRecord>(path("styles", kind, id, version)),
  };
}
