// The startup registry check both adapters run (spec §11): every catalog kind has exactly one implementation whose
// definition equals the catalog's. Framework-free and internal; `/react` and `/dom` call it, so the two cannot drift.
import { type LiveframeError, LiveframeFailure } from "../errors.ts";
import type { Catalog, Definition } from "../formats/catalog.ts";
import { sameJson } from "../formats/json.ts";
import { type CompiledValidator, validateCatalog } from "../index.ts";
import { isThenable } from "../internal.ts";
import { factsOf, UNKNOWN_VALIDATOR } from "../validate/compile.ts";
import type { Prepared, StagedSurfaceCore } from "./core.ts";
import type { SurfaceEvent, SurfaceSnapshot } from "./index.ts";

/** The registry check's failures, with the diagnostics the other install-time APIs throw. */
export class RendererError extends LiveframeFailure {
  constructor(errors: readonly LiveframeError[]) {
    super(errors);
    this.name = "RendererError";
  }
}

export type CatalogBinding<I> = { readonly catalog: unknown; readonly implementations: readonly I[] };
export type Registered<I> = { readonly catalog: Catalog; readonly registry: ReadonlyMap<string, I> };

/** One catalog's check: its failures go to `errors` under `prefix`; the registry is returned when valid. */
function register<I>(
  { catalog, implementations }: CatalogBinding<I>,
  definitionOf: (implementation: I) => Definition,
  prefix: string,
  errors: LiveframeError[],
): Registered<I> | undefined {
  const checked = validateCatalog(catalog);
  if (!checked.ok) {
    errors.push(...checked.errors.map((error) => ({ ...error, pointer: prefix + error.pointer })));
    return undefined;
  }
  const definitions = checked.value.definitions;
  const registry = new Map<string, I>();
  const before = errors.length;
  const reject = (pointer: string, message: string) =>
    errors.push({ kind: "catalog-mismatch", pointer: prefix + pointer, message });
  for (const [i, implementation] of implementations.entries()) {
    const definition = definitionOf(implementation);
    const pointer = `/implementations/${i}`;
    if (registry.has(definition.kind)) reject(pointer, `Duplicate implementation: ${definition.kind}`);
    registry.set(definition.kind, implementation);
    const expected = definitions.find((entry) => entry.kind === definition.kind);
    if (!expected) reject(pointer, `Kind outside catalog: ${definition.kind}`);
    else if (!sameJson(expected, definition)) reject(pointer, `Definition differs from catalog: ${definition.kind}`);
  }
  for (const [i, definition] of definitions.entries()) {
    if (!registry.has(definition.kind))
      reject(`/catalog/definitions/${i}/kind`, `Missing implementation: ${definition.kind}`);
  }
  return errors.length === before ? { catalog: checked.value, registry } : undefined;
}

/** The checked registries, and how a surface finds the one for its validator. */
export type Registries<I> = {
  readonly catalogIds: readonly string[];
  /** A lone catalog serves every validator; with several, the validator's own catalog picks. */
  forValidator(validator: CompiledValidator): Registered<I> | undefined;
};

/**
 * Checks one catalog (`{ catalog, implementations }`) or several (`{ catalogs }`), each on its own, and throws a
 * `RendererError` with every failure.
 */
export function checkRegistries<I>(
  options: CatalogBinding<I> | { readonly catalogs: readonly CatalogBinding<I>[] },
  definitionOf: (implementation: I) => Definition,
): Registries<I> {
  const errors: LiveframeError[] = [];
  const registered = new Map<string, Registered<I>>();
  if ("catalogs" in options) {
    if (!Array.isArray(options.catalogs) || options.catalogs.length === 0)
      errors.push({ kind: "invalid-document", pointer: "/catalogs", message: "Expected at least one catalog" });
    else
      for (const [i, entry] of options.catalogs.entries()) {
        const found = register(entry, definitionOf, `/catalogs/${i}`, errors);
        if (!found) continue;
        if (registered.has(found.catalog.catalogId))
          errors.push({
            kind: "catalog-mismatch",
            pointer: `/catalogs/${i}/catalog/catalogId`,
            message: `Duplicate catalog: ${found.catalog.catalogId}`,
          });
        else registered.set(found.catalog.catalogId, found);
      }
  } else {
    const found = register(options, definitionOf, "", errors);
    if (found) registered.set(found.catalog.catalogId, found);
  }
  if (errors.length) throw new RendererError(errors);
  const only = registered.size === 1 ? [...registered.values()][0] : undefined;
  return {
    catalogIds: [...registered.keys()],
    forValidator(validator) {
      if (only) return only;
      const facts = factsOf(validator);
      return facts && registered.get(facts.build.catalogId);
    },
  };
}

/** Why a surface over `validator` has no registry: its catalog is not registered, or this copy did not compile it. */
export function refusal(validator: CompiledValidator): string {
  return factsOf(validator) ? "The validator's catalog is not registered with this renderer" : UNKNOWN_VALIDATOR;
}

/**
 * What a surface over a validator of no registered catalog, or one this copy did not compile, holds: it draws
 * the fallback and reports why.
 */
export function refusedCore(
  message: string,
  onEvent: () => ((event: SurfaceEvent) => unknown) | undefined,
): StagedSurfaceCore {
  const errors: readonly LiveframeError[] = Object.freeze([
    { kind: "catalog-mismatch", pointer: "/validator", message },
  ]);
  const snapshot: SurfaceSnapshot = Object.freeze({
    valid: false,
    errors,
    tree: undefined,
    root: undefined,
    local: Object.freeze({}),
  });
  const result = { ok: false, errors } as const;
  let last: { readonly input: unknown } | undefined;
  const prepare = (input: unknown): Prepared => {
    if (!last || last.input !== input) {
      last = { input };
      try {
        const settled = onEvent()?.(Object.freeze({ type: "arrival-rejected", errors }));
        if (isThenable(settled)) settled.then(undefined, () => {});
      } catch {
        // A host's logger must never break rendering.
      }
    }
    return { input, base: snapshot, snapshot, result };
  };
  return {
    accept(input) {
      prepare(input);
      return result;
    },
    prepare,
    commit: () => result,
    snapshot: () => snapshot,
    subscribe: () => () => {},
    attach: () => () => {},
    fail() {},
  };
}
