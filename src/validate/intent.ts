import { at, type Capabilities, isRecord } from "../formats/capabilities.ts";
import type { Definition } from "../formats/catalog.ts";
import { carriesSchema } from "../formats/events.ts";
import { type Manifest, NO_LOCAL } from "../formats/manifest.ts";
import { treeSchema } from "../formats/tree.ts";
import { codePointsWithin, type LanguageSchema } from "../schema.ts";
import { closed, field, reject } from "./checks.ts";
import { compileSchema, type SchemaCheck, type SchemaSink } from "./schema.ts";

const stateFields = new Set([
  ...treeSchema.$defs.intent.oneOf[0].required,
  ...Object.keys(treeSchema.$defs.intent.oneOf[0].properties),
]);
const actionFields = new Set([
  ...treeSchema.$defs.intent.oneOf[1].required,
  ...Object.keys(treeSchema.$defs.intent.oneOf[1].properties),
]);
const localFields = new Set([
  ...treeSchema.$defs.intent.oneOf[2].required,
  ...Object.keys(treeSchema.$defs.intent.oneOf[2].properties),
]);
const localWriteFields = new Set([
  ...treeSchema.$defs.localWrite.required,
  ...Object.keys(treeSchema.$defs.localWrite.properties),
]);
export type Carries = Definition["events"][string]["carries"];
const SCALAR_TYPES = new Set(["string", "boolean", "number", "integer"]);

export function carriesFits(carries: Carries, type: string): boolean {
  return (
    typeof carries === "string" &&
    carries !== "none" &&
    (carries === type || (carries === "integer" && type === "number"))
  );
}

/** The compiled check of an object or array carry; scalar carries are checked by `carriesValue`. */
export function carriesCheck(carries: Carries): SchemaCheck | undefined {
  const schema = carriesSchema(carries);
  return schema && compileSchema(schema);
}

/** An array carry fits an array target whose items take the carried scalar (spec §8); bounds are checked on the value. */
export function arrayFits(
  carry: Extract<Carries, { readonly array: unknown }>["array"],
  target: LanguageSchema,
): boolean {
  return target.type === "array" && "items" in target && localFits(carry.items, target.items);
}

/** Whether a scalar or array carry fills `target` through `bind`, implicit `setState` or implicit `setLocal`. */
export function eventFits(carries: Carries, target: LanguageSchema): boolean {
  if (typeof carries === "string") return carriesFits(carries, target.type ?? "object");
  return "array" in carries && arrayFits(carries.array, target);
}

/** The event's carry as authors read it in a message. */
export function describeCarries(carries: Carries): string {
  if (typeof carries === "string") return carries;
  return "object" in carries ? "an object" : `an array of ${carries.array.items.type}`;
}

/** True when a scalar `local` property fits `target` under the spec §8 scalar fit rule. */
export function localFits(local: LanguageSchema, target: LanguageSchema): boolean {
  if ("discriminator" in local || "discriminator" in target) return false;
  return (
    local.type !== undefined &&
    SCALAR_TYPES.has(local.type) &&
    carriesFits(local.type as Carries, target.type) &&
    (local.nullable !== true || target.nullable === true)
  );
}

/** Bounds are checked on the completed value; this compares the event's scalar shape only. */
export function objectFits(
  event: Extract<Carries, { readonly object: unknown }>["object"],
  target: LanguageSchema,
  literals: Record<string, unknown> = {},
  supplied?: ReadonlySet<string>,
): boolean {
  if (target.type !== "object") return false;
  return (
    target.required.every(
      (key) => Object.hasOwn(literals, key) || Boolean(supplied?.has(key)) || event.required.includes(key),
    ) &&
    Object.entries(event.properties).every(([key, property]) => {
      const argument = target.properties[key];
      return (
        Object.hasOwn(target.properties, key) &&
        argument !== undefined &&
        property.type !== undefined &&
        carriesFits(property.type as Carries, argument.type ?? "object") &&
        (property.nullable !== true || argument.nullable === true)
      );
    })
  );
}

