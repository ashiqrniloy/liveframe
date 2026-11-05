import type { LiveframeError, Result } from "../errors.ts";
import { at } from "../internal.ts";
import {
  bool,
  checkSchemaRelationships,
  type Infer,
  isRecord,
  type LanguageSchema,
  obj,
  record,
  str,
} from "../schema.ts";
import { stringBytes } from "../validate/bytes.ts";
import { checkFormat } from "./check.ts";
import { validateJson } from "./json.ts";
import { jsonSchema, objectSchema, schemaLanguage } from "./language.ts";
import type { Manifest } from "./manifest.ts";
import type { Json } from "./tree.ts";

export type ObjectSchema = Extract<LanguageSchema, { readonly type: "object" }>;
export const capabilityName = str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9]*(\\.[a-z][a-zA-Z0-9]*)*$" });
const description = str({ maxLength: 500 });
const actionFields = obj({ description, args: bool() }, { confirm: bool(), irreversible: bool(), meta: bool() });
const sourceFields = obj({ description, params: bool(), result: bool() }, { meta: bool() });
const json = { $ref: "#/$defs/json" };
const fields = obj({
  format: str({ maxLength: 32, enum: ["liveframe-capabilities/1"] }),
  actions: bool(),
  sources: bool(),
});
export type Capabilities = {
  readonly format: "liveframe-capabilities/1";
  readonly actions: Readonly<
    Record<
      string,
      Omit<Infer<typeof actionFields>, "args" | "meta"> & { readonly args: ObjectSchema; readonly meta?: Json }
    >
  >;
  readonly sources: Readonly<
    Record<
      string,
      Omit<Infer<typeof sourceFields>, "params" | "result" | "meta"> & {
        readonly params: ObjectSchema;
        readonly result: LanguageSchema;
        readonly meta?: Json;
      }
    >
  >;
};
export function namedMap<S>(values: S, max = 512) {
  return { ...record(capabilityName.pattern, values, max), propertyNames: capabilityName };
}
export const capabilitiesSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    actions: namedMap({
      ...actionFields,
      properties: { ...actionFields.properties, args: { $ref: "#/$defs/objectSchema" }, meta: json },
    }),
    sources: namedMap({
      ...sourceFields,
      properties: {
        ...sourceFields.properties,
        params: { $ref: "#/$defs/objectSchema" },
        result: { $ref: "#/$defs/schema" },
        meta: json,
      },
    }),
  },
  $defs: { ...schemaLanguage.$defs, objectSchema, json: jsonSchema },
};

// Shared document checks preserve pointed, bounded failures for both formats.
export function documentChecks() {
  const errors: LiveframeError[] = [];
  function reject(
    pointer: string,
    message: string,
    kind: LiveframeError["kind"] = "invalid-document",
    expected?: string,
  ) {
    if (errors.length < 20) errors.push({ kind, pointer, message, ...(expected === undefined ? {} : { expected }) });
  }
  function collect(result: Result<unknown>, pointer: string) {
    if (!result.ok)
      for (const error of result.errors)
        if (errors.length < 20) errors.push({ ...error, pointer: pointer + error.pointer });
  }
  function schemaRelationships(value: LanguageSchema, pointer: string): void {
    const start = errors.length;
    const valid = checkSchemaRelationships(value, (path, expected) =>
      reject(pointer + path, `Expected ${expected}`, "invalid-document", expected),
    );
    if (!valid && errors.length === start) reject(pointer, "Expected a language schema");
  }
  return { errors, reject, collect, schemaRelationships };
}
export { isRecord };

const metaDepth = 8;
const metaBytes = 4096;
/** Compact JSON bytes of a scalar, or undefined when the value is not a JSON scalar. */
function scalarBytes(value: unknown, remaining: number): number | undefined {
  if (value === null || typeof value === "boolean") return value === false ? 5 : 4;
  if (typeof value === "number") return Number.isFinite(value) ? String(value).length : undefined;
  return typeof value === "string" ? stringBytes(value, remaining) : undefined;
}
const isContainer = (value: unknown): value is object =>
  typeof value === "object" &&
  value !== null &&
  (Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)));

