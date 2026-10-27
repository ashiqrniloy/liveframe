import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import pkg from "../../package.json" with { type: "json" };

const root = new URL("../../", import.meta.url).pathname;

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

export function publishManifest<T extends { exports: unknown }>(manifest: T) {
  return { ...manifest, exports: withoutSourceCondition(manifest.exports) };
}

/** Copy only release inputs; the checkout's manifest is never rewritten. */
export async function stagePackage(destination: string): Promise<void> {
  await mkdir(destination);
  for (const file of [...pkg.files, "README.md", "LICENSE"]) {
    await cp(join(root, file), join(destination, file), { recursive: true });
  }
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
  const destination = process.argv[2];
  if (!destination) throw new Error("Usage: bun scripts/release/publish-manifest.ts <new-staging-directory>");
  await stagePackage(destination);
}
