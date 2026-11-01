import { LiveframeFailure, type Result } from "../errors.ts";
import { arr, bool, checkValue, type Infer, type LanguageSchema, obj, str } from "../schema.ts";
import {
  at,
  type Capabilities,
  capabilityName,
  checkMeta,
  documentChecks,
  isRecord,
  namedMap,
  type ObjectSchema,
  shell,
  validateCapabilities,
} from "./capabilities.ts";
import { validateJson } from "./json.ts";
import type { Catalog } from "./catalog.ts";

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
const binding = obj({
  from: str({ maxLength: 7, enum: ["params", "state", "context"] }),
  path: str({ maxLength: 512, pattern: "^[a-zA-Z_$][a-zA-Z0-9_$]*(\\.[a-zA-Z_$][a-zA-Z0-9_$]*){0,7}$" }),
});
const fields = obj(
  {
    format: str({ maxLength: 32, enum: ["liveframe-manifest/1"] }),
    id: str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9.-]*$" }),
    version: str({ maxLength: 128, pattern: "^.+$" }),
    catalogId: str({ maxLength: 128, pattern: "^[a-z][a-z0-9.-]*@[1-9][0-9]*$" }),
    params: bool(),
    state: bool(),
    context: bool(),
    initialState: bool(),
    sources: bool(),
    actions: arr(capabilityName, { maxItems: 512 }),
  },
  { description: str({ maxLength: 500 }), meta: bool() },
);
const sourceFields = obj({ source: capabilityName, params: bool() });
export type Manifest = Omit<
  Infer<typeof fields>,
  "params" | "state" | "context" | "initialState" | "sources" | "meta"
> & {
  readonly meta?: Json;
  readonly params: ObjectSchema;
  readonly state: ObjectSchema;
  readonly context: ObjectSchema;
  readonly initialState: Json;
  readonly sources: Readonly<
    Record<string, { readonly source: string; readonly params: Readonly<Record<string, Json | Infer<typeof binding>>> }>
  >;
};
const json = { $ref: "#/$defs/json" };
export const manifestSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    params: { $ref: "#/$defs/objectSchema" },
    state: { $ref: "#/$defs/objectSchema" },
    context: { $ref: "#/$defs/objectSchema" },
    initialState: json,
    meta: json,
    actions: { ...fields.properties.actions, uniqueItems: true },
    sources: namedMap({
      ...sourceFields,
      properties: {
        ...sourceFields.properties,
        params: {
          type: "object",
          additionalProperties: {
            if: { type: "object", properties: { from: {} }, required: ["from"] },
            // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword, not a promise.
            then: binding,
            else: json,
          },
        },
      },
    }),
  },
  $defs: {
    json: {
      anyOf: [
        { type: "null" },
        { type: "boolean" },
        { type: "number" },
        { type: "string" },
        { type: "array", items: json },
        { type: "object", additionalProperties: json },
      ],
    },
  },
};

const noPattern = "no pattern in widget schemas; use enum or a capability";

/**
 * params, state and context are matched against untrusted values on the app's
 * thread, so a pattern would be an author's code running there (spec §5).
 */
function rejectPatterns(
  schema: LanguageSchema,
  pointer: string,
  reject: (pointer: string, message: string, kind?: "invalid-document", expected?: string) => void,
): void {
  if ("discriminator" in schema) {
    for (const [tag, entry] of Object.entries(schema.mapping))
      rejectPatterns(entry, at(at(pointer, "mapping"), tag), reject);
    return;
  }
  if (schema.type === "string") {
    if (Object.hasOwn(schema, "pattern"))
      reject(`${pointer}/pattern`, "Expected no pattern in widget schemas", "invalid-document", noPattern);
  } else if (schema.type === "array") rejectPatterns(schema.items, `${pointer}/items`, reject);
  else if (schema.type === "object")
    for (const [key, child] of Object.entries(schema.properties))
      rejectPatterns(child, at(at(pointer, "properties"), key), reject);
}

type Checks = ReturnType<typeof documentChecks>;
type Source = Capabilities["sources"][string];

function checkActionList(actions: readonly string[], capabilities: Capabilities, c: Checks): void {
  const seen = new Set<string>();
  for (const [i, name] of actions.entries()) {
    if (c.errors.length >= 20) break;
    if (!Object.hasOwn(capabilities.actions, name)) c.reject(`/actions/${i}`, "Undeclared action", "unknown-name");
    if (seen.has(name)) c.reject(`/actions/${i}`, "Duplicate action");
    seen.add(name);
  }
}

