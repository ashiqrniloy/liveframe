# Packing, storing and running widgets

A widget package is an immutable module, manifest and set of scenarios. Pack it,
store it, place it, then load and render it on the app's backend. **Widget code
never runs in the browser (law 1): send only the validated UI tree to the page.**
`pack()`, `verifyPackage()` and `loadPlacement()` never execute widget code.

**Neither reference runner is a sandbox.** In-process code can reach its host;
a worker bounds time and crashes without restricting what code can access. Run
only trusted code with these runners. For hostile code, the app supplies an
isolated `Runner` and uses it for both preview and production.

The package is pre-release. To preview drafts before publishing, see the
[preview guide](preview.md). Start with the
[SDK guide](sdk.md) for authoring and the [format guide](formats.md) for the
catalog, capabilities and manifest contracts.

## Pack a draft and render a stored placement

This backend example expects three host-provided values:

- `draft`: `{ files, entry, manifest, scenarios }`. `files` maps relative names
  to source strings, including the generated primitives; `entry` names a file
  with a default widget export. The manifest declares the widget's id, version,
  schemas, data bindings and allowed actions.
- `options`: `{ catalog, capabilities, surfaceId, revision }`. Use installed,
  validated catalog and capabilities documents, a nonempty surface id and a
  nonnegative integer revision.
- `dir`: the directory for this host's persistent records, with one writing
  process. Use a separate directory per tenant if the app has multiple tenants.

The example stores a scenario's inputs to demonstrate a reload. In production,
the app resolves data and context as the current viewer; scenario data grants
no authority.

```ts
import type { Result } from "@arnilo/liveframe";
import { pack, verifyPackage } from "@arnilo/liveframe/pack";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { loadPlacement } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const pkg = value(pack(draft, options));
value(verifyPackage(pkg, options)); // Also verifies packages received from elsewhere.
const scenario = pkg.scenarios[0];
if (!scenario) throw new Error("A package needs a scenario");
const store = fileStore(dir);
await store.putPackage(pkg);
await store.putPlacement({
  id: "home",
  slot: "home.main",
  widget: { id: pkg.manifest.id, version: pkg.manifest.version },
  params: scenario.params,
});
await store.putState("home", scenario.state ?? pkg.manifest.initialState);

const loaded = value(await loadPlacement(fileStore(dir), "home", options));
const inputs = {
  params: loaded.params,
  state: loaded.state,
  context: scenario.context,
  data: scenario.data,
};
const tree = value(await inProcessRunner().render(loaded.package, inputs, options));
// Send tree to the browser through the app's transport.
const worker = workerRunner();
try {
  const workerTree = value(await worker.render(loaded.package, inputs, options));
  if (JSON.stringify(workerTree) !== JSON.stringify(tree)) throw new Error("Runner trees differ");
} finally {
  worker.close();
}
```

`pack()` and `verifyPackage()` are synchronous and return
`Result<WidgetPackage>`. `loadPlacement()` and `Runner.render()` return promises
of results. Handle `{ ok: false, errors }` before using `value`: errors carry
`kind`, `pointer` and `message`, with at most 20 package/load errors. The helper
above throws to stop this example; an app can display pointed errors instead.
Store writes and reads return promises and can reject; handle storage failures
at the app's boundary as well. `loadPlacement` converts malformed-record errors
to results but lets other I/O failures reject.

## Scenarios and import rules

A package requires 1–64 scenarios, each with a unique, nonempty name of at most
128 Unicode code points, `params`, `context`, `data`, and optional `state`.
Omitting state uses the manifest's initial state. Params, state and context
must fit their manifest schemas; data must contain exactly the manifest's source
keys and fit the capabilities' source result schemas. Packing checks scenarios
without rendering them. Render each scenario separately to check its UI.

Packing transpiles reachable TS/TSX files and links relative imports into one
ES module. Only `@arnilo/liveframe/sdk`, `/sdk/jsx-runtime` and
`/sdk/jsx-dev-runtime` may remain as imports. Non-SDK imports and re-exports,
`require`, dynamic imports and `import.meta` fail with `forbidden-import`;
syntax errors use `transpile-failed` with a file and line in the pointer.
Unresolved relative imports and cycles are rejected. Import/export bindings
are snapshots rather than live bindings; widgets must be pure. Linked code is
bounded to 1 MiB of UTF-8.

`validateScenario()` and `validateWidgetPackageShape()` check structure only.
Use `pack()` or `verifyPackage()` for manifest, scenario, import and hash checks.
Verification re-parses code and checks the import rule even when the hash matches.

## Integrity, versions and rollback

The hash is `sha256-` followed by 64 lowercase hexadecimal digits. It covers
canonical JSON of `{ format, manifest, code, scenarios }`, excluding `hash`:
recursive UTF-16 key ordering, no whitespace, ECMAScript number serialization,
unchanged array order and Unicode, then UTF-8 and SHA-256. Non-JSON values,
non-finite numbers and lone surrogates are rejected. Repacking identical input
produces the same hash; changing a scenario also changes it.

**A hash checks integrity, not signatures, origin or approval.** Anyone who
changes content can calculate a new hash. The app owns provenance, review and
authorization; import restrictions do not isolate executable code.

An `(id, version)` names exactly one hash. A same-hash `putPackage` is a no-op;
a different hash under the same pair rejects with `version-conflict`. Give
changed content a new version. To roll back, update the placement's `widget`
reference to a stored older version. Loading checks that the returned package
identity matches that reference. A rollback may reset incompatible state just
as an upgrade can.

## Stores and custom implementations

Import `Store`, `Placement` and `StyleRecord` as types from
`@arnilo/liveframe/store`; import `WidgetPackage` from `/pack` and `Json` from
`/sdk`. A store holds one host-defined scope and implements these async methods:

