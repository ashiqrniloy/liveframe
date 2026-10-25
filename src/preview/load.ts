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
  // Sticky matching stops at the end of the header, before any widget text.
  const rewritten = code.replace(
    /import \* as (__lf_sdk\d+) from "(@arnilo\/liveframe\/sdk(?:\/jsx(?:-dev)?-runtime)?)";(\n|$)/gy,
    (_, binding: string, specifier: string, newline: string) =>
      `import * as ${binding} from ${JSON.stringify(import.meta.resolve(specifier))};${newline}`,
  );
  const loaded: Promise<LoadedModule> = import(
    `data:text/javascript,${encodeURIComponent(rewritten).replaceAll(".", "%2E")}`
  );
  modules.set(hash, loaded);
  return loaded;
}
