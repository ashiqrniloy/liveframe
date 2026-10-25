import type { Result } from "../errors.ts";
import { arr, bool, checkValue, type Infer, type LanguageSchema, obj, str } from "../schema.ts";
import {
  at,
  type Capabilities,
  capabilityName,
  documentChecks,
  isRecord,
  namedMap,
  type ObjectSchema,
  shell,
} from "./capabilities.ts";
import { validateJson } from "./json.ts";
import type { Catalog } from "./catalog.ts";

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
const binding = obj({
  from: str({ maxLength: 7, enum: ["params", "state", "context"] }),
  path: str({ maxLength: 512, pattern: "^[a-zA-Z_$][a-zA-Z0-9_$]*(\\.[a-zA-Z_$][a-zA-Z0-9_$]*){0,7}$" }),
});
const fields = obj({
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
});
const sourceFields = obj({ source: capabilityName, params: bool() });
export type Manifest = Omit<Infer<typeof fields>, "params" | "state" | "context" | "initialState" | "sources"> & {
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
  if (schema.type === "string") {
    if (Object.hasOwn(schema, "pattern"))
      reject(`${pointer}/pattern`, "Expected no pattern in widget schemas", "invalid-document", noPattern);
  } else if (schema.type === "array") rejectPatterns(schema.items, `${pointer}/items`, reject);
  else if (schema.type === "object")
    for (const [key, child] of Object.entries(schema.properties))
      rejectPatterns(child, at(at(pointer, "properties"), key), reject);
}

/** Context must contain an installed, validated catalog and capabilities. */
export function validateManifest(
  doc: unknown,
  { catalog, capabilities }: { catalog: Catalog; capabilities: Capabilities },
): Result<Manifest> {
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a manifest object");
  else {
    c.collect(checkValue(fields, shell(doc, ["params", "state", "context", "initialState", "sources"])), "");
    for (const key of ["params", "state", "context"] as const) {
      const schema = c.schema(doc[key], `/${key}`);
      if (schema) rejectPatterns(schema, `/${key}`, c.reject);
    }
    // Schema checks must pass before traversing author-supplied schemas.
    if (c.errors.length) return { ok: false, errors: c.errors };
    const value = doc as Manifest;
    if (value.catalogId !== catalog.catalogId) c.reject("/catalogId", "Catalog does not match", "catalog-mismatch");
    c.collect(checkValue(value.state, value.initialState), "/initialState");
    const seen = new Set<string>();
    for (const [i, name] of value.actions.entries()) {
      if (c.errors.length >= 20) break;
      if (!Object.hasOwn(capabilities.actions, name)) c.reject(`/actions/${i}`, "Undeclared action", "unknown-name");
      if (seen.has(name)) c.reject(`/actions/${i}`, "Duplicate action");
      seen.add(name);
    }
    c.map(value.sources, "/sources", (entry, pointer) => {
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
        const path = at(`${pointer}/params`, key);
        const target = Object.hasOwn(source.params.properties, key) ? source.params.properties[key] : undefined;
        if (!target) {
          c.reject(path, "Undeclared source parameter", "unknown-name");
          continue;
        }
        if (isRecord(input) && Object.hasOwn(input, "from")) {
          const checked = checkValue(binding, input);
          c.collect(checked, path);
          if (!checked.ok) continue;
          let resolved: LanguageSchema | undefined = value[checked.value.from];
          for (const segment of checked.value.path.split(".")) {
            resolved =
              resolved?.type === "object" && Object.hasOwn(resolved.properties, segment)
                ? resolved.properties[segment]
                : undefined;
          }
          if (!resolved) c.reject(`${path}/path`, "Binding path does not resolve");
          else if (resolved.type !== target.type) c.reject(path, "Binding type does not match source parameter");
        } else c.collect(checkValue(target, input), path);
      }
    });
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Manifest };
}

/** Package transport checks only; installation still requires validateManifest with host documents. */
export function validateManifestShape(doc: unknown): Result<Manifest> {
  const c = documentChecks();
  c.collect(validateJson(doc), "");
  if (!isRecord(doc)) c.reject("", "Expected a manifest object");
  else {
    c.collect(checkValue(fields, shell(doc, ["params", "state", "context", "initialState", "sources"])), "");
    for (const key of ["params", "state", "context"] as const) {
      const schema = c.schema(doc[key], `/${key}`);
      if (schema) rejectPatterns(schema, `/${key}`, c.reject);
    }
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