| Method | Result | Contract |
| --- | --- | --- |
| `putPackage(pkg)` | `Promise<void>` | Preserve an existing same-hash package; reject a second hash for `(id, version)`. |
| `getPackage(id, version)` | `Promise<WidgetPackage \| undefined>` | Return the stored package, or `undefined` if absent. |
| `putPlacement(placement)` | `Promise<void>` | Store `{ id, slot, widget: { id, version }, params }` by id. |
| `deletePlacement(id)` | `Promise<void>` | Remove both placement and its state. |
| `listPlacements()` | `Promise<Placement[]>` | Return placements sorted by id. |
| `putState(placementId, state)` | `Promise<void>` | Store any JSON value, including `null`. |
| `getState(placementId)` | `Promise<Json \| undefined>` | Distinguish absent state from JSON `null`. |
| `putStyle(style)` | `Promise<void>` | Store `{ kind, id, version, body }`; kind is `theme` or `designSystem`. |
| `getStyle(kind, id, version)` | `Promise<StyleRecord \| undefined>` | Return a style record, or `undefined` if absent. |

`memoryStore()` from `/store` implements this interface for ephemeral hosts and
tests. Both reference stores isolate stored records from caller mutation.
`fileStore(dir)` from `/store/fs` keeps one JSON file per record, writing a
same-directory temporary file and renaming it atomically. Temporary files are
ignored by listing. Record paths are `packages/<id>/<version>.json`,
`placements/<id>.json`, `states/<id>.json` and
`styles/<kind>/<id>/<version>.json`. Path segments encode every UTF-8 byte except
lowercase ASCII letters, digits, `_` and `-` as `%XX`, preventing traversal and
case collisions. It assumes one writing process; it is not a multi-process
database or a transaction across records.

For your own database, implement `Store` with the same conflict, copy, missing
record and deletion rules. Enforce the package hash rule atomically in your
backend. Keep tenant scoping, authorization and active style selection in the
app. Stores persist records without validating their semantics; treat every
read as untrusted. `validatePlacement`, `validateState` and `validateStyleRecord`
are structural checks; validate installed themes/design systems separately.
Run the public store suite against a fresh, empty scope for each case:

```ts
import { storeSuite } from "@arnilo/liveframe/conformance";

for (const c of storeSuite({ create: () => myStoreInNewScope() }))
  test(c.name, c.run, c.timeout);
```

For persistent stores, supply `reopen(store)` to open the same scope again and
check persistence. The suite returns runner-independent cases; failures are
`ConformanceFailure` errors with `rule`, `spec` and bounded `details`.

## Loading and state resets

`loadPlacement(store, id, { catalog, capabilities })` checks placement structure,
package identity and integrity, manifest and scenarios, params, and stored state.
It returns `{ package, params, state, reset? }` inside a successful result:

- Missing state uses `manifest.initialState`, without `reset`.
- Invalid or incompatible state uses initial state and includes the bounded
  validation errors in `reset`. Inspect and report that field to the user.
- The loader never writes the reset back. The app decides whether to persist
  the returned state with `putState`.
- A missing placement/package is `not-found`; invalid params are `invalid-prop`;
  malformed records are `invalid-document`; changed hashed content is
  `hash-mismatch`. Other verification failures pass through without fallback.

Loading does not resolve production data or context; the host supplies those
inputs for each render. Loading also does not execute the package.

## Runner limits and ownership

`Runner` and `RunnerOptions` are types from `/preview`. A custom runner implements
`render(pkg, inputs, options): Promise<Result<UiTree>>`, where inputs are the SDK's
`WidgetProps` (`params`, `state`, `data`, `context`). Options require `catalog`,
`capabilities`, `surfaceId` and `revision`, with optional `limits` and `timeoutMs`.

Reference runners compile and cache validators, then use the SDK's validated
render path. They **do not verify packages**: call `verifyPackage` on received
packages or use `loadPlacement` before running one. In-process modules are cached
by hash, and validators by catalog identity, capabilities identity and hash.
Replace configuration objects when their contracts change.

- `inProcessRunner()` uses a default 100 ms elapsed-time check. It reports
  `limit-exceeded` after slow code returns; it cannot interrupt an infinite loop.
- `workerRunner({ timeoutMs? })` serializes requests in one lazy worker, with a
  default 100 ms deadline including startup. Per-render `timeoutMs` overrides
  that default. Timeout terminates the worker and returns `limit-exceeded`;
  crashes return `render-failed`. The next request starts a fresh worker.
  Inputs and trees cross by structured clone. Call `close()` to release it;
  active, queued and future requests then settle as `render-failed`.

`limits` supports the SDK's node (5,000), depth (64) and UTF-8 tree byte
(1,048,576) defaults. Bad modules and non-function default exports are
`render-failed`; SDK validation failures pass through. Reference runners use
the SDK's default error bound; `maxErrors` is not a `RunnerOptions` field.

The reference loader uses dot-escaped `data:` URLs and resolves only canonical
linker SDK headers from the library's own installation. Hand-written packages
with non-canonical SDK imports can pass verification but fail module loading;
use `pack()` output with the reference runners. Source-checkout behavior is
verified on Bun 1.4.2; published-build loader/worker resolution remains a
release gate. Browser-target bundle checks prove the host-free module boundary,
not permission to run widgets in a browser.

## Executable proof

[`phase-2-loop.test.ts`](../src/__tests__/phase-2-loop.test.ts) runs this guide's
code block verbatim with the agent-home fixture, then independently proves
reproducible packing, persistence through a fresh file store and parity with
direct SDK rendering through both runners. It covers every proof scenario,
version conflicts, tampering, malformed records, invalid params, reported state
resets, inert packing/loading and worker timeout recovery. No screenshot is
needed to verify this backend path.