/** Walks a dotted binding path from a top-level manifest schema to the bound schema. */
function resolveBindingPath(from: string, path: string, manifest: Manifest): LanguageSchema | undefined {
  let resolved: LanguageSchema | undefined = manifest[from as "params" | "state" | "context"];
  for (const segment of path.split("."))
    resolved =
      resolved?.type === "object" && Object.hasOwn(resolved.properties, segment)
        ? resolved.properties[segment]
        : undefined;
  return resolved;
}

function checkSourceParam(
  key: string,
  input: unknown,
  pointer: string,
  source: Source,
  manifest: Manifest,
  c: Checks,
): void {
  const target = Object.hasOwn(source.params.properties, key) ? source.params.properties[key] : undefined;
  if (!target) {
    c.reject(pointer, "Undeclared source parameter", "unknown-name");
    return;
  }
  if (!isRecord(input) || !Object.hasOwn(input, "from")) {
    c.collect(checkValue(target, input), pointer);
    return;
  }
  const checked = checkValue(binding, input);
  c.collect(checked, pointer);
  if (!checked.ok) return;
  const resolved = resolveBindingPath(checked.value.from, checked.value.path, manifest);
  if (!resolved) c.reject(`${pointer}/path`, "Binding path does not resolve");
  else if ((resolved.type ?? "object") !== (target.type ?? "object"))
    c.reject(pointer, "Binding type does not match source parameter");
}

function checkSource(entry: unknown, pointer: string, manifest: Manifest, capabilities: Capabilities, c: Checks): void {
  if (!isRecord(entry)) {
    c.reject(pointer, "Expected a source object");
    return;
  }
  const structure = checkValue(sourceFields, shell(entry, ["params"]));
  c.collect(structure, pointer);
  if (!structure.ok) return;
  const source = Object.hasOwn(capabilities.sources, entry.source as string)
    ? capabilities.sources[entry.source as string]
    : undefined;
  if (!source) {
    c.reject(`${pointer}/source`, "Undeclared source", "unknown-name");
    return;
  }
  if (!isRecord(entry.params)) {
    c.reject(`${pointer}/params`, "Expected a source parameter map");
    return;
  }
  for (const key of source.params.required)
    if (!Object.hasOwn(entry.params, key))
      c.reject(at(`${pointer}/params`, key), "Required source parameter is unbound");
  for (const [key, input] of Object.entries(entry.params)) {
    if (c.errors.length >= 20) break;
    checkSourceParam(key, input, at(`${pointer}/params`, key), source, manifest, c);
  }
}

/** Context must contain an installed, validated catalog and capabilities. */
export function validateManifest(
  doc: unknown,
  { catalog, capabilities }: { catalog: Catalog; capabilities: Capabilities },
): Result<Manifest> {
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a manifest object");
  else {
    c.collect(checkValue(fields, shell(doc, ["params", "state", "context", "initialState", "sources", "meta"])), "");
    for (const key of ["params", "state", "context"] as const) {
      const schema = c.schema(doc[key], `/${key}`);
      if (schema) rejectPatterns(schema, `/${key}`, c.reject);
    }
    if (Object.hasOwn(doc, "meta")) checkMeta(doc.meta, "/meta", c);
    // Schema checks must pass before traversing author-supplied schemas.
    if (c.errors.length) return { ok: false, errors: c.errors };
    const value = doc as Manifest;
    if (value.catalogId !== catalog.catalogId) c.reject("/catalogId", "Catalog does not match", "catalog-mismatch");
    c.collect(checkValue(value.state, value.initialState), "/initialState");
    checkActionList(value.actions, capabilities, c);
    c.map(value.sources, "/sources", (entry, pointer) => checkSource(entry, pointer, value, capabilities, c));
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Manifest };
}