/** A container's members in document order; an array longer than the byte bound is refused (each element costs a byte). */
function membersOf(value: object): [string | number, unknown][] | undefined {
  if (!Array.isArray(value)) return Object.entries(value);
  return value.length > metaBytes ? undefined : Array.from(value, (child, i) => [i, child]);
}

/**
 * Host `meta` is JSON the library never reads (law 4). Bounded by nesting depth and compact UTF-8
 * bytes, counted while walking so an oversized or cyclic value stops early without serialising.
 */
export function checkMeta(meta: unknown, pointer: string, c: ReturnType<typeof documentChecks>): void {
  let bytes = 0;
  const fail = (path: string, message: string, expected?: string) => {
    c.reject(path, message, expected ? "limit-exceeded" : "invalid-document", expected);
    return false;
  };
  const tooLarge = () => fail(pointer, `Expected at most ${metaBytes} bytes of JSON`, `at most ${metaBytes} bytes`);
  const walk = (value: unknown, path: string, depth: number): boolean => {
    if (!isContainer(value)) {
      const size = scalarBytes(value, metaBytes - bytes);
      if (size === undefined) return fail(path, "Expected a JSON value without cycles or non-finite numbers");
      bytes += size;
      return bytes <= metaBytes || tooLarge();
    }
    if (depth > metaDepth)
      return fail(path, `Expected at most ${metaDepth} levels of nesting`, `at most ${metaDepth} levels`);
    bytes += 2;
    const members = membersOf(value);
    if (!members) return tooLarge();
    for (const [i, [key, child]] of members.entries()) {
      bytes += (i > 0 ? 1 : 0) + (typeof key === "string" ? stringBytes(key, metaBytes - bytes) + 1 : 0);
      if (bytes > metaBytes) return tooLarge();
      if (!walk(child, at(path, key), depth + 1)) return false;
    }
    return bytes <= metaBytes || tooLarge();
  };
  walk(meta, pointer, 1);
}
export { at };
/** Describes available operations; the host still authorises every request. */
export function validateCapabilities(doc: unknown): Result<Capabilities> {
  const json = validateJson(doc, true);
  if (!json.ok) return json;
  const c = documentChecks();
  if (isRecord(doc))
    for (const key of ["actions", "sources"] as const) {
      if (!isRecord(doc[key])) continue;
      for (const [name, entry] of Object.entries(doc[key]))
        if (isRecord(entry) && Object.hasOwn(entry, "meta")) checkMeta(entry.meta, `${at(`/${key}`, name)}/meta`, c);
    }
  if (c.errors.length) return { ok: false, errors: c.errors };
  c.collect(checkFormat(capabilitiesSchema, doc), "");
  if (c.errors.length) return { ok: false, errors: c.errors };
  const value = doc as Capabilities;
  for (const [key, entries] of Object.entries({ actions: value.actions, sources: value.sources }))
    for (const [name, entry] of Object.entries(entries)) {
      const pointer = at(`/${key}`, name);
      if ("args" in entry) c.schemaRelationships(entry.args, `${pointer}/args`);
      else {
        c.schemaRelationships(entry.params, `${pointer}/params`);
        c.schemaRelationships(entry.result, `${pointer}/result`);
      }
    }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Capabilities };
}

/** Selects from installed documents, preserving capability entry order and metadata. */
export function capabilitiesFor(capabilities: Capabilities, manifest: Manifest): Result<Capabilities> {
  const c = documentChecks();
  const actions = new Set(manifest.actions);
  const sources = new Set(Object.values(manifest.sources).map((entry) => entry.source));
  for (const [i, name] of manifest.actions.entries())
    if (!Object.hasOwn(capabilities.actions, name)) c.reject(`/actions/${i}`, "Undeclared action", "unknown-name");
  for (const [alias, entry] of Object.entries(manifest.sources))
    if (!Object.hasOwn(capabilities.sources, entry.source))
      c.reject(`${at("/sources", alias)}/source`, "Undeclared source", "unknown-name");
  if (c.errors.length) return { ok: false, errors: c.errors };
  return {
    ok: true,
    value: {
      format: capabilities.format,
      actions: Object.fromEntries(Object.entries(capabilities.actions).filter(([name]) => actions.has(name))),
      sources: Object.fromEntries(Object.entries(capabilities.sources).filter(([name]) => sources.has(name))),
    },
  };
}
