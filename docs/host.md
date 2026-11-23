# The host pipeline

A host that serves widgets at request time does the same things in the same order
every time: load the placement, read its data **as the viewer**, run the widget,
**validate the tree it returns**, and send the client what changed. Swapping two
of those steps breaks a law without failing a test, so `@arnilo/liveframe/host`
fixes the order and leaves everything else to you.

It is a function, not a framework. `renderPlacement` keeps no object, map, cache
or timer between calls; it is a function of its arguments and the effects you pass
in. The normative rules are [spec §7.7](spec.md#77-the-host-pipeline). `handleIntent`, below, is the
intent half, and `dependents` tells you which other placements an action affects.

## Wire it once

```ts
import { renderPlacement, type Served } from "@arnilo/liveframe/host";

// Built once, spread into every call. Nothing here is a service the library starts.
const host = {
  store,                       // a Store (memoryStore, fileStore or yours)
  runner,                      // your Runner: the sandbox is yours (spec §7.5)
  installs: { "acme.ui@1": { catalog, capabilities } },
  resolve,                     // (calls, viewer) => Promise<Record<alias, SourceResult>>
  verified: verifiedPackages(), // supply in production: a hit compares the stored record instead of re-verifying it
  onEvent: (event) => log(event.type, event),
};

const previous = servedByPlacement.get("tasks"); // what you stored last time, if anything
const result = await renderPlacement({
  ...host,
  placementId: "tasks",
  catalogId: "acme.ui@1",   // the catalog this client speaks; the manifest's own is checked against it
  scope: session.userId,    // the state scope
  viewer: session.user,     // opaque: handed to `resolve` as given
  context: { locale: "en" },
  previous,
});
if (result.ok && result.value !== previous) {
  servedByPlacement.set("tasks", result.value);
  send(client, result.value.patch ?? result.value.tree);
}
```

Supply `verified: verifiedPackages()` in production. Without it, every request
runs full `verifyPackage` (shape, Acorn parse, scenario checks and `packageHash`)
and hands a fresh package object to the runner, which hashes it again; with it, a
cache hit confirms the stored record equals the cached frozen package (`sameJson`)
and returns that same frozen object so the runner skips re-hashing too. On the
200 KiB `agent-home` code package (`bench/host.bench.ts`), supplying `verified`
with deeply frozen `catalog` and `capabilities` cuts `loadPlacement` from 12.1 ms
to 1.3 ms CPU (`fileStore`: 11.1 ms to 0.81 ms; Task 1 baseline under load 16:
27.1 ms / 15.8 ms) and a full `renderPlacement` from 29.7 ms to 7.9 ms (skipped:
2.9 ms), and on the 8 KB template package `loadPlacement` drops from 0.79 ms to
0.033 ms. Deeply freeze `catalog` and `capabilities` so the installation part of
the cache key is canonicalised once per pair rather than on every load.

`resolve` gets every source read of the render at once, so you can batch:

```ts
const resolve = async (calls, viewer) =>
  Object.fromEntries(
    await Promise.all(
      calls.map(async ({ alias, source, params }) => {
        if (!allowed(viewer, source)) return [alias, { ok: false, reason: "unauthorized" }];
        return [alias, { ok: true, value: await read(source, params, viewer) }];
      }),
    ),
  );
```

A value must fit the source's `result` schema. A failure (`unauthorized`,
`unavailable`, `stale` or `failed`, with an optional `message`) reaches the widget
as its `sourceOutcome` envelope, so it can draw "unavailable" instead of
crashing; a source that does not declare the envelope fails the render at
`/data/<alias>`. If `resolve` itself throws, every call counts as `failed` and
the error text is never copied. A source value with a lone surrogate raises
`source-failed` with reason `invalid-result` and uses the alias's `failed` envelope
when its schema accepts it. Without an envelope, the render returns `render-failed`
at `/data/<alias>`. A lone surrogate in the render's params, state or context
returns `render-failed` at that input's pointer.

## Answer a slow source with `pending`

A source declared with `sourceOutcome(result, { pending: true })` lets `resolve`
answer `{ ok: false, reason: "pending" }` instead of waiting. The widget sees
`{ status: "pending" }` and draws a placeholder for that region while the rest of
the surface renders. Start the read, and when it lands, render the readers again:

```ts
const cache = new Map<string, Json>();
const reading = new Map<string, Promise<void>>();

const resolve = async (calls, viewer) =>
  Object.fromEntries(
    calls.map(({ alias, source, params }) => {
      const key = `${source}:${canonicalJson(params)}`;
      if (cache.has(key)) return [alias, { ok: true, value: { status: "ok", value: cache.get(key) } }];
      if (!reading.has(key))
        reading.set(
          key,
          slowRead(source, params, viewer).then(async (value) => {
            cache.set(key, value);
            reading.delete(key);
            // The value landed: re-render whoever reads it and send each patch.
            for (const id of dependents([...servedByPlacement.values()], { source, params })) await rerender(id);
          }),
        );
      return [alias, { ok: false, reason: "pending" }];
    }),
  );
```

