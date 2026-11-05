import { LiveframeFailure } from "../errors.ts";
import { at, type Capabilities, isRecord, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, type Definition, validateCatalog } from "../formats/catalog.ts";
import { sameJson } from "../formats/json.ts";
import { type Manifest, validateManifest } from "../formats/manifest.ts";
import { treeSchema } from "../formats/tree.ts";
import { realmError } from "../internal.ts";
import type { LanguageSchema } from "../schema.ts";
import { closed, field, reject } from "./checks.ts";
import { compileIntents } from "./intent.ts";
import { type OfferedEvent, offeredChecks } from "./offered.ts";
import { compileSchema, type SchemaCheck, type SchemaSink } from "./schema.ts";
import { type ChildRules, type CompiledStructure, compileStructure } from "./structure.ts";
import { compileStyles } from "./style.ts";
import { compileTree, type TreeValidator } from "./tree.ts";

export type CompileValidatorOptions = {
  readonly catalog: unknown;
  readonly capabilities: unknown;
  readonly manifest: unknown;
};
/** Per-kind facts `render()` needs to split props and check children while it builds. */
export type KindFacts = {
  readonly variants: ReadonlySet<string>;
  readonly styleProps: ReadonlySet<string>;
  readonly events: ReadonlySet<string>;
  readonly children: ChildRules | undefined;
};
/** @internal Not part of the published surface; `render()` reads it from the validator. */
export type CompiledBuild = {
  readonly catalogId: string;
  readonly kinds: ReadonlyMap<string, KindFacts>;
  readonly structure: CompiledStructure;
  /** The manifest's input schemas, plus a `data` schema built from each source's result. */
  readonly inputs: CompiledInputs;
};
/** @internal `render()` checks the four inputs against these before it runs the widget. */
export type CompiledInputs = {
  readonly params: SchemaCheck;
  readonly state: SchemaCheck;
  readonly context: SchemaCheck;
  readonly data: SchemaCheck;
};
export type CompiledValidator = {
  readonly checkNode: SchemaCheck;
  readonly validateTree: TreeValidator;
};

const builds = new WeakMap<CompiledValidator, CompiledBuild>();
const actions = new WeakMap<
  CompiledValidator,
  ReadonlyMap<string, Readonly<{ confirm: boolean; irreversible: boolean }>>
>();

/** @internal Renderer metadata from the capabilities this validator was compiled with. */
export function actionFacts(validator: CompiledValidator) {
  const facts = actions.get(validator);
  if (!facts) throw new LiveframeFailure([{ kind: "invalid-document", pointer: "", message: "Unknown validator" }]);
  return facts;
}

/**
 * The facts behind a validator, for `render()`'s one-pass builder. A `WeakMap`
 * keeps them off the public type, so no consumer can read or replace them, and
 * the lookup happens once per render rather than once per node.
 */
export function buildFacts(validator: CompiledValidator): CompiledBuild {
  const facts = builds.get(validator);
  if (!facts) throw new LiveframeFailure([{ kind: "invalid-document", pointer: "", message: "Unknown validator" }]);
  return facts;
}
type NodeCheckSpec = {
  readonly fields: ReadonlySet<string>;
  readonly props: SchemaCheck;
  readonly style: SchemaCheck;
  readonly events: SchemaCheck;
  readonly variants: ReadonlySet<string>;
  readonly variantExpected: string;
};

/** The event-to-intent check for one kind; `events` is already bound to this call's manifest. */
function eventMapCheck(events: ReadonlyMap<string, SchemaCheck>, eventExpected: string): SchemaCheck {
  return (value, path, sink) => {
    if (!isRecord(value)) return reject(sink, path, "an event-to-intent object");
    let valid = true;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      const check = events.get(key);
      if (!check) valid = reject(sink, at("", key), eventExpected, "undeclared-event");
      else if (!field(check, value[key], sink, key)) valid = false;
      if (!valid && sink.errors.length >= sink.maxErrors) break;
    }
    return valid;
  };
}

/** One kind's node check; the dispatcher has already checked the node object and its kind. */
function nodeCheck(spec: NodeCheckSpec): SchemaCheck {
  return (value, _path, sink) => {
    const node = value as Record<string, unknown>;
    let valid = closed(node, spec.fields, sink);
    if (!Object.hasOwn(node, "id") || typeof node.id !== "string" || node.id.length === 0)
      valid = reject(sink, "/id", "a non-empty key-path id");
    if (Object.hasOwn(node, "variant") && (typeof node.variant !== "string" || !spec.variants.has(node.variant)))
      valid = reject(sink, "/variant", spec.variantExpected);
    if (!field(spec.props, Object.hasOwn(node, "props") ? node.props : undefined, sink, "props")) valid = false;
    if (Object.hasOwn(node, "style") && !field(spec.style, node.style, sink, "style")) valid = false;
    if (Object.hasOwn(node, "events") && !field(spec.events, node.events, sink, "events")) valid = false;
    if (Object.hasOwn(node, "children") && !Array.isArray(node.children))
      valid = reject(sink, "/children", "an array of child nodes", "invalid-children");
    return valid;
  };
}

