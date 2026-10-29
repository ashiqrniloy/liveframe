import { linkPackage } from "../runner-kit/link.ts";

export type LoadedModule = { readonly default?: unknown };

const modules = new Map<string, Promise<LoadedModule>>();

/**
 * Loads backend widget code once per verified package hash; this is not isolation.
 * Escape dots because Bun sniffs a file extension even in data: URLs.
 * Only canonical linker headers are rewritten; other SDK imports stay bare and
 * resolve from the working directory, so hand-written packages may fail there.
 */
export function loadModule(code: string, hash: string): Promise<LoadedModule> {
  const cached = modules.get(hash);
  if (cached) return cached;
  const linked = linkPackage(code, (specifier) => import.meta.resolve(specifier));
  if (!linked.ok) {
    const failed = Promise.reject(new Error(linked.errors[0]?.message ?? "Package code cannot be linked"));
    modules.set(hash, failed);
    return failed;
  }
  const rewritten = linked.value;
  const loaded: Promise<LoadedModule> = import(
    `data:text/javascript,${encodeURIComponent(rewritten).replaceAll(".", "%2E")}`
  );
  modules.set(hash, loaded);
  return loaded;
}
