import { type LiveframeError, LiveframeFailure, type Result } from "../errors.ts";
import { arr, bool, checkValue, type Infer, type LanguageSchema, obj, str } from "../schema.ts";
import { compileSchema } from "../validate/schema.ts";
import {
  at,
  type Capabilities,
  capabilityName,
  checkMeta,
  documentChecks,
  isRecord,
  namedMap,
  type ObjectSchema,
  validateCapabilities,
} from "./capabilities.ts";
import type { Catalog } from "./catalog.ts";
import { checkFormat } from "./check.ts";
import { validateJson } from "./json.ts";
import { jsonSchema, languageForms, objectSchema } from "./language.ts";

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
  { description: str({ maxLength: 500 }), meta: bool(), local: bool(), initialLocal: bool() },
);
const sourceFields = obj({ source: capabilityName, params: bool() });
export type Manifest = Omit<
  Infer<typeof fields>,
  "params" | "state" | "context" | "initialState" | "sources" | "meta" | "local" | "initialLocal"
> & {
  readonly meta?: Json;
  /** Scalar state the renderer keeps per mounted surface and `setLocal` writes (plan 029 L1); absent means none. */
  readonly local?: ObjectSchema;
  readonly initialLocal?: Json;
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
    local: { $ref: "#/$defs/objectSchema" },
    initialState: json,
    initialLocal: json,
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
    ...languageForms(false),
    objectSchema,
    json: jsonSchema,
  },
};

const noPattern = "no pattern in widget schemas; use enum or a capability";

type Checks = ReturnType<typeof documentChecks>;
type Source = Capabilities["sources"][string];

const MAX_LOCAL_PROPERTIES = 32;
const MAX_LOCAL_STRING = 256;
/** Local keys are path segments (`local.q`), so they follow the template name rule. */
const LOCAL_NAME = /^[a-z][A-Za-z0-9]{0,31}$/;
const LOCAL_TYPES: readonly (string | undefined)[] = ["boolean", "integer", "number", "string"];

/** The schema `local` takes when a manifest declares none: a closed object with no properties. */
export const NO_LOCAL: ObjectSchema = { type: "object", properties: {}, required: [], additionalProperties: false };

/** `local` holds bounded scalars and every property is required, so `local.<key>` is always present (plan 029 L1). */
function checkLocal(local: ObjectSchema, c: Checks): void {
  const names = Object.keys(local.properties);
  if (names.length > MAX_LOCAL_PROPERTIES)
    c.reject(
      "/local/properties",
      `Expected at most ${MAX_LOCAL_PROPERTIES} local properties`,
      "limit-exceeded",
      `at most ${MAX_LOCAL_PROPERTIES} properties`,
    );
  for (const name of names) {
    if (c.errors.length >= 20) break;
    const schema = local.properties[name] as LanguageSchema;
    const pointer = at("/local/properties", name);
    if (!LOCAL_NAME.test(name))
      c.reject(pointer, "Expected a local name of 1–32 letters and digits starting with a lowercase letter");
    if ("discriminator" in schema || !LOCAL_TYPES.includes(schema.type))
      c.reject(pointer, "Expected a boolean, integer, number or string property", "invalid-document");
    else if (schema.type === "string" && schema.url !== undefined)
      c.reject(`${pointer}/url`, "Expected no url rule on a local property", "invalid-document");
    else if (schema.type === "string" && !schema.enum && schema.maxLength > MAX_LOCAL_STRING)
      c.reject(
        `${pointer}/maxLength`,
        `Expected maxLength of at most ${MAX_LOCAL_STRING}`,
        "limit-exceeded",
        `at most ${MAX_LOCAL_STRING} characters`,
      );
    if (!local.required.includes(name))
      c.reject("/local/required", `Expected local property ${name} to be required`, "invalid-document");
  }
}

/** The `local` schema is a language schema first, then the narrower scalar form. */
function checkLocalSchema(manifest: Manifest, c: Checks): void {
  if (!manifest.local) return;
  c.schemaRelationships(manifest.local, "/local");
  if (!c.errors.length) checkLocal(manifest.local, c);
}

/** `initialLocal` defaults to `{}`; with every property required, a manifest that declares `local` must give one. */
function checkInitialLocal(manifest: Manifest, c: Checks): void {
  if (c.errors.length) return;
  const errors: LiveframeError[] = [];
  compileSchema(manifest.local ?? NO_LOCAL)(manifest.initialLocal ?? {}, "/initialLocal", { errors, maxErrors: 20 });
  for (const error of errors) c.reject(error.pointer, error.message, "invalid-document", error.expected);
}

