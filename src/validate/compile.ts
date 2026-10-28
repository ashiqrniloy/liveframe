import { LiveframeFailure } from "../errors.ts";
import { at, type Capabilities, isRecord, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { type Manifest, validateManifest } from "../formats/manifest.ts";
import type { LanguageSchema } from "../schema.ts";
import { closed, field, reject } from "./checks.ts";
import { compileIntents } from "./intent.ts";
import { offeredChecks } from "./offered.ts";
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

const fields = new Set(["id", "kind", "variant", "props", "style", "events", "children"]);

/** Validate installed documents once, then compile specialised per-kind checks. */
export function compileValidator(options: CompileValidatorOptions): CompiledValidator {
  const catalogResult = validateCatalog(options.catalog);
  if (!catalogResult.ok) throw new LiveframeFailure(catalogResult.errors);
  const capabilitiesResult = validateCapabilities(options.capabilities);
  if (!capabilitiesResult.ok) throw new LiveframeFailure(capabilitiesResult.errors);
  const { value: catalog } = catalogResult;
  const { value: capabilities } = capabilitiesResult;
  const manifestResult = validateManifest(options.manifest, { catalog, capabilities });
  if (!manifestResult.ok) throw new LiveframeFailure(manifestResult.errors);
  return compile(catalog, capabilities, manifestResult.value);
}

function compile(catalog: Catalog, capabilities: Capabilities, manifest: Manifest): CompiledValidator {
  const styles = compileStyles(catalog.vocabulary);
  const intent = compileIntents(capabilities, manifest);
  const structure = compileStructure(catalog);
  const kinds = new Map<string, SchemaCheck>();
  const facts = new Map<string, KindFacts>();
  for (const definition of catalog.definitions) {
    const props = compileSchema(definition.props);
    const variants = new Set(definition.variants);
    facts.set(definition.kind, {
      variants,
      styleProps: new Set(definition.styleProps),
      events: new Set(Object.keys(definition.events)),
      children: structure.children.get(definition.kind),
    });
    const variantExpected = `one of: ${definition.variants.join(", ")}`;
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
    const events = new Map(Object.entries(definition.events).map(([name, event]) => [name, intent(event.carries)]));
    const eventExpected = `a declared event: ${[...events.keys()].join(", ") || "none"}`;
    const eventMap: SchemaCheck = (value, path, sink) => {
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
    kinds.set(
      definition.kind,
      nodeCheck({
        fields,
        props,
        style,
        events: eventMap,
        variants,
        variantExpected,
      }),
    );
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
    const source = declared ? capabilities.sources[declared.source] : undefined;
    if (source) dataProperties[key] = source.result;
  }
  const validator: CompiledValidator = { checkNode, validateTree: compileTree(catalog, checkNode, structure) };
  offeredChecks.set(validator, {
    intent: intent("none"),
    events: new Map(
      catalog.definitions.map((definition) => [
        definition.kind,
        new Map(
          Object.entries(definition.events).map(([name, { carries }]) => [
            name,
            {
              carries,
              check: typeof carries === "object" ? compileSchema(carries.object) : undefined,
            },
          ]),
        ),
      ]),
    ),
  });
  builds.set(validator, {
    catalogId: catalog.catalogId,
    kinds: facts,
    structure,
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