- **One status, no text.** A pending answer carries no `message`, and one that
  also carries a `value` counts as `failed`, so nothing but the status reaches
  the widget.
- **Declared sources only.** A source without the variant fails the render at
  `/data/<alias>`, as any undeclared failure does.
- **The next render is never skipped.** `{ status: "pending" }` and the resolved
  value give different `renderKey`s, so the render after the value lands runs
  and produces a patch.
- **It raises `source-pending`**, not `source-failed`.
- **The wait is yours.** The library adds no timer, queue or subscription: you
  choose when to read, how long to cache, and how the second frame reaches the
  client. `examples/demo-host/server.ts` streams it on the same response as the
  first frame (`tasks.digest`, `settle`).

## What a call returns

`Served` holds the validated `tree`, its `revision`, the `key` it was rendered
from, a `patch` against `previous` when one can be computed, the `state` it was
rendered from, and the `bound` source calls. Store it per placement and scope and
hand it back as `previous`.

- **Unchanged inputs are skipped.** When the `renderKey` of the new inputs equals
  `previous.key` (same surface, placement and scope), you get `previous` itself
  back unchanged, with a `render-skipped` event. No runner, validation or diff runs.
  The returned `previous` still carries the `patch` that produced it, so compare
  `result.value !== previous` and send nothing for a skipped render.
- **Send the patch only to a client that can take it.** `patch.base` is
  `previous.revision`. Send it to a client whose last accepted revision is
  `base`; send the whole `tree` to anyone else.
- **A revision floor.** If you can lose `previous` while a client stays connected
  (a restart), pass `revision: Date.now()` or a persisted counter on every call
  so the client does not ignore the first tree as stale (spec §11). With
  `previous` given, the revision is `max(revision ?? 0, previous.revision + 1)`,
  so a lagging floor never moves it backwards. A new page load needs nothing.
- **`validator` is process-local.** It is compiled for the package and install it
  was built from. Rebuild `Served` after a restart instead of persisting it.

## Handle an intent

`handleIntent` takes the `served` frame the intent came from and does, in this order:
`checkOffered`, then `authorize`, then the effect, for a state write as for an action. Nothing else can
reach your store or your operations.

```ts
const handled = await handleIntent({
  ...host,
  served,                     // exactly what you sent the client, at its revision
  origin, intent,             // what the client posted
  viewer: session.user,
  context: { locale: "en" },
  actions: actionsByPlacement.get("tasks"), // the statuses you stored last time
  authorize: (intent, viewer) => policy.allows(viewer, intent.name), // only `true` passes
  dispatch: async (intent, viewer) => {
    const task = await claim(intent.args.id, viewer);
    return { ok: true, value: { owner: task.owner } }; // or { ok: false, reason: "Taken" }
  },
  publish: (frame) => { // optional: push hosts only
    if (frame === servedByPlacement.get("tasks")) return;
    send(client, frame.patch ?? frame.tree);
    servedByPlacement.set("tasks", frame);
  },
});
if (handled.ok) {
  servedByPlacement.set("tasks", handled.value.served);
  actionsByPlacement.set("tasks", handled.value.actions);
} else if (handled.actions) {
  actionsByPlacement.set("tasks", handled.actions);
}
```

- **A stale intent is refused, never rewritten.** An origin from another revision is a
  `version-conflict`; refetch the surface. Nothing was written.
- **`setState`** asks `authorize` first (a viewer who may not write gets the `served` frame back, nothing
  loaded or written, and an `intent-refused` event), then re-checks `{ ...storedState, [key]: value }` against
  the manifest (`invalid-prop` at `/value`), writes it, and renders it. With a store that implements
  `putStateIf`, the write is a compare-and-set against the state it read: when another writer got there
  first, it re-reads, re-applies the one key and tries again, at most four attempts, then returns
  `version-conflict` at `/state` with an `intent-refused` (`conflict`) event. Without the method it writes
  with `store.putState`, and two concurrent writes to one placement and scope can lose one of them. `setLocal`
  never reaches the host. Your `authorize` therefore sees both `action` and `setState` intents.
- **`authorize` fails closed.** `false`, a throw or a rejection records `refused` (`"Not allowed"`) for an
  action and runs nothing. Your policy's error text is never copied. The same refusal sent again, with the
  `actions` you stored, costs no store read, source read or render.
- **`dispatch`** runs as the viewer. A throw becomes `failed` with the fixed reason
  `"The action failed"`. A `value` reaches the widget only when the action's capability declares a `result`
  schema and the value fits it; otherwise it is dropped (or, when it does not fit, the action is `failed`).
  Add your own timeout around `dispatch`.
