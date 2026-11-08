import { type Capabilities, isRecord, type ObjectSchema } from "../formats/capabilities.ts";
import type { Manifest } from "../formats/manifest.ts";
import { at } from "../internal.ts";
import { codePointsWithin, type LanguageSchema } from "../schema.ts";
import { reject } from "./checks.ts";
import { compileSchema, type SchemaCheck, type SchemaSink } from "./schema.ts";

/** Plan 029 design A1–A3: the host's report on one action, supplied as the `actions` input. */
const STATUSES = ["pending", "ok", "failed", "refused"] as const;
export const MAX_ACTION_RESULTS = 64;
export const MAX_RESULT_KEY = 128;

/** The entry schema of one action: `value` exists only when the capability declares a `result`. */
function statusSchema(result: LanguageSchema | undefined): ObjectSchema {
  const properties: Record<string, LanguageSchema> = {
    status: { type: "string", maxLength: 7, enum: [...STATUSES] },
    action: { type: "string", maxLength: 128 },
    reason: { type: "string", maxLength: 500 },
    at: { type: "string", maxLength: 64 },
  };
  if (result) properties.value = result;
  return { type: "object", properties, required: ["status"], additionalProperties: false };
}

const resultOf = (capabilities: Capabilities, name: string) =>
  Object.hasOwn(capabilities.actions, name) ? capabilities.actions[name]?.result : undefined;

/**
 * The document a template types `actions` paths against: one optional status per manifest action.
 * Row-keyed results (`resultKey`) are reached with `$get`, whose dynamic key reads every status type.
 */
export function actionsSchema(manifest: Manifest, capabilities: Capabilities): ObjectSchema {
  const properties: Record<string, LanguageSchema> = {};
  for (const name of manifest.actions) properties[name] = statusSchema(resultOf(capabilities, name));
  return { type: "object", properties, required: [], additionalProperties: false };
}

/**
 * Checks the `actions` input (design A2–A3): at most 64 entries keyed by a result key, each a closed
 * status object whose `action` names a manifest action (defaulting to the key) and whose `value`
 * appears only with `ok` and fits that action's `result` schema.
 */
export function compileActions(manifest: Manifest, capabilities: Capabilities): SchemaCheck {
  const names = new Set(manifest.actions);
  const entries = new Map(
    manifest.actions.map((name) => [name, compileSchema(statusSchema(resultOf(capabilities, name)))]),
  );
  const actionExpected = `an action in the manifest: ${manifest.actions.join(", ") || "none"}`;

  /** One entry: its key, its action, then its status object against that action's schema. */
  function checkEntry(key: string, entry: unknown, pointer: string, sink: SchemaSink): boolean {
    if (!codePointsWithin(key, MAX_RESULT_KEY, 1))
      return reject(sink, pointer, `a result key of 1–${MAX_RESULT_KEY} characters`);
    if (!isRecord(entry)) return reject(sink, pointer, "an action status object");
    const action = Object.hasOwn(entry, "action") ? entry.action : key;
    if (typeof action !== "string" || !names.has(action) || (names.has(key) && action !== key))
      return reject(sink, `${pointer}/action`, names.has(key) ? `the action name ${key}` : actionExpected);
    if (Object.hasOwn(entry, "value") && entry.status !== "ok")
      return reject(sink, `${pointer}/value`, "a value only with status ok");
    return (entries.get(action) as SchemaCheck)(entry, pointer, sink);
  }

  return (value, path, sink) => {
    if (!isRecord(value)) return reject(sink, path, "an object of action statuses");
    let valid = true;
    let count = 0;
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      if (++count > MAX_ACTION_RESULTS) return reject(sink, path, `at most ${MAX_ACTION_RESULTS} action statuses`);
      if (!valid && sink.errors.length >= sink.maxErrors) return false;
      if (!checkEntry(key, value[key], at(path, key), sink)) valid = false;
    }
    return valid;
  };
}
