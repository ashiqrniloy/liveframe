# The host pipeline

A host that serves widgets at request time does the same things in the same order
every time: load the placement, read its data **as the viewer**, run the widget,
**validate the tree it returns**, and send the client what changed. Swapping two
of those steps breaks a law without failing a test, so `@arnilo/liveframe/host`
fixes the order and leaves everything else to you.

It is a function, not a framework. `renderPlacement` keeps no object, map, cache
or timer between calls; it is a function of its arguments and the effects you pass
in. The normative rules are [spec §7.7](spec.md#77-the-host-pipeline).

## Wire it once

```ts
import { renderPlacement, type Served } from "@arnilo/liveframe/host";

// Built once, spread into every call. Nothing here is a service the library starts.
const host = {
  store,                       // a Store (memoryStore, fileStore or yours)
  runner,                      // your Runner: the sandbox is yours (spec §7.5)
  installs: { "acme.ui@1": { catalog, capabilities } },
  resolve,                     // (calls, viewer) => Promise<Record<alias, SourceResult>>
  verified: verifiedPackages(), // optional: skips re-verifying the same package
  onEvent: (event) => log(event.type, event),
};

const result = await renderPlacement({
  ...host,
  placementId: "tasks",
  catalogId: "acme.ui@1",   // the catalog this client speaks; the manifest's own is checked against it
  scope: session.userId,    // the state scope
  viewer: session.user,     // opaque: handed to `resolve` as given
  context: { locale: "en" },
  previous: servedByPlacement.get("tasks"), // what you stored last time, if anything
});
if (result.ok) {
  servedByPlacement.set("tasks", result.value);
  send(client, result.value.patch ?? result.value.tree);
}
```

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
the error text is never copied.

## What a call returns

`Served` holds the validated `tree`, its `revision`, the `key` it was rendered
from, a `patch` against `previous` when one can be computed, the `state` it was
rendered from, and the `bound` source calls. Store it per placement and scope and
hand it back as `previous`.

- **Unchanged inputs are skipped.** When the `renderKey` of the new inputs equals
  `previous.key` (same surface, placement and scope), you get `previous` back
  unchanged, with a `render-skipped` event. No runner, validation or diff runs.
- **Send the patch only to a client that can take it.** `patch.base` is
  `previous.revision`. Send it to a client whose last accepted revision is
  `base`; send the whole `tree` to anyone else.
- **A revision floor.** If you can lose `previous` while a client stays connected
  (a restart), pass `revision: Date.now()` or a persisted counter so the client
  does not ignore the first tree as stale (spec §11). A new page load needs
  nothing.
- **`validator` is process-local.** It is compiled for the package and install it
  was built from. Rebuild `Served` after a restart instead of persisting it.

## What stays yours

The library never holds these, on purpose:

- **Concurrency.** Serialise calls per placement and scope. A stateless function
  cannot tell two callers holding the same stale `previous` apart.
- **Read de-duplication.** Wrap `resolve` with a per-request memo if several
  placements read the same source.
- **Transport, sessions, identity, tenancy, approval.**
- **Caching beyond `renderKey`.** Note that `loadPlacement` still re-hashes the
  package on a `verified` cache hit; for a very hot path, cache the `Served`.

## Events

`onEvent` receives frozen objects: `render-skipped`, `state-reset`, `source-failed`
(with `reason` `unauthorized`, `unavailable`, `stale`, `failed` or `invalid-result`),
`tree-rejected`, `load-failed` and `render-failed`. They carry ids, kinds, reasons
and `LiveframeError`s, never state, params, source data or the viewer. A handler
that throws or rejects is contained, and nothing is built when you pass none.
Ignore a `type` you do not know: the set may grow in a minor release.