function checkBindAll(
  value: Record<string, unknown>,
  args: Record<string, unknown>,
  carries: Carries,
  schema: Extract<LanguageSchema, { readonly type: "object" }>,
  sink: SchemaSink,
  supplied?: ReadonlySet<string>,
): boolean {
  if (value.bindAll !== true || Object.hasOwn(value, "bind") || typeof carries !== "object" || !("object" in carries))
    return reject(sink, "/bindAll", "bindAll: true on an object event, without bind");
  let valid = true;
  for (const key of Object.keys(carries.object.properties))
    if (Object.hasOwn(args, key)) valid = reject(sink, at("/args", key), "event properties omitted from literal args");
  if (!objectFits(carries.object, schema, args, supplied))
    valid = reject(sink, "/bindAll", "an event schema fitting the action arguments minus literal args");
  const check = compileSchema({
    ...schema,
    required: schema.required.filter((key) => !carries.object.required.includes(key) && !supplied?.has(key)),
  });
  return field(check, args, sink, "args") && valid;
}

function rebase(sink: SchemaSink, start: number, prefix: string): void {
  for (let i = start; i < sink.errors.length; i++) {
    const error = sink.errors[i];
    if (error) sink.errors[i] = { ...error, pointer: prefix + error.pointer };
  }
}

function checkLocalWriteFields(entry: Record<string, unknown>, entryPath: string, sink: SchemaSink): boolean {
  const start = sink.errors.length;
  const valid = closed(entry, localWriteFields, sink);
  if (!valid) rebase(sink, start, entryPath);
  return Object.hasOwn(entry, "until") && entry.until !== "revision"
    ? reject(sink, `${entryPath}/until`, '"revision"')
    : valid;
}
/** An action intent's optional `resultKey` is a label of 1–128 characters (spec §8). */
function checkResultKey(value: Record<string, unknown>, sink: SchemaSink): boolean {
  if (!Object.hasOwn(value, "resultKey")) return true;
  const key = value.resultKey;
  return (
    (typeof key === "string" && codePointsWithin(key, 128, 1)) ||
    reject(sink, "/resultKey", "a result key of 1–128 characters")
  );
}

