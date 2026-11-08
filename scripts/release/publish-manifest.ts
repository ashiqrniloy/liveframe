import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { readManifest, root } from "./packages.ts";

function withoutSourceCondition(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSourceCondition);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "liveframe:source")
        .map(([key, child]) => [key, withoutSourceCondition(child)]),
    );
  }
  return value;
}

/** A `workspace:` specifier means nothing outside the checkout, and only dev dependencies use one. */
function withoutWorkspaceLinks(dependencies: unknown): unknown {
  if (!dependencies || typeof dependencies !== "object") return dependencies;
  const kept = Object.entries(dependencies).filter(([, spec]) => !String(spec).startsWith("workspace:"));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

export function publishManifest<T extends { exports: unknown; devDependencies?: unknown }>(manifest: T) {
  const published = { ...manifest, exports: withoutSourceCondition(manifest.exports) };
  if (manifest.devDependencies) published.devDependencies = withoutWorkspaceLinks(manifest.devDependencies) as never;
  if (published.devDependencies === undefined) delete published.devDependencies;
  return published;
}

/** Copy only release inputs of the package in `dir` (default: the root); the checkout's manifest is never rewritten. */
export async function stagePackage(destination: string, dir = "."): Promise<void> {
  const pkg = await readManifest(dir);
  await mkdir(destination, { recursive: true });
  for (const file of [...pkg.files, "README.md"]) {
    await cp(join(root, dir, file), join(destination, file), { recursive: true });
  }
  await cp(join(root, "LICENSE"), join(destination, "LICENSE"));
  await Bun.write(join(destination, "package.json"), `${JSON.stringify(publishManifest(pkg), null, 2)}\n`);
}

export function assertExportsPacked(exports: unknown, files: Set<string>, entry = "exports"): void {
  if (exports === null) return;
  if (typeof exports === "string") {
    const pattern = new RegExp(
      `^${exports
        .slice(2)
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*")}$`,
    );
    if (!exports.startsWith("./") || ![...files].some((file) => pattern.test(file))) {
      throw new Error(`${entry}: target ${JSON.stringify(exports)} is missing from the packed files`);
    }
    return;
  }
  if (Array.isArray(exports)) {
    exports.forEach((child, index) => {
      assertExportsPacked(child, files, `${entry}[${index}]`);
    });
    return;
  }
  if (exports && typeof exports === "object") {
    for (const [key, child] of Object.entries(exports)) {
      if (key === "liveframe:source")
        throw new Error(`${entry}[${JSON.stringify(key)}]: source condition is not publishable`);
      assertExportsPacked(child, files, `${entry}[${JSON.stringify(key)}]`);
    }
    return;
  }
  throw new Error(`${entry}: invalid exports target`);
}

if (import.meta.main) {
  const [destination, dir = "."] = process.argv.slice(2);
  if (!destination)
    throw new Error("Usage: bun scripts/release/publish-manifest.ts <staging-directory> [package-directory]");
  await stagePackage(destination, dir);
}
