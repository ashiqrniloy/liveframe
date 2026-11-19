import type { LiveframeError, Result } from "../errors.ts";
import { at, isRecord } from "../formats/capabilities.ts";
import type { Definition } from "../formats/catalog.ts";
import { carriesValue } from "../formats/events.ts";
import { sameJson } from "../formats/json.ts";
import type { Intent, IntentOrigin, Json, UiTree } from "../formats/tree.ts";
import { type CompiledValidator, factsOf, UNKNOWN_VALIDATOR } from "./compile.ts";
import { complete } from "./complete.ts";
import { difference } from "./difference.ts";
import { findNode } from "./patch.ts";
import type { SchemaCheck } from "./schema.ts";

export type OfferedEvent = { carries: Definition["events"][string]["carries"]; check: SchemaCheck | undefined };
/**
 * Which validators have already accepted each served tree, so a repeated check skips the walk. This records
 * what a tree was validated by, not what a validator was compiled from (that is `factsOf` in `compile.ts`).
 */
const validated = new WeakMap<UiTree, WeakSet<CompiledValidator>>();

const failure = (kind: LiveframeError["kind"], pointer: string, message: string): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer, message }],
});

/** Check against the host's served, immutable tree and its compiled schema context. */
export function checkOffered(
  tree: UiTree,
  origin: IntentOrigin,
  intent: Intent,
  validator: CompiledValidator,
): Result<void> {
  if (!isRecord(origin) || origin.surfaceId !== tree.surfaceId)
    return failure("version-conflict", "/origin/surfaceId", "Origin surface differs from the served tree");
  if (origin.revision !== tree.revision)
    return failure("version-conflict", "/origin/revision", "Origin revision differs from the served tree");
  const checks = factsOf(validator)?.offered;
  if (!checks) return failure("invalid-prop", "/validator", UNKNOWN_VALIDATOR);
  if (!validated.get(tree)?.has(validator)) {
    const checked = validator.validateTree(tree);
    if (!checked.ok) return checked;
    const validators = validated.get(tree) ?? new WeakSet<CompiledValidator>();
    validators.add(validator);
    validated.set(tree, validators);
  }
  const node = findNode(tree, origin.nodeId);
  if (!node) return failure("not-found", "/origin/nodeId", "Unknown origin node");
  const offered = node.events && Object.hasOwn(node.events, origin.event) ? node.events[origin.event] : undefined;
  if (!offered) return failure("undeclared-event", "/origin/event", "Event was not offered by this node");
  if (!isRecord(intent)) return failure("invalid-prop", "", "Expected a completed intent");
  // A local write is the renderer's own (spec §8): no host dispatches it, so none is ever accepted.
  if (offered.type === "setLocal" || (intent as { readonly type?: unknown }).type === "setLocal")
    return {
      ok: false,
      errors: [
        {
          kind: "invalid-prop",
          pointer: "/type",
          expected: "a host-dispatchable intent",
          message: "Expected a host-dispatchable intent",
        },
      ],
    };
  if (intent.type !== offered.type)
    return failure("invalid-prop", "/type", "Intent type differs from the offered event");
  const field = offered.type === "setState" ? "key" : "name";
  const expectedTarget = offered.type === "setState" ? offered.key : offered.name;
  const actualTarget = intent.type === "setState" ? intent.key : intent.name;
  if (actualTarget !== expectedTarget)
    return failure("invalid-prop", at("", field), "Intent target differs from the offered event");
  for (const marker of ["bind", "bindAll", "local", "fromLocal"])
    if (Object.hasOwn(intent, marker)) return failure("invalid-prop", at("", marker), "Expected a completed intent");
  const errors: LiveframeError[] = [];
  if (!checks.intent(intent, "", { errors, maxErrors: 1 })) return { ok: false, errors };
  const event = checks.events.get(node.kind)?.get(origin.event);
  if (!event) return failure("undeclared-event", "/origin/event", "Unknown catalog event");
  return checkCompletion(offered, event, intent);
}

function extractActionFromLocal(
  fromLocal: Readonly<Record<string, string>>,
  args: Readonly<Record<string, Json>>,
): Result<Record<string, Json>> {
  const localProxy: Record<string, Json> = {};
  for (const [arg, localKey] of Object.entries(fromLocal)) {
    if (!Object.hasOwn(args, arg))
      return failure("invalid-prop", at("/args", arg), "Intent differs from the offered event");
    const actual = args[arg] as Json;
    if (Object.hasOwn(localProxy, localKey) && !sameJson(localProxy[localKey], actual))
      return failure("invalid-prop", at("/args", arg), "Intent differs from the offered event");
    localProxy[localKey] = actual;
  }
  return { ok: true, value: localProxy };
}

function eventFillsValue(offered: Intent): boolean {
  return offered.type === "setState"
    ? !Object.hasOwn(offered, "value") && offered.fromLocal === undefined
    : offered.bind !== undefined || Boolean(offered.bindAll);
}

function extractEventValue(
  offered: Intent,
  event: OfferedEvent,
  intent: Intent,
): { readonly value: Json | undefined; readonly pointer: string } {
  if (offered.type === "setState") {
    const value =
      offered.fromLocal === undefined && !Object.hasOwn(offered, "value") && intent.type === "setState"
        ? intent.value
        : undefined;
    return { value, pointer: "/value" };
  }
  if (intent.type === "action") {
    if (offered.bind !== undefined) return { value: intent.args[offered.bind], pointer: at("/args", offered.bind) };
    if (offered.bindAll && typeof event.carries === "object" && "object" in event.carries) {
      const properties = event.carries.object.properties;
      return {
        value: Object.fromEntries(Object.entries(intent.args).filter(([key]) => Object.hasOwn(properties, key))),
        pointer: "/args",
      };
    }
  }
  return { value: undefined, pointer: "/value" };
}

function checkCompletion(offered: Intent, event: OfferedEvent, intent: Intent): Result<void> {
  const errors: LiveframeError[] = [];
  const { value, pointer } = extractEventValue(offered, event, intent);
  let localProxy: Record<string, Json> | undefined;
  if (offered.type === "setState" && offered.fromLocal !== undefined) {
    if (intent.type === "setState" && Object.hasOwn(intent, "value"))
      localProxy = { [offered.fromLocal]: intent.value as Json };
  } else if (offered.type === "action" && intent.type === "action" && offered.fromLocal !== undefined) {
    const extracted = extractActionFromLocal(offered.fromLocal, intent.args);
    if (!extracted.ok) return extracted;
    localProxy = extracted.value;
  }
  const mismatch = difference(complete(offered, value, localProxy), intent);
  if (mismatch !== undefined) return failure("invalid-prop", mismatch, "Intent differs from the offered event");
  if (
    eventFillsValue(offered) &&
    !(event.check ? event.check(value, pointer, { errors, maxErrors: 1 }) : carriesValue(event.carries, value))
  )
    return errors.length
      ? { ok: false, errors }
      : failure("invalid-prop", pointer, "Filled value does not match the event schema");
  return { ok: true, value: undefined };
}
