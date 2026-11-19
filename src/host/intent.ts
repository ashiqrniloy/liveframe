import type { LiveframeError, Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { ActionStatus, Intent, IntentOrigin, Json, UiTree } from "../formats/tree.ts";
import { canonicalJson } from "../pack/hash.ts";
import { checkValue } from "../schema.ts";
import { loadPlacement, verifyPlacementInputs } from "../store/load.ts";
import { checkOffered } from "../validate/offered.ts";
import { findNode } from "../validate/patch.ts";
import { notifier } from "./events.ts";
import { cut, renderLoaded, renderPlacement } from "./render.ts";
import type { Actions, HostWiring, Installs, Served } from "./types.ts";

/** The most results one surface carries (spec §8); the oldest settled ones make room. */
const MAX_ACTIONS = 64;

/** What the host's operation reports. `value` is shown to the widget only when the action declares a `result` schema. */
export type DispatchResult =
  | { readonly ok: true; readonly value?: Json }
  | { readonly ok: false; readonly reason?: string };

export type IntentArgs<V> = HostWiring<V> & {
  /** The last accepted surface for the placement and scope the intent came from, as the host stored it. */
  readonly served: Served;
  readonly origin: IntentOrigin;
  readonly intent: Intent;
  /** Opaque to the library: handed to `authorize` and `dispatch` as given. */
  readonly viewer: V;
  readonly context: Json;
  /** The host's stored statuses; the call returns the next map. */
  readonly actions?: Actions;
  /** The host's policy for an action or a `setState` write: anything but `true` (including a throw) refuses it. */
  readonly authorize: (intent: Intent, viewer: V) => boolean | Promise<boolean>;
  /** The host's operation, run as the viewer after `checkOffered` and `authorize`. Wrap it with your own timeout. */
  readonly dispatch: (intent: Intent, viewer: V) => Promise<DispatchResult>;
  /** Push delivery of each rendered frame (`pending`, then the result). Without it no `pending` frame is rendered. */
  readonly publish?: (served: Served) => unknown;
};

export type Handled = { readonly served: Served; readonly actions: Actions };

/**
 * Result of `handleIntent`. Failures after a recorded action outcome or refusal carry `actions` so the host can
 * persist them while keeping its `served` frame unchanged; earlier failures carry no `actions`.
 */
export type HandleResult =
  | { readonly ok: true; readonly value: Handled }
  | { readonly ok: false; readonly errors: readonly LiveframeError[]; readonly actions?: Actions };

const refuse = (kind: LiveframeError["kind"], pointer: string, message: string): LiveframeError[] => [
  { kind, pointer, message },
];

/** Replace `key`, moving it last. */
const put = (actions: Actions, key: string, entry: ActionStatus): Actions =>
  Object.fromEntries([...Object.entries(actions).filter(([k]) => k !== key), [key, entry]]);

/** `put` within the bound: evict the oldest settled entries first, or `undefined` when every entry is pending. */
function admit(actions: Actions, key: string, entry: ActionStatus): Actions | undefined {
  const rest = Object.entries(actions).filter(([k]) => k !== key);
  while (rest.length >= MAX_ACTIONS) {
    const oldest = rest.findIndex(([, status]) => status.status !== "pending");
    if (oldest < 0) return undefined;
    rest.splice(oldest, 1);
  }
  return Object.fromEntries([...rest, [key, entry]]);
}

/** The action the origin node offers for this event, read from the host's own served tree. */
function offeredAction(tree: UiTree, origin: IntentOrigin): { name: string; key: string } | undefined {
  const node = findNode(tree, origin.nodeId);
  const offered = node?.events && Object.hasOwn(node.events, origin.event) ? node.events[origin.event] : undefined;
  return offered?.type === "action" ? { name: offered.name, key: offered.resultKey ?? offered.name } : undefined;
}

/** What the widget is told about a dispatch; the host's own error text never reaches it. */
function outcome(answer: unknown, name: string, install: Installs[string]): { status: ActionStatus; error?: true } {
  const failed = (reason: string) => ({
    status: { status: "failed", action: name, reason } as const,
    error: true as const,
  });
  if (answer === null || typeof answer !== "object") return failed("The action failed");
  const { ok, value, reason } = answer as Record<string, unknown>;
  if (ok === false) return failed(typeof reason === "string" ? cut(reason) : "The action failed");
  if (ok !== true) return failed("The action failed");
  const schema = install.capabilities.actions[name]?.result;
  if (!schema) return { status: { status: "ok", action: name } };
  return checkValue(schema, value).ok
    ? { status: { status: "ok", action: name, value: value as Json } }
    : failed("Invalid result");
}

type Reason = "stale" | "not-offered" | "unauthorized" | "invalid-state" | "limit" | "conflict";
type Notify = ReturnType<typeof notifier>;

/** Whether two status maps say the same thing; the order of their entries does not matter. */
function sameActions(a: Actions, b: Actions): boolean {
  try {
    return canonicalJson(a) === canonicalJson(b);
  } catch {
    return false;
  }
}

/** What the steps of one call share; built per call, never kept. */
type Run<V> = {
  readonly args: IntentArgs<V>;
  readonly install: Installs[string];
  readonly notify: Notify;
  readonly refused: (reason: Reason, errors?: readonly LiveframeError[]) => void;
  /** Render `actions` against `previous` (default: the served frame). */
  readonly render: (actions: Actions, previous?: Served) => Promise<Result<Served>>;
  /** Deliver a frame to a push host. A throw is contained: the effect has happened either way. */
  readonly send: (frame: Served) => Promise<void>;
  /** H8–H9. Render the next map, deliver it and answer. */
  readonly finish: (actions: Actions, previous?: Served) => Promise<HandleResult>;
  /** H8–H9 for a refusal: no effect ran, so a map that says what it said before has nothing new to show. */
  readonly finishRefusal: (actions: Actions) => Promise<HandleResult>;
};

function begin<V>(args: IntentArgs<V>, install: Installs[string], notify: Notify): Run<V> {
  const { served, publish } = args;
  const { placementId, scope } = served;
  const render = (actions: Actions, previous: Served = served) =>
    renderPlacement({
      ...args,
      placementId,
      catalogId: served.tree.catalogId,
      scope,
      surfaceId: served.tree.surfaceId,
      actions,
      previous,
    });
  const send = async (frame: Served) => {
    if (!publish) return;
    try {
      await publish(frame);
    } catch (error) {
      notify?.({ type: "publish-failed", placementId, ...(error instanceof Error ? { error: error.name } : {}) });
    }
  };
  const finish = async (actions: Actions, previous?: Served): Promise<HandleResult> => {
    const next = await render(actions, previous);
    if (!next.ok) return { ok: false, errors: next.errors, actions };
    await send(next.value);
    return { ok: true, value: { served: next.value, actions } };
  };
  return {
    args,
    install,
    notify,
    refused: (reason, errors) =>
      notify?.({ type: "intent-refused", placementId, reason, ...(errors ? { errors } : {}) }),
    render,
    send,
    finish,
    // A repeated refusal (a crafted or forbidden intent sent again) costs no store read, source read or render.
    finishRefusal: (actions) =>
      sameActions(args.actions ?? {}, actions)
        ? Promise.resolve({ ok: true, value: { served, actions } })
        : finish(actions),
  };
}

const tooManyPending = () => refuse("limit-exceeded", "/actions", "Too many pending actions");

/** H2, failure. A stale origin is refused as it is; an offered action is told to the widget as refused. */
function refuseOffered<V>(run: Run<V>, errors: readonly LiveframeError[]): Promise<HandleResult> | HandleResult {
  const { served, origin } = run.args;
  if (errors.some((error) => error.kind === "version-conflict")) {
    run.refused("stale", errors);
    return { ok: false, errors };
  }
  // Under the key the tree offered, never the posted one.
  const action = offeredAction(served.tree, origin);
  const recorded = action && admit(run.args.actions ?? {}, action.key, refusal(action.name, "Not accepted"));
  run.refused(action && !recorded ? "limit" : "not-offered", errors);
  if (!action) return { ok: false, errors };
  return recorded ? run.finishRefusal(recorded) : { ok: false, errors: tooManyPending() };
}

/** Attempts at a contended compare-and-set before `version-conflict` (spec §7.7). */
const STATE_ATTEMPTS = 4;

/** The stored state with the intent's key replaced, or `undefined` when it does not fit the manifest. */
function withKey(
  current: Json,
  intent: Extract<Intent, { type: "setState" }>,
  schema: WidgetPackage["manifest"]["state"],
): Json | undefined {
  if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
  const next = Object.fromEntries([...Object.entries(current), [intent.key, intent.value as Json]]);
  return checkValue(schema, next).ok ? next : undefined;
}

/** H3. Authorise, write the next state, then render it. */
async function applyState<V>(run: Run<V>, intent: Extract<Intent, { type: "setState" }>): Promise<HandleResult> {
  const { args, install } = run;
  const { placementId, scope } = args.served;
  // H3, first (law 4): a state write is an effect like any other. A refusal leaves everything as the host stored it.
  if (!(await authorized(args, intent))) {
    run.refused("unauthorized");
    return { ok: true, value: { served: args.served, actions: args.actions ?? {} } };
  }
  // H3a. The stored state, not the served one, is the base: another tab's committed write is kept. With
  // `putStateIf`, the raw stored value is read once here so the compare-and-set can expect exactly it.
  const { store } = args;
  const cas = typeof store.putStateIf === "function";
  let expected = cas ? await store.getState(placementId, scope) : undefined;
  const loaded = await loadPlacement(store, placementId, install, {
    scope,
    ...(cas ? { state: expected } : {}),
    ...(args.verified ? { verified: args.verified } : {}),
  });
  if (!loaded.ok) {
    run.notify?.({ type: "load-failed", placementId, errors: loaded.errors });
    return loaded;
  }
  const { package: pkg, params, libraries } = loaded.value;
  let base: typeof loaded.value = loaded.value;
  let next: Json;
  for (let attempt = 1; ; attempt++) {
    // H3b. Spec §8: check the whole next state against the manifest, even though the event's value was checked.
    const candidate = withKey(base.state, intent, pkg.manifest.state);
    if (!candidate) {
      const errors = refuse("invalid-prop", "/value", "State value rejected");
      run.refused("invalid-state", errors);
      return { ok: false, errors };
    }
    next = candidate;
    // H3c. The only write, after H2 and H3b. Without `putStateIf` the host serialises writers (spec §7.4).
    if (!cas) {
      await store.putState(placementId, scope, next);
      break;
    }
    if (await store.putStateIf?.(placementId, scope, expected, next)) break;
    if (attempt === STATE_ATTEMPTS) {
      const errors = refuse("version-conflict", "/state", "State changed concurrently");
      run.refused("conflict", errors);
      return { ok: false, errors };
    }
    // Another writer won: re-read, re-verify (reset or migrate as a load would) and re-apply the one key.
    expected = await store.getState(placementId, scope);
    const again = verifyPlacementInputs(pkg, { params, state: expected });
    if (!again.ok) return again;
    base = { package: pkg, ...again.value, ...(libraries ? { libraries } : {}) };
  }
  const actions = args.actions ?? {};
  const { served, ...rest } = args;
  const rendered = await renderLoaded(
    {
      ...rest,
      placementId,
      catalogId: served.tree.catalogId,
      scope,
      surfaceId: served.tree.surfaceId,
      actions,
      previous: served,
    },
    install,
    { ...base, state: next },
  );
  if (!rendered.ok) return rendered;
  await run.send(rendered.value);
  return { ok: true, value: { served: rendered.value, actions } };
}

/** H4. Only `true` passes; a policy that throws grants nothing. */
async function authorized<V>(args: IntentArgs<V>, intent: Intent): Promise<boolean> {
  try {
    return (await args.authorize(intent, args.viewer)) === true;
  } catch {
    return false;
  }
}

/** H6. Dispatch as the viewer. The host's error text and stack never reach the widget or the transport. */
async function dispatched<V>(run: Run<V>, intent: Extract<Intent, { type: "action" }>): Promise<ActionStatus> {
  const { placementId } = run.args.served;
  try {
    const result = outcome(await run.args.dispatch(intent, run.args.viewer), intent.name, run.install);
    if (result.error) run.notify?.({ type: "action-failed", placementId, action: intent.name });
    return result.status;
  } catch (error) {
    run.notify?.({
      type: "action-failed",
      placementId,
      action: intent.name,
      ...(error instanceof Error ? { error: error.name } : {}),
    });
    return outcome(undefined, intent.name, run.install).status;
  }
}

/** H4–H9 for an action. */
async function runAction<V>(run: Run<V>, intent: Extract<Intent, { type: "action" }>): Promise<HandleResult> {
  const key = intent.resultKey ?? intent.name;
  // H7, first: a surface with every slot pending runs nothing.
  const pending = admit(run.args.actions ?? {}, key, { status: "pending", action: intent.name });
  if (!pending) {
    const errors = tooManyPending();
    run.refused("limit", errors);
    return { ok: false, errors };
  }
  if (!(await authorized(run.args, intent))) {
    run.refused("unauthorized");
    return run.finishRefusal(put(pending, key, refusal(intent.name, "Not allowed")));
  }
  // H5. Pending, shown only to a host that can push it. A failed pending render is reported by the render itself.
  let latest = run.args.served;
  if (run.args.publish) {
    const frame = await run.render(pending);
    if (frame.ok) {
      latest = frame.value;
      await run.send(frame.value);
    }
  }
  // H6–H9. Dispatch, record, re-render against the latest frame, deliver, answer.
  return run.finish(put(pending, key, await dispatched(run, intent)), latest);
}

/**
 * Check an intent against the served tree, then persist state or authorise and dispatch an action, record the
 * result and re-render (spec §7.7, steps H1–H9). Nothing runs before `checkOffered` and `authorize` (law 4).
 * Stateless: the host serialises calls per placement and scope and stores the returned `served` and `actions`.
 */
export async function handleIntent<V>(args: IntentArgs<V>): Promise<HandleResult> {
  const { served, origin, intent, installs } = args;
  const notify = notifier(args.onEvent);

  // H1. The install the served tree was validated against.
  const catalogId = served.tree.catalogId;
  if (!Object.hasOwn(installs, catalogId)) {
    const errors = refuse("catalog-mismatch", "/catalogId", "Unknown catalog");
    notify?.({ type: "load-failed", placementId: served.placementId, errors });
    return { ok: false, errors };
  }
  const run = begin(args, installs[catalogId] as Installs[string], notify);

  // H2. Offered check (law 4): the intent must be exactly what the served tree offered, at its revision.
  const offered = checkOffered(served.tree, origin, intent, served.validator);
  if (!offered.ok) return refuseOffered(run, offered.errors);
  return intent.type === "setState" ? applyState(run, intent) : runAction(run, intent);
}

const refusal = (action: string, reason: string): ActionStatus => ({ status: "refused", action, reason });