export function compileIntents(capabilities: Capabilities, manifest: Manifest): (carries: Carries) => SchemaCheck {
  const states = new Map(
    Object.entries(manifest.state.properties).map(([name, schema]) => [
      name,
      { schema, type: schema.type ?? "object", check: compileSchema(schema) },
    ]),
  );
  const actions = new Map(
    manifest.actions.map((name) => {
      const schema = capabilities.actions[name]?.args;
      if (!schema) throw new Error(`Missing validated capability: ${name}`);
      const bindings = new Map(
        Object.entries(schema.properties).map(([key, property]) => [
          key,
          {
            schema: property,
            // The event supplies this property later; validate every other argument now.
            check: compileSchema({ ...schema, required: schema.required.filter((name) => name !== key) }),
          },
        ]),
      );
      return [name, { schema, check: compileSchema(schema), bindings }];
    }),
  );
  // `local` is scalar-only (spec §8), so each property's `type` is the scalar the event must carry.
  const locals = new Map(
    Object.entries((manifest.local ?? NO_LOCAL).properties).map(([name, schema]) => [
      name,
      { schema, type: schema.type ?? "object", check: compileSchema(schema) },
    ]),
  );
  // `setLocal` is offered to authors only when the manifest declares local state to write.
  const intentNames = locals.size ? "setState, setLocal or action" : "setState or action";
  const localExpected = `a declared local key: ${[...locals.keys()].join(", ") || "none"}`;
  const stateExpected = `a declared state key: ${[...states.keys()].join(", ") || "none"}`;
  const actionExpected = `an action in the manifest: ${[...actions.keys()].join(", ") || "none"}`;

  function checkLocalKeyFit(
    localKey: unknown,
    target: LanguageSchema,
    targetType: string,
    pointer: string,
    sink: SchemaSink,
  ): boolean {
    if (typeof localKey !== "string" || !codePointsWithin(localKey, 128, 1))
      return reject(sink, pointer, localExpected);
    const local = locals.get(localKey);
    if (!local) return reject(sink, pointer, localExpected, "unknown-name");
    return localFits(local.schema, target) || reject(sink, pointer, `a local key fitting ${targetType}`);
  }

  function checkSetState(value: Record<string, unknown>, carries: Carries, sink: SchemaSink): boolean {
    let valid = closed(value, stateFields, sink);
    const state = typeof value.key === "string" && Object.hasOwn(value, "key") ? states.get(value.key) : undefined;
    if (!state) return reject(sink, "/key", stateExpected);
    const hasValue = Object.hasOwn(value, "value");
    const hasFromLocal = Object.hasOwn(value, "fromLocal");
    if (hasValue && !field(state.check, value.value, sink, "value")) valid = false;
    if (hasFromLocal) {
      if (hasValue) valid = reject(sink, "/fromLocal", "fromLocal without an explicit value");
      if (!checkLocalKeyFit(value.fromLocal, state.schema, state.type, "/fromLocal", sink)) valid = false;
      return valid;
    }
    if (
      !hasValue &&
      !(typeof carries === "object" && "object" in carries
        ? objectFits(carries.object, state.schema)
        : eventFits(carries, state.schema))
    )
      valid = reject(sink, "/value", `an explicit ${state.type} value, or an event carrying ${state.type}`);
    return valid;
  }

  function checkSetLocal(value: Record<string, unknown>, carries: Carries, sink: SchemaSink): boolean {
    let valid = closed(value, localFields, sink);
    const local = typeof value.key === "string" && Object.hasOwn(value, "key") ? locals.get(value.key) : undefined;
    if (!local) return reject(sink, "/key", localExpected, "unknown-name");
    if (Object.hasOwn(value, "value")) {
      if (!field(local.check, value.value, sink, "value")) valid = false;
    } else if (!carriesFits(carries, local.type))
      valid = reject(sink, "/value", `an explicit ${local.type} value, or an event carrying ${local.type}`);
    return valid;
  }

  const bindExpected = (action: { bindings: Map<string, { schema: LanguageSchema }> }, carries: Carries) => {
    const compatible = [...action.bindings]
      .filter(([, argument]) => eventFits(carries, argument.schema))
      .map(([key]) => key);
    return compatible.length
      ? `one of: ${compatible.join(", ")} (event carries ${describeCarries(carries)})`
      : `omit bind: no compatible arguments (event carries ${describeCarries(carries)})`;
  };

  function checkActionFromLocalEntry(
    arg: string,
    localKey: unknown,
    value: Record<string, unknown>,
    args: Record<string, unknown>,
    carries: Carries,
    schema: Extract<LanguageSchema, { readonly type: "object" }>,
    argExpected: string,
    supplied: Set<string>,
    sink: SchemaSink,
  ): boolean {
    const entryPath = at("/fromLocal", arg);
    const target = Object.hasOwn(schema.properties, arg) ? schema.properties[arg] : undefined;
    if (!target) return reject(sink, entryPath, argExpected);
    supplied.add(arg);
    let valid = true;
    const boundByBindAll =
      value.bindAll === true &&
      typeof carries === "object" &&
      "object" in carries &&
      Object.hasOwn(carries.object.properties, arg);
    if (Object.hasOwn(args, arg) || value.bind === arg || boundByBindAll)
      valid = reject(sink, entryPath, "an argument filled once: not also a literal, bind or bindAll");
    return checkLocalKeyFit(localKey, target, target.type ?? "object", entryPath, sink) && valid;
  }

  function checkActionFromLocal(
    value: Record<string, unknown>,
    args: Record<string, unknown>,
    carries: Carries,
    schema: Extract<LanguageSchema, { readonly type: "object" }>,
    sink: SchemaSink,
  ): { readonly valid: boolean; readonly supplied?: ReadonlySet<string> } {
    if (!Object.hasOwn(value, "fromLocal")) return { valid: true };
    const raw = value.fromLocal;
    if (!isRecord(raw)) return { valid: reject(sink, "/fromLocal", "a map of argument names to local keys") };
    const entries = Object.entries(raw);
    if (entries.length === 0) return { valid: reject(sink, "/fromLocal", "1 to 16 fromLocal entries") };
    if (entries.length > 16)
      return { valid: reject(sink, "/fromLocal", "at most 16 fromLocal entries", "limit-exceeded") };
    let valid = true;
    const supplied = new Set<string>();
    const argExpected = `a declared argument of ${String(value.name)}: ${Object.keys(schema.properties).join(", ") || "none"}`;
    for (const [arg, localKey] of entries) {
      if (!checkActionFromLocalEntry(arg, localKey, value, args, carries, schema, argExpected, supplied, sink))
        valid = false;
    }
    return { valid, supplied };
  }

  function actionArgsCheck(
    action: NonNullable<ReturnType<typeof actions.get>>,
    bound: string | undefined,
    supplied: ReadonlySet<string> | undefined,
  ): SchemaCheck {
    if (supplied?.size) {
      return compileSchema({
        ...action.schema,
        required: action.schema.required.filter((key) => key !== bound && !supplied.has(key)),
      });
    }
    return (bound !== undefined ? action.bindings.get(bound)?.check : undefined) ?? action.check;
  }

  function checkActionBind(
    value: Record<string, unknown>,
    action: NonNullable<ReturnType<typeof actions.get>>,
    carries: Carries,
    sink: SchemaSink,
  ): { readonly ok: boolean; readonly valid: boolean; readonly bound?: string } {
    if (!Object.hasOwn(value, "bind")) return { ok: true, valid: true };
    const bound = typeof value.bind === "string" ? value.bind : "";
    const binding = action.bindings.get(bound);
    if (!binding || !eventFits(carries, binding.schema))
      return { ok: reject(sink, "/bind", bindExpected(action, carries)), valid: false };
    const valid =
      !Object.hasOwn(value.args as object, bound) ||
      reject(sink, at("/args", bound), "the bound argument omitted from args");
    return { ok: true, valid, bound };
  }

  function checkAction(value: Record<string, unknown>, carries: Carries, sink: SchemaSink): boolean {
    let valid = closed(value, actionFields, sink);
    const action = typeof value.name === "string" && Object.hasOwn(value, "name") ? actions.get(value.name) : undefined;
    if (!action) return reject(sink, "/name", actionExpected, "undeclared-action");
    if (!Object.hasOwn(value, "args") || !isRecord(value.args))
      return reject(sink, "/args", "an object of action arguments");
    const fromLocal = checkActionFromLocal(value, value.args, carries, action.schema, sink);
    if (!fromLocal.valid) valid = false;
    if (Object.hasOwn(value, "bindAll"))
      return checkBindAll(value, value.args, carries, action.schema, sink, fromLocal.supplied) && valid;
    const bindResult = checkActionBind(value, action, carries, sink);
    if (!bindResult.ok) return false;
    if (!bindResult.valid) valid = false;
    return field(actionArgsCheck(action, bindResult.bound, fromLocal.supplied), value.args, sink, "args") && valid;
  }

  function checkLocalWriteEntry(entry: unknown, entryPath: string, carries: Carries, sink: SchemaSink): boolean {
    if (!isRecord(entry)) return reject(sink, entryPath, "a local write object");
    let valid = checkLocalWriteFields(entry, entryPath, sink);
    const local = typeof entry.key === "string" && Object.hasOwn(entry, "key") ? locals.get(entry.key) : undefined;
    if (!local) return reject(sink, `${entryPath}/key`, localExpected, "unknown-name");
    if (!Object.hasOwn(entry, "value")) {
      return carriesFits(carries, local.type)
        ? valid
        : reject(sink, `${entryPath}/value`, `an explicit ${local.type} value, or an event carrying ${local.type}`);
    }
    const start = sink.errors.length;
    if (!local.check(entry.value, "", sink)) {
      valid = false;
      rebase(sink, start, `${entryPath}/value`);
    }
    return valid;
  }

  function checkLocalWrites(value: Record<string, unknown>, carries: Carries, sink: SchemaSink): boolean {
    if (!Object.hasOwn(value, "local")) return true;
    const writes = value.local;
    if (!Array.isArray(writes) || writes.length === 0) return reject(sink, "/local", "1 to 4 local writes");
    if (writes.length > 4) return reject(sink, "/local", "at most 4 local writes", "limit-exceeded");
    let valid = true;
    for (let i = 0; i < writes.length; i++) {
      if (!checkLocalWriteEntry(writes[i], `/local/${i}`, carries, sink)) valid = false;
      if (!valid && sink.errors.length >= sink.maxErrors) break;
    }
    return valid;
  }

  return (carries) => (value, path, sink) => {
    if (!isRecord(value)) return reject(sink, path, `one ${intentNames} intent`);
    if (!Object.hasOwn(value, "type")) return reject(sink, "/type", `intent type ${intentNames}`);
    if (value.type === "setState") {
      const checked = checkSetState(value, carries, sink);
      return checkLocalWrites(value, carries, sink) && checked;
    }
    if (value.type === "setLocal") return checkSetLocal(value, carries, sink);
    if (value.type === "action") {
      const keyed = checkResultKey(value, sink);
      const checked = checkAction(value, carries, sink);
      return checkLocalWrites(value, carries, sink) && checked && keyed;
    }
    return reject(sink, "/type", `intent type ${intentNames}`);
  };
}
