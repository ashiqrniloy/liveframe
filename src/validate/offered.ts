import type { LiveframeError, Result } from "../errors.ts";
import { at, isRecord } from "../formats/capabilities.ts";
import type { Definition } from "../formats/catalog.ts";
import { carriesValue } from "../formats/events.ts";
import type { Intent, IntentOrigin, Json, UiNode, UiTree } from "../formats/tree.ts";
import type { CompiledValidator } from "./compile.ts";
import { complete } from "./complete.ts";
import { difference } from "./difference.ts";
import type { SchemaCheck } from "./schema.ts";

type EventCheck = { carries: Definition["events"][string]["carries"]; check: SchemaCheck | undefined };
/** @internal Schema context stays attached to the explicit validator, never to transported JSON. */
export const offeredChecks = new WeakMap<
  CompiledValidator,
  {
    intent: SchemaCheck;
    events: ReadonlyMap<string, ReadonlyMap<string, EventCheck>>;
  }
>();
const indexes = new WeakMap<UiTree, Map<string, UiNode>>();
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
  const checks = offeredChecks.get(validator);
  if (!checks) return failure("invalid-prop", "/validator", "Expected a compiled validator");
  if (!validated.get(tree)?.has(validator)) {
    const checked = validator.validateTree(tree);
    if (!checked.ok) return checked;
    const validators = validated.get(tree) ?? new WeakSet<CompiledValidator>();
    validators.add(validator);
    validated.set(tree, validators);
  }
  let nodes = indexes.get(tree);
  if (!nodes) {
    const index = new Map<string, UiNode>();
    const visit = (node: UiNode) => {
      index.set(node.id, node);
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree.root);
    nodes = index;
    indexes.set(tree, nodes);
  }
  const node = nodes.get(origin.nodeId);
  if (!node) return failure("not-found", "/origin/nodeId", "Unknown origin node");
  const offered = node.events && Object.hasOwn(node.events, origin.event) ? node.events[origin.event] : undefined;
  if (!offered) return failure("undeclared-event", "/origin/event", "Event was not offered by this node");
  if (!isRecord(intent)) return failure("invalid-prop", "", "Expected a completed intent");
  if (intent.type !== offered.type)
    return failure("invalid-prop", "/type", "Intent type differs from the offered event");
  const field = offered.type === "setState" ? "key" : "name";
  const expectedTarget = offered.type === "setState" ? offered.key : offered.name;
  const actualTarget = intent.type === "setState" ? intent.key : intent.name;
  if (actualTarget !== expectedTarget)
    return failure("invalid-prop", at("", field), "Intent target differs from the offered event");
  for (const marker of ["bind", "bindAll"])
    if (Object.hasOwn(intent, marker)) return failure("invalid-prop", at("", marker), "Expected a completed intent");
  const errors: LiveframeError[] = [];
  if (!checks.intent(intent, "", { errors, maxErrors: 1 })) return { ok: false, errors };
  const event = checks.events.get(node.kind)?.get(origin.event);
  if (!event) return failure("undeclared-event", "/origin/event", "Unknown catalog event");
  return checkCompletion(offered, event, intent);
}

function checkCompletion(offered: Intent, event: EventCheck, intent: Intent): Result<void> {
  const errors: LiveframeError[] = [];
  let value: Json | undefined;
  let pointer = "/value";
  if (offered.type === "setState" && !Object.hasOwn(offered, "value"))
    value = intent.type === "setState" ? intent.value : undefined;
  else if (offered.type === "action" && intent.type === "action") {
    if (offered.bind !== undefined) {
      value = intent.args[offered.bind];
      pointer = at("/args", offered.bind);
    } else if (offered.bindAll && typeof event.carries === "object") {
      const properties = event.carries.object.properties;
      value = Object.fromEntries(Object.entries(intent.args).filter(([key]) => Object.hasOwn(properties, key)));
      pointer = "/args";
    }
  }
  const mismatch = difference(complete(offered, value), intent);
  if (mismatch !== undefined) return failure("invalid-prop", mismatch, "Intent differs from the offered event");
  const fills =
    offered.type === "setState" ? !Object.hasOwn(offered, "value") : offered.bind !== undefined || offered.bindAll;
  if (
    fills &&
    !(event.check ? event.check(value, pointer, { errors, maxErrors: 1 }) : carriesValue(event.carries, value))
  )
    return errors.length
      ? { ok: false, errors }
      : failure("invalid-prop", pointer, "Filled value does not match the event schema");
  return { ok: true, value: undefined };
}