/** Package transport checks only; installation still requires validateManifest with host documents. */
export function validateManifestShape(doc: unknown): Result<Manifest> {
  const c = documentChecks();
  c.collect(validateJson(doc), "");
  if (!isRecord(doc)) c.reject("", "Expected a manifest object");
  else {
    c.collect(checkValue(fields, shell(doc, ["params", "state", "context", "initialState", "sources", "meta"])), "");
    for (const key of ["params", "state", "context"] as const) {
      const schema = c.schema(doc[key], `/${key}`);
      if (schema) rejectPatterns(schema, `/${key}`, c.reject);
    }
    if (Object.hasOwn(doc, "meta")) checkMeta(doc.meta, "/meta", c);
    if (Array.isArray(doc.actions)) {
      const seen = new Set<unknown>();
      for (const [i, name] of doc.actions.entries()) {
        if (c.errors.length >= 20) break;
        if (seen.has(name)) c.reject(`/actions/${i}`, "Duplicate action");
        seen.add(name);
      }
    }
    c.map(doc.sources, "/sources", (source, pointer) => {
      if (!isRecord(source)) {
        c.reject(pointer, "Expected a source object");
        return;
      }
      c.collect(checkValue(sourceFields, shell(source, ["params"])), pointer);
      if (!isRecord(source.params)) c.reject(`${pointer}/params`, "Expected a source parameter map");
      else
        for (const [key, value] of Object.entries(source.params)) {
          if (c.errors.length >= 20) break;
          if (isRecord(value) && Object.hasOwn(value, "from"))
            c.collect(checkValue(binding, value), at(`${pointer}/params`, key));
        }
    });
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Manifest };
}

/** Walks a dotted binding path through one input; anything absent answers undefined. */
function boundValue(input: unknown, path: string): unknown {
  let value = input;
  for (const segment of path.split(".")) {
    if (!isRecord(value) || !Object.hasOwn(value, segment)) return undefined;
    value = value[segment];
  }
  return value;
}

/** One source entry's resolved parameters, or undefined when a required binding is absent. */
function bindSourceParams(
  entry: Manifest["sources"][string],
  source: Source,
  present: Record<string, unknown>,
  pointer: string,
  c: Checks,
): Readonly<Record<string, Json>> | undefined {
  const params: Record<string, unknown> = {};
  let unbound = false;
  for (const [name, input] of Object.entries(entry.params)) {
    if (c.errors.length >= 20) break;
    if (!isRecord(input) || typeof input.from !== "string" || typeof input.path !== "string") {
      params[name] = input;
      continue;
    }
    const value = boundValue(present[input.from], input.path);
    if (value !== undefined) params[name] = value;
    else if (source.params.required.includes(name)) {
      // One clear error per required binding beats the schema's own "required" complaint too.
      unbound = true;
      c.reject(at(at(pointer, "params"), name), "Expected a bound source parameter", "invalid-prop");
    }
  }
  if (unbound) return undefined;
  c.collect(checkValue(source.params, params), at(pointer, "params"));
  return params as Readonly<Record<string, Json>>;
}

/**
 * A manifest's source bindings evaluated for one render's inputs (spec §7.1). Pure: it reads the
 * inputs and never resolves a source or runs an action, so the host still authorises each read as
 * the viewer. A binding to an absent value is omitted when its parameter is optional and
 * `invalid-prop` when it is required; the resolved parameters then face the source's schema.
 */
export function bindSources(
  manifest: unknown,
  capabilities: unknown,
  // One render's inputs, the values a binding path walks; an absent input leaves its bindings unbound.
  inputs: { readonly params?: unknown; readonly state?: unknown; readonly context?: unknown },
): Result<Readonly<Record<string, { readonly source: string; readonly params: Json }>>> {
  const install = validateCapabilities(capabilities);
  if (!install.ok) throw new LiveframeFailure(install.errors);
  // No catalog here, so the manifest gets its shape check; installing it is what checks the
  // catalog. Both throw like compileValidator does, so a host fails at the same place either way.
  const shape = validateManifestShape(manifest);
  if (!shape.ok) throw new LiveframeFailure(shape.errors);
  const sources = install.value.sources;
  const present: Record<string, unknown> = {};
  for (const key of ["params", "state", "context"] as const) {
    if (inputs[key] !== undefined) present[key] = inputs[key];
  }
  const c = documentChecks();
  // Cycles, accessors, functions and non-finite numbers in any input are rejected here, at the
  // pointer of the offending member, so later reads only ever see JSON.
  c.collect(validateJson(present), "");
  if (c.errors.length) return { ok: false, errors: c.errors };
  const bound: Record<string, { source: string; params: Json }> = {};
  for (const [key, entry] of Object.entries(shape.value.sources)) {
    if (c.errors.length >= 20) break;
    const pointer = at("/sources", key);
    if (!Object.hasOwn(sources, entry.source)) {
      c.reject(at(pointer, "source"), "Undeclared source", "unknown-name", "a declared source");
      continue;
    }
    const params = bindSourceParams(entry, sources[entry.source] as Source, present, pointer, c);
    if (params) bound[key] = { source: entry.source, params };
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: bound };
}
