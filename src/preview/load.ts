import type { Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { librarySpecifier, linkPackage } from "../runner-kit/link.ts";

export type LoadedModule = { readonly default?: unknown };

const modules = new Map<string, Promise<LoadedModule>>();

/** The process-wide module count; modules cannot be unloaded, so it only grows. */
export function loadedModuleCount(): number {
  return modules.size;
}

export function isModuleLoaded(hash: string): boolean {
  return modules.has(hash);
}

/** Library module URLs by hash: a dependent imports a library by the URL the library itself loaded from. */
const urls = new Map<string, string>();

const dataUrl = (rewritten: string): string =>
  `data:text/javascript,${encodeURIComponent(rewritten).replaceAll(".", "%2E")}`;

type Pins = WidgetPackage["manifest"]["dependencies"];

/** Links `code`, sending each `liveframe:lib/…` line to the URL its pin's library loaded from. */
function link(code: string, pins: Pins): Result<string> {
  return linkPackage(code, (specifier) => {
    const pin = pins?.find((item) => librarySpecifier(item.id, item.version) === specifier);
    if (!pin) return import.meta.resolve(specifier);
    const url = urls.get(pin.hash);
    if (url === undefined) throw new Error(`Library ${specifier} was not supplied`);
    return url;
  });
}

/**
 * Loads backend widget code once per verified package hash; this is not isolation.
 * Escape dots because Bun sniffs a file extension even in data: URLs.
 * Only canonical linker headers are rewritten; other SDK imports stay bare and
 * resolve from the working directory, so hand-written packages may fail there.
 * `libraries` are the package's dependencies, dependencies first (`collectLibraries`): each is
 * loaded once by its own hash, and the package's `liveframe:lib/…` headers resolve to that
 * module's URL, so a library is one module however many packages import it.
 */
export function loadModule(
  code: string,
  hash: string,
  libraries: readonly WidgetPackage[] = [],
  pins: Pins = [],
): Promise<LoadedModule> {
  const cached = modules.get(hash);
  if (cached) return cached;
  try {
    for (const lib of libraries) {
      if (urls.has(lib.hash)) continue;
      const linked = link(lib.code as string, lib.manifest.dependencies);
      // A link failure imported nothing, so it takes no slot in `modules` or the `maxModules` bound.
      if (!linked.ok) return Promise.reject(new Error(linked.errors[0]?.message ?? "Library cannot be linked"));
      urls.set(lib.hash, dataUrl(linked.value));
      if (!modules.has(lib.hash)) modules.set(lib.hash, importLinked(linked.value));
    }
    const linked = link(code, pins);
    // A link failure imported nothing, so it takes no slot in `modules` or the `maxModules` bound.
    if (!linked.ok) return Promise.reject(new Error(linked.errors[0]?.message ?? "Package code cannot be linked"));
    const loaded = importLinked(linked.value);
    modules.set(hash, loaded);
    return loaded;
  } catch (error) {
    return Promise.reject(error);
  }
}

function importLinked(rewritten: string): Promise<LoadedModule> {
  return import(`data:text/javascript,${encodeURIComponent(rewritten).replaceAll(".", "%2E")}`);
}