- **Pending needs a `publish`.** With `publish`, the widget first gets a `pending` frame; without it nobody
  could see one, so none is rendered. A request/response host uses the returned `served`; a push host uses
  `publish`. Use one or the other to avoid sending a frame twice.
- **An offered action that fails the check** (changed arguments, a forged `resultKey`, or a `bind` / `fromLocal` value outside the capability's `args` schema) is recorded
  `refused` under the key *your tree* offered, and the surface re-renders. If that key already has a recorded
  status, the call returns the supplied frame and actions without rendering.
- **At most 64 results.** The oldest settled ones make room; if all 64 are `pending`, the call fails with
  `limit-exceeded` at `/actions` before `authorize` or `dispatch`. You decide when an entry expires by leaving
  it out of the next `actions`.
- **If the re-render fails** the call returns its errors (`ok: false`) and, when an action outcome or
  refusal was recorded, the updated `actions` alongside them (`handled.actions`); store `actions` so the
  outcome is not lost, and leave `served` unchanged.

## Coordinate placements

One widget's action can change what another widget shows (select a task in a list, and the detail
panel follows), with no widget-to-widget channel. Declare the shared data as a capability: a
`selection.current` **source** and a `selection.select` **action**. Both placements bind the source in their
manifests; the list offers the action. Your `dispatch` stores the selection; the detail widget reads it
through `resolve`, as the viewer, like any other source.

`dependents` answers the one question the library can: which placements read this source?

```ts
import { dependents, handleIntent, renderPlacement } from "@arnilo/liveframe/host";

const handled = await handleIntent({ ...host, served: servedByPlacement.get("list"), /* … */ });
if (handled.ok) {
  servedByPlacement.set("list", handled.value.served);
  // The action changed `selection.current`: re-render whoever reads it.
  const readers = [...servedByPlacement.values()]; // each Served carries `placementId` and `bound`
  for (const id of dependents(readers, { source: "selection.current" })) {
    const previous = servedByPlacement.get(id);
    const next = await renderPlacement({ ...host, placementId: id, catalogId, viewer, context, previous });
    if (next.ok && next.value !== previous) {
      servedByPlacement.set(id, next.value);
      send(id, next.value.patch ?? next.value.tree);
    }
  }
}
```

- **`change.params` narrows the match.** `{ source: "task.read", params: { id: "7" } }` matches only
  placements whose bound call has equal params (canonical JSON: key order does not matter). Leave
  `params` out to match every use of the source.
- **It is a pure scan.** One pass over the `bound` entries each `Served` already holds (`Served.bound`), in
  input order, each id once: about 0.06 ms for 1,000 placements. There is no registry or subscription;
  you decide when to call it (after an action settles, on a message from your own bus) and what to do with
  the ids. Serialise the re-renders per placement like any other call.
- **Authority does not move.** The widgets still only read and offer what their manifests declare, and
  `resolve`, `authorize` and `dispatch` are yours. A skipped render (unchanged `renderKey`) makes
  re-rendering a placement that did not really change cheap.

## What stays yours

The library never holds these, on purpose:

- **Concurrency.** Serialise calls per placement and scope. A stateless function
  cannot tell two callers holding the same stale `previous` apart. In a host with
  several processes, give your `Store` an atomic `putStateIf` (a conditional
  update in your database): then concurrent `setState` calls keep each other's
  keys. A store without it is safe only when one process writes each placement's
  state, which is what `fileStore()` assumes.
- **Double submits.** Nothing stops the same action arriving twice, and `pending` is visible only to a push
  host. Make `dispatch` idempotent or de-duplicate on your side (a claim that is already taken answers
  `{ ok: false, reason: "Taken" }`).
- **`served` is trusted.** `handleIntent` checks an intent against the frame you hand back and, for an
  action, reads no store before `authorize`. When you replace, delete or disable a placement, drop its
  `served` (and revoke what it offered) so a stale tab cannot act on the old tree.
- **Read de-duplication.** Wrap `resolve` with a per-request memo if several
  placements read the same source.
- **Transport, sessions, identity, tenancy, approval.**
- **Caching beyond `renderKey`.** A `verified` cache hit still reads the stored
  records and compares the package record with the cached frozen copy; for a very
  hot path, cache the `Served`.

## Events

`onEvent` receives frozen objects: `render-skipped`, `state-reset`, `state-migrated`, `source-failed`
(with `reason` `unauthorized`, `unavailable`, `stale`, `failed` or `invalid-result`), `source-pending`,
`tree-rejected`, `load-failed` and `render-failed`, and from `handleIntent` `intent-refused`
(with `reason` `stale`, `not-offered`, `unauthorized`, `invalid-state`, `limit` or `conflict`),
`action-failed` and `publish-failed`. They carry ids, kinds, reasons
and `LiveframeError`s, never state, params, source data or the viewer. A handler
that throws or rejects is contained, and nothing is built when you pass none.
Ignore a `type` you do not know: the set may grow in a minor release.
