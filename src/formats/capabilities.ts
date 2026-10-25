import type { LiveframeError, Result } from "../errors.ts";
import { bool, checkValue, type Infer, isLanguageSchema, type LanguageSchema, obj, record, str } from "../schema.ts";

export type ObjectSchema = Extract<LanguageSchema, { readonly type: "object" }>;
export const capabilityName = str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9]*(\\.[a-z][a-zA-Z0-9]*)*$" });
const description = str({ maxLength: 500 });
const actionFields = obj({ description, args: bool() }, { confirm: bool() });
const sourceFields = obj({ description, params: bool(), result: bool() });
const fields = obj({
  format: str({ maxLength: 32, enum: ["liveframe-capabilities/1"] }),
  actions: bool(),
  sources: bool(),
});
export type Capabilities = {
  readonly format: "liveframe-capabilities/1";
  readonly actions: Readonly<
    Record<string, Omit<Infer<typeof actionFields>, "args"> & { readonly args: ObjectSchema }>
  >;
  readonly sources: Readonly<
    Record<
      string,
      Omit<Infer<typeof sourceFields>, "params" | "result"> & {
        readonly params: ObjectSchema;
        readonly result: LanguageSchema;
      }
    >
  >;
};
export function namedMap(values: unknown, max = 512) {
  return { ...record(capabilityName.pattern, values, max), propertyNames: capabilityName };
}
export const capabilitiesSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    actions: namedMap({
      ...actionFields,
      properties: { ...actionFields.properties, args: { $ref: "#/$defs/objectSchema" } },
    }),
    sources: namedMap({
      ...sourceFields,
      properties: {
        ...sourceFields.properties,
        params: { $ref: "#/$defs/objectSchema" },
        result: { $ref: "#/$defs/schema" },
      },
    }),
  },
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
  function map(value: unknown, pointer: string, visit: (value: unknown, pointer: string) => void) {
    if (!isRecord(value)) {
      reject(pointer, "Expected a name map");
      return;
    }
    if (Object.keys(value).length > 512) {
      reject(pointer, "Expected at most 512 names");
      return;
    }
    for (const [name, entry] of Object.entries(value)) {
      if (errors.length >= 20) break;
      const path = at(pointer, name);
      collect(checkValue(capabilityName, name), path);
      visit(entry, path);
    }
  }
  function schema(value: unknown, pointer: string, object = true): LanguageSchema | undefined {
    if (!isLanguageSchema(value) || (object && value.type !== "object")) {
      reject(pointer, object ? "Expected a language object schema" : "Expected a language schema");
      return undefined;
    }
    return value;
  }
  return { errors, reject, collect, map, schema };
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function at(pointer: string, key: string | number) {
  return `${pointer}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
}
export function shell(value: Record<string, unknown>, complex: readonly string[]) {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, complex.includes(key) ? true : entry]));
}
/** Describes available operations; the host still authorises every request. */
export function validateCapabilities(doc: unknown): Result<Capabilities> {
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a capabilities object");
  else {
    c.collect(checkValue(fields, shell(doc, ["actions", "sources"])), "");
    for (const key of ["actions", "sources"] as const)
      c.map(doc[key], `/${key}`, (entry, pointer) => {
        if (!isRecord(entry)) {
          c.reject(pointer, "Expected a capability object");
          return;
        }
        c.collect(
          checkValue(key === "actions" ? actionFields : sourceFields, shell(entry, ["args", "params", "result"])),
          pointer,
        );
        if (key === "actions") c.schema(entry.args, `${pointer}/args`);
        else {
          c.schema(entry.params, `${pointer}/params`);
          c.schema(entry.result, `${pointer}/result`, false);
        }
      });
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Capabilities };
}