/** Moves a node's failures to its tree path, attributing them to the node's own id. */
function rebaseErrors(sink: SchemaSink, start: number, path: string, node: unknown): void {
  for (let i = start; i < sink.errors.length; i++) {
    const error = sink.errors[i];
    if (error)
      sink.errors[i] = {
        ...error,
        pointer: path + error.pointer,
        ...(isRecord(node) && typeof node.id === "string"
          ? { nodeId: node.id }
          : sink.nodeId === undefined
            ? {}
            : { nodeId: sink.nodeId }),
      };
  }
}

const nodeFields = Object.keys(treeSchema.$defs.node.properties);
// Keep existing diagnostic order; the schema owns membership.
const fields = new Set(
  ["id", "kind", "variant", "props", "style", "events", "children"]
    .filter((name) => nodeFields.includes(name))
    .concat(nodeFields),
);

/** Catalog-level work: everything a validator needs that depends only on the catalog and capabilities. */
type CatalogKind = {
  readonly props: SchemaCheck;
  readonly style: SchemaCheck;
  readonly variants: ReadonlySet<string>;
  readonly variantExpected: string;
  readonly events: Definition["events"];
  readonly eventExpected: string;
  readonly facts: KindFacts;
};
type CatalogWork = {
  readonly catalog: Catalog;
  readonly capabilities: Capabilities;
  readonly structure: CompiledStructure;
  readonly kinds: ReadonlyMap<string, CatalogKind>;
  readonly offered: ReadonlyMap<string, ReadonlyMap<string, OfferedEvent>>;
};

/**
 * Catalog work kept per equal `(catalog, capabilities)`, least recently used evicted first. A host
 * installs a handful of catalogs, and every lookup compares content, so the bound is also the cost
 * of a miss with a full cache.
 */
const MAX_CATALOGS = 8;
type CatalogEntry = {
  readonly catalog: string;
  readonly capabilities: string;
  readonly work: CatalogWork;
  /** The keys parsed back, kept after the first hit so later hits compare without parsing. */
  parsed?: { readonly catalog: unknown; readonly capabilities: unknown };
};
const catalogs: CatalogEntry[] = [];

/** @internal For tests only; counts catalog-level compiles, not the validators built from them. */
export function catalogCompileCount(): number {
  return catalogCompiles;
}
let catalogCompiles = 0;

/** The canonical key without the cost: equal JSON content always spells the same text. */
function key(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined; // A cycle or a BigInt: leave caching out of the failure path.
  }
}

/**
 * Catalog-level work, keyed by the text of the two documents: a stored string cannot be changed by
 * a later mutation of the caller's object, and re-reading it proves the hit is the content that
 * compiled. The entry holds no copy of the documents, so a first compile pays only the key. Two
 * equal documents whose keys were written in a different order miss and compile again.
 */
function catalogWork(catalog: unknown, capabilities: unknown): CatalogWork {
  const catalogKey = key(catalog);
  const capabilitiesKey = key(capabilities);
  if (catalogKey === undefined || capabilitiesKey === undefined) return compileCatalog(catalog, capabilities);
  for (let i = 0; i < catalogs.length; i++) {
    const entry = catalogs[i];
    if (!entry || entry.catalog !== catalogKey || entry.capabilities !== capabilitiesKey) continue;
    entry.parsed ??= { catalog: JSON.parse(catalogKey), capabilities: JSON.parse(capabilitiesKey) };
    if (!sameJson(entry.parsed.catalog, catalog) || !sameJson(entry.parsed.capabilities, capabilities)) continue;
    // The entry reads the documents of the call that compiled it; a caller may have changed them since.
    if (
      !sameJson(entry.parsed.catalog, entry.work.catalog) ||
      !sameJson(entry.parsed.capabilities, entry.work.capabilities)
    ) {
      catalogs.splice(i, 1);
      break;
    }
    if (i > 0) {
      catalogs.splice(i, 1);
      catalogs.unshift(entry);
    }
    return entry.work;
  }
  const work = compileCatalog(catalog, capabilities);
  catalogCompiles++;
  catalogs.unshift({ catalog: catalogKey, capabilities: capabilitiesKey, work });
  if (catalogs.length > MAX_CATALOGS) catalogs.pop();
  return work;
}

/** Validate installed documents once, then compile specialised per-kind checks. */
export function compileValidator(options: CompileValidatorOptions): CompiledValidator {
  for (const name of ["catalog", "capabilities", "manifest"] as const) {
    const error = realmError(options[name], `/${name}`);
    if (error) throw new LiveframeFailure([error]);
  }
  const work = catalogWork(options.catalog, options.capabilities);
  const manifestResult = validateManifest(options.manifest, work);
  if (!manifestResult.ok) throw new LiveframeFailure(manifestResult.errors);
  return compile(work, manifestResult.value);
}

