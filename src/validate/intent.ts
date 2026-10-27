import { at, type Capabilities, isRecord } from "../formats/capabilities.ts";
import type { Definition } from "../formats/catalog.ts";
import type { Manifest } from "../formats/manifest.ts";
import type { LanguageSchema } from "../schema.ts";
import { closed, field, reject } from "./checks.ts";
import { compileSchema, type SchemaCheck, type SchemaSink } from "./schema.ts";

const stateFields = new Set(["type", "key", "value"]);
const actionFields = new Set(["type", "name", "args", "bind", "bindAll"]);
type Carries = Definition["events"][string]["carries"];

function carriesFits(carries: Carries, type: string): boolean {
  return (
    typeof carries === "string" &&
    carries !== "none" &&
    (carries === type || (carries === "integer" && type === "number"))
  );
}

/** Bounds are checked on the completed value; this compares the event's scalar shape only. */
function objectFits(
  event: Extract<Carries, object>["object"],
  target: LanguageSchema,
  literals: Record<string, unknown> = {},
): boolean {
  if (target.type !== "object") return false;
  return (
    target.required.every((key) => Object.hasOwn(literals, key) || event.required.includes(key)) &&
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
): boolean {
  if (value.bindAll !== true || Object.hasOwn(value, "bind") || typeof carries !== "object")
    return reject(sink, "/bindAll", "bindAll: true on an object event, without bind");
  let valid = true;
  for (const key of Object.keys(carries.object.properties))
    if (Object.hasOwn(args, key)) valid = reject(sink, at("/args", key), "event properties omitted from literal args");
  if (!objectFits(carries.object, schema, args))
    valid = reject(sink, "/bindAll", "an event schema fitting the action arguments minus literal args");
  const check = compileSchema({
    ...schema,
    required: schema.required.filter((key) => !carries.object.required.includes(key)),
  });
  return field(check, args, sink, "args") && valid;
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
            type: property.type ?? "object",
            // The event supplies this property later; validate every other argument now.
            check: compileSchema({ ...schema, required: schema.required.filter((name) => name !== key) }),
          },
        ]),
      );
      return [name, { schema, check: compileSchema(schema), bindings }];
    }),
  );
  const stateExpected = `a declared state key: ${[...states.keys()].join(", ") || "none"}`;
  const actionExpected = `an action in the manifest: ${[...actions.keys()].join(", ") || "none"}`;

  function checkSetState(value: Record<string, unknown>, carries: Carries, sink: SchemaSink): boolean {
    let valid = closed(value, stateFields, sink);
    const state = typeof value.key === "string" && Object.hasOwn(value, "key") ? states.get(value.key) : undefined;
    if (!state) return reject(sink, "/key", stateExpected);
    if (Object.hasOwn(value, "value")) {
      if (!field(state.check, value.value, sink, "value")) valid = false;
    } else if (
      !(typeof carries === "object" ? objectFits(carries.object, state.schema) : carriesFits(carries, state.type))
    )
      valid = reject(sink, "/value", `an explicit ${state.type} value, or an event carrying ${state.type}`);
    return valid;
  }

  const bindExpected = (action: { bindings: Map<string, { type: string }> }, carries: Carries) => {
    const compatible = [...action.bindings]
      .filter(([, argument]) => carriesFits(carries, argument.type))
      .map(([key]) => key);
    return compatible.length
      ? `one of: ${compatible.join(", ")} (event carries ${carries})`
      : `omit bind: no compatible arguments (event carries ${carries})`;
  };

  function checkAction(value: Record<string, unknown>, carries: Carries, sink: SchemaSink): boolean {
    let valid = closed(value, actionFields, sink);
    const action = typeof value.name === "string" && Object.hasOwn(value, "name") ? actions.get(value.name) : undefined;
    if (!action) return reject(sink, "/name", actionExpected, "undeclared-action");
    if (!Object.hasOwn(value, "args") || !isRecord(value.args))
      return reject(sink, "/args", "an object of action arguments");
    let check = action.check;
    if (Object.hasOwn(value, "bindAll")) return checkBindAll(value, value.args, carries, action.schema, sink) && valid;
    if (Object.hasOwn(value, "bind")) {
      const bound = typeof value.bind === "string" ? value.bind : "";
      const binding = action.bindings.get(bound);
      if (!binding || !carriesFits(carries, binding.type)) return reject(sink, "/bind", bindExpected(action, carries));
      if (Object.hasOwn(value.args, bound))
        valid = reject(sink, at("/args", bound), "the bound argument omitted from args");
      check = binding.check;
    }
    if (!field(check, value.args, sink, "args")) valid = false;
    return valid;
  }

  return (carries) => (value, path, sink) => {
    if (!isRecord(value)) return reject(sink, path, "one setState or action intent");
    if (!Object.hasOwn(value, "type")) return reject(sink, "/type", "intent type setState or action");
    if (value.type === "setState") return checkSetState(value, carries, sink);
    if (value.type === "action") return checkAction(value, carries, sink);
    return reject(sink, "/type", "intent type setState or action");
  };
}