function checkActionList(actions: readonly string[], capabilities: Capabilities, c: Checks): void {
  for (const [i, name] of actions.entries()) {
    if (c.errors.length >= 20) break;
    if (!Object.hasOwn(capabilities.actions, name)) c.reject(`/actions/${i}`, "Undeclared action", "unknown-name");
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
  const value = input as Infer<typeof binding>;
  const resolved = resolveBindingPath(value.from, value.path, manifest);
  if (!resolved) c.reject(`${pointer}/path`, "Binding path does not resolve");
  else if ((resolved.type ?? "object") !== (target.type ?? "object"))
    c.reject(pointer, "Binding type does not match source parameter");
}

function checkSource(
  entry: Manifest["sources"][string],
  pointer: string,
  manifest: Manifest,
  capabilities: Capabilities,
  c: Checks,
): void {
  const source = Object.hasOwn(capabilities.sources, entry.source) ? capabilities.sources[entry.source] : undefined;
  if (!source) {
    c.reject(`${pointer}/source`, "Undeclared source", "unknown-name");
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

/** Preserve the widget-pattern diagnostic while structure comes from the transport definition. */
function checkManifestStructure(doc: unknown, c: Checks): void {
  const result = checkFormat(manifestSchema, doc);
  if (!result.ok)
    c.collect(
      {
        ok: false,
        errors: result.errors.map((error) => {
          const key = error.pointer.split("/")[1] ?? "";
          const schema = isRecord(doc) ? doc[key] : undefined;
          if (["params", "state", "context", "local"].includes(key) && (!isRecord(schema) || schema.type !== "object"))
            return { ...error, pointer: `/${key}` };
          return error.expected === "no value" && error.pointer.endsWith("/pattern")
            ? { ...error, expected: noPattern, message: "Expected no pattern in widget schemas" }
            : error;
        }),
      },
      "",
    );
}

/** Context must contain an installed, validated catalog and capabilities. */
export function validateManifest(
  doc: unknown,
  { catalog, capabilities }: { catalog: Catalog; capabilities: Capabilities },
): Result<Manifest> {
  const json = validateJson(doc, true);
  if (!json.ok) return json;
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a manifest object");
  else {
    if (Object.hasOwn(doc, "meta")) checkMeta(doc.meta, "/meta", c);
    if (c.errors.length) return { ok: false, errors: c.errors };
    checkManifestStructure(doc, c);
    if (c.errors.length) return { ok: false, errors: c.errors };
    for (const key of ["params", "state", "context"] as const) {
      c.schemaRelationships((doc as Manifest)[key], `/${key}`);
    }
    // Schema checks must pass before traversing author-supplied schemas.
    checkLocalSchema(doc as Manifest, c);
    if (c.errors.length) return { ok: false, errors: c.errors };
    const value = doc as Manifest;
    if (value.catalogId !== catalog.catalogId) c.reject("/catalogId", "Catalog does not match", "catalog-mismatch");
    const stateErrors: LiveframeError[] = [];
    compileSchema(value.state)(value.initialState, "/initialState", { errors: stateErrors, maxErrors: 20 });
    for (const error of stateErrors) c.reject(error.pointer, error.message, "invalid-document", error.expected);
    checkInitialLocal(value, c);
    checkActionList(value.actions, capabilities, c);
    for (const [name, entry] of Object.entries(value.sources)) {
      if (c.errors.length >= 20) break;
      checkSource(entry, at("/sources", name), value, capabilities, c);
    }
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Manifest };
}

/** Package transport checks only; installation still requires validateManifest with host documents. */
export function validateManifestShape(doc: unknown): Result<Manifest> {
  const json = validateJson(doc);
  if (!json.ok) return json;
  const c = documentChecks();
  if (isRecord(doc) && Object.hasOwn(doc, "meta")) checkMeta(doc.meta, "/meta", c);
  if (c.errors.length) return { ok: false, errors: c.errors };
  checkManifestStructure(doc, c);
  if (c.errors.length) return { ok: false, errors: c.errors };
  const value = doc as Manifest;
  for (const key of ["params", "state", "context"] as const) {
    c.schemaRelationships(value[key], `/${key}`);
  }
  checkLocalSchema(value, c);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value };
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