function compileCatalog(catalogDoc: unknown, capabilitiesDoc: unknown): CatalogWork {
  const catalogResult = validateCatalog(catalogDoc);
  if (!catalogResult.ok) throw new LiveframeFailure(catalogResult.errors);
  const capabilitiesResult = validateCapabilities(capabilitiesDoc);
  if (!capabilitiesResult.ok) throw new LiveframeFailure(capabilitiesResult.errors);
  const { value: catalog } = catalogResult;
  const { value: capabilities } = capabilitiesResult;
  const styles = compileStyles(catalog.vocabulary);
  const structure = compileStructure(catalog);
  const kinds = new Map<string, CatalogKind>();
  for (const definition of catalog.definitions) {
    const variants = new Set(definition.variants);
    const allowedStyles = new Map(definition.styleProps.map((prop) => [prop, styles.get(prop)]));
    const styleExpected = `a declared style prop: ${definition.styleProps.join(", ") || "none"}`;
    const style: SchemaCheck = (value, path, sink) => {
      if (!isRecord(value)) return reject(sink, path, "a style object");
      let valid = true;
      for (const key in value) {
        if (!Object.hasOwn(value, key)) continue;
        const check = allowedStyles.get(key as (typeof definition.styleProps)[number]);
        if (!check) valid = reject(sink, at("", key), styleExpected);
        else if (!field(check, value[key], sink, key)) valid = false;
        if (!valid && sink.errors.length >= sink.maxErrors) break;
      }
      return valid;
    };
    kinds.set(definition.kind, {
      props: compileSchema(definition.props),
      style,
      variants,
      variantExpected: `one of: ${definition.variants.join(", ")}`,
      events: definition.events,
      eventExpected: `a declared event: ${Object.keys(definition.events).join(", ") || "none"}`,
      facts: {
        variants,
        styleProps: new Set(definition.styleProps),
        events: new Set(Object.keys(definition.events)),
        children: structure.children.get(definition.kind),
      },
    });
  }
  const offered = new Map(
    catalog.definitions.map((definition) => [
      definition.kind,
      new Map(
        Object.entries(definition.events).map(([name, { carries }]) => [
          name,
          { carries, check: typeof carries === "object" ? compileSchema(carries.object) : undefined },
        ]),
      ),
    ]),
  );
  return { catalog, capabilities, structure, kinds, offered };
}

function compile(work: CatalogWork, manifest: Manifest): CompiledValidator {
  const { catalog } = work;
  const intent = compileIntents(work.capabilities, manifest);
  const kinds = new Map<string, SchemaCheck>();
  const facts = new Map<string, KindFacts>();
  for (const [kind, spec] of work.kinds) {
    const events = new Map<string, SchemaCheck>();
    for (const [name, event] of Object.entries(spec.events)) events.set(name, intent(event.carries));
    kinds.set(
      kind,
      nodeCheck({
        fields,
        props: spec.props,
        style: spec.style,
        events: eventMapCheck(events, spec.eventExpected),
        variants: spec.variants,
        variantExpected: spec.variantExpected,
      }),
    );
    facts.set(kind, spec.facts);
  }
  const kindExpected = `a catalog kind: ${[...kinds.keys()].join(", ")}`;
  const checkNode: SchemaCheck = (node, path, sink) => {
    const start = sink.errors.length;
    let valid: boolean;
    if (!isRecord(node)) valid = reject(sink, "", "a UI node object");
    else {
      const check = Object.hasOwn(node, "kind") && typeof node.kind === "string" ? kinds.get(node.kind) : undefined;
      valid = check ? check(node, "", sink) : reject(sink, "/kind", kindExpected, "unknown-component");
    }
    if (!valid) rebaseErrors(sink, start, path, node);
    return valid;
  };
  const dataProperties: Record<string, LanguageSchema> = {};
  for (const key of Object.keys(manifest.sources)) {
    const declared = manifest.sources[key];
    const source = declared ? work.capabilities.sources[declared.source] : undefined;
    if (source) dataProperties[key] = source.result;
  }
  const validator: CompiledValidator = {
    checkNode,
    validateTree: compileTree(catalog, checkNode, work.structure),
  };
  actions.set(
    validator,
    new Map(
      manifest.actions.map((name) => {
        const action = work.capabilities.actions[name];
        return [
          name,
          Object.freeze({ confirm: action?.confirm === true, irreversible: action?.irreversible === true }),
        ];
      }),
    ),
  );
  offeredChecks.set(validator, { intent: intent("none"), events: work.offered });
  builds.set(validator, {
    catalogId: catalog.catalogId,
    kinds: facts,
    structure: work.structure,
    inputs: {
      params: compileSchema(manifest.params),
      state: compileSchema(manifest.state),
      context: compileSchema(manifest.context),
      data: compileSchema({
        type: "object",
        properties: dataProperties,
        required: Object.keys(dataProperties),
        additionalProperties: false,
      }),
    },
  });
  return validator;
}
