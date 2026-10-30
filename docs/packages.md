# Packing, storing and running widgets

A widget package is an immutable module, manifest and set of scenarios. Pack it,
store it, place it, then load and render it on the app's backend. **Widget code
never runs in the browser (law 1): send only the validated UI tree to the page.**
`pack()`, `verifyPackage()` and `loadPlacement()` never execute widget code.

**Neither reference runner is a sandbox** ([security model](security.md)). In-process code can reach its host;
a worker bounds time and crashes without restricting what code can access. Run
only trusted code with these runners. For hostile code, the app supplies an
isolated `Runner` and uses it for both preview and production.

The package is pre-1.0. To preview drafts before publishing, see the
[preview guide](preview.md). Start with the
[SDK guide](sdk.md) for authoring and the [format guide](formats.md) for the
catalog, capabilities and manifest contracts.

See the [conformance guide](conformance.md) for store factories, persistence
checks and registration with Bun, Vitest or Jest.

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
await store.putState("home", "", scenario.state ?? pkg.manifest.initialState);

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

For a source using the optional [`sourceOutcome`](formats.md#optional-source-outcomes)
convention, expand a seed scenario before packing:

```ts
import { outcomeScenarios } from "@arnilo/liveframe/pack";

const expanded = outcomeScenarios(
  { name: "full", params: {}, context: {}, data: { queue: { status: "ok", value: [] } } },
  { source: "queue", manifest, capabilities },
);
if (!expanded.ok) throw new Error(JSON.stringify(expanded.errors));
// Pass expanded.value as the draft's scenarios to pack() or preview.update().
```

`source` is the manifest's local alias; `manifest` supplies its `sources` map,
and `capabilities` supplies the result schema. The helper returns
`Result<readonly Scenario[]>` in the order `ok`, `unauthorized`, `unavailable`,
`stale`, `failed`, named `full.ok`, `full.unauthorized`, and so on. It preserves
params, context, optional state and every other source. It reuses the seed's
validated `value` for `ok` and emits only `status` for each failure. The seed
must be a valid envelope containing a `value`, including when its status is a
failure; the helper does not invent a payload for arbitrary schemas.

Unknown aliases or capabilities return `unknown-name` at `/source`. A result
schema outside the helper's exact shape returns `invalid-document` there;
recognition survives JSON serialization. Invalid seed data and generated names
also return typed errors. Nothing is resolved or authorized, and expansion does
not replace `pack()`'s complete scenario checks or its 64-scenario limit.

Packing transpiles reachable TS/TSX files and links relative imports into one
ES module. Only `@arnilo/liveframe/sdk`, `/sdk/jsx-runtime` and
`/sdk/jsx-dev-runtime` may remain as imports. Non-SDK imports and re-exports,
`require`, dynamic imports and `import.meta` fail with `forbidden-import`;
syntax errors use `transpile-failed` with a file and line in the pointer.
Widget modules evaluate synchronously, so top-level `await` and `for await`
outside a function fail with `invalid-document` (`/files/entry.tsx/3`, expected
"a synchronous module: no top-level await"). A module that suspended there could
hold a runner forever, so the rule is checked at pack and again at verification
(`/code/3` for a linked package). Inside functions, `async` code is ordinary and
the renderer never waits for it.
Unresolved relative imports and cycles are rejected. Import/export bindings
are snapshots rather than live bindings; widgets must be pure. Linked code is
bounded to 1 MiB of UTF-8.

`validateScenario()` and `validateWidgetPackageShape()` check structure only.
Use `pack()` or `verifyPackage()` for manifest, scenario, import and hash checks.
Verification re-parses code and checks both rules even when the hash matches.

## Integrity, versions and rollback

The hash is `sha256-` followed by 64 lowercase hexadecimal digits. It covers
canonical JSON of `{ format, manifest, code, scenarios }`, excluding `hash`:
recursive UTF-16 key ordering, no whitespace, ECMAScript number serialization,
unchanged array order and Unicode, then UTF-8 and SHA-256. Non-JSON values,
non-finite numbers and lone surrogates are rejected. Repacking identical input
produces the same hash; changing a scenario also changes it. The package ships
language-neutral vectors under `conformance/hash/`: each accepted vector is
`{ value, canonical, sha256 }`, and the library's `hash-vectors.test.ts` runs it
through the canonicaliser and hash. RFC 8785 Appendix B's number table and the
rejected-input cases are pinned there for other implementations.

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
| `putPackage(pkg)` | `Promise<void>` | Preserve an existing same-hash package; reject a second hash for `(id, version)` with a `LiveframeFailure` (`version-conflict`). |
| `getPackage(id, version)` | `Promise<WidgetPackage \| undefined>` | Return the stored package, or `undefined` if absent. |
| `putPlacement(placement)` | `Promise<void>` | Store `{ id, slot, widget: { id, version }, params }` by id. |
| `getPlacement(id)` | `Promise<Placement \| undefined>` | Return one placement by key, or `undefined` if absent. Never lists. |
| `deletePlacement(id)` | `Promise<void>` | Remove the placement and its state in every scope. |
| `listPlacements()` | `Promise<Placement[]>` | Return placements sorted by id. |
| `putState(placementId, scope, state)` | `Promise<void>` | Store any JSON value, including `null`, for this placement and scope. |
| `getState(placementId, scope)` | `Promise<Json \| undefined>` | Read only this scope; distinguish absent state from JSON `null`. |
| `putStyle(style)` | `Promise<void>` | Store `{ kind, id, version, body }`; kind is `theme` or `designSystem`. |
| `getStyle(kind, id, version)` | `Promise<StyleRecord \| undefined>` | Return a style record, or `undefined` if absent. |

`memoryStore()` from `/store` implements this interface for ephemeral hosts and
tests. Both reference stores isolate stored records from caller mutation.
`fileStore(dir)` from `/store/fs` keeps one JSON file per record, writing a
same-directory temporary file and renaming it atomically. Temporary files are
ignored by listing. Record paths are `packages/<id>/<version>.json`,
`placements/<id>.json`, `states/<id>.json` (shared scope), `states/<id>/<scope>.json` (named scope) and
`styles/<kind>/<id>/<version>.json`. Path segments encode every UTF-8 byte except
lowercase ASCII letters, digits, `_` and `-` as `%XX`, preventing traversal and
case collisions. An id may be 128 code points, which can encode to more than the
255-byte `NAME_MAX` (128 CJK code points is 384 bytes), so a segment whose
encoded form exceeds 200 bytes is stored as `~` plus the lowercase SHA-256 hex of
its UTF-8 bytes — 65 bytes, and it cannot collide with an escaped name because
`~` is always escaped. Listing still takes each id from the record it reads, so
no name is ever decoded. This layout is part of the 0.1.x compatibility promise:
a store written by one release opens in the next. It assumes one writing process;
it is not a multi-process database or a transaction across records.

For your own database, implement `Store` with the same conflict, copy, missing
record and deletion rules. Enforce the package hash rule atomically in your
backend. Keep tenant scoping, authorization and active style selection in the
app. Stores persist records without validating their semantics; treat every
read as untrusted. `validatePlacement`, `validateState` and `validateStyleRecord`
are structural checks; validate installed themes/design systems separately.

State scopes are host-selected strings of at most 128 Unicode code points, with
no pattern; `""` means shared state. Invalid scopes reject with `LiveframeFailure`
carrying `invalid-document` at `/scope`. A custom store that cannot isolate a
scope must reject it rather than read or overwrite shared state. Scope strings
grant no authority. Deletion removes every scope, including orphan state.

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

`loadPlacement(store, id, { catalog, capabilities }, { scope?, state? })` reads that one placement
with `getPlacement()`, then checks its structure, package identity and integrity,
manifest and scenarios, params, and stored state. It never lists placements, so a
malformed sibling record cannot block a load; loading the malformed record itself
reports `invalid-document`.
The fourth argument is optional. The scope defaults to `""`; pass a host-selected
scope for viewer-specific state:

```ts
await store.putState("home", "viewer:42", { count: 4 });
const loaded = await loadPlacement(store, "home", options, { scope: "viewer:42" });
```

An own `state` property bypasses `getState` and uses the same validation and reset
rules. `{ state: undefined }` explicitly selects initial state without reading
stored state. For hosts that do not store state, import `verifyPlacementInputs`
from `/store` and call `verifyPlacementInputs(verifiedPackage, { params, state })`.
It returns `Result<{ params, state, reset? }>`; first verify the package with
`verifyPackage`. Invalid params reject; neither helper writes a reset back.

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
render path. Before loading anything they check that `pkg.hash` matches the
package's content, once per package object; a mismatch is `hash-mismatch` and
nothing is loaded. They do not validate the documents themselves, so still call
`verifyPackage` on received packages or use `loadPlacement` before running one.
Modules are cached by hash, and validators per catalog identity, capabilities
identity and hash, keeping the 64 most recently used. Replace configuration
objects when their contracts change.

- `inProcessRunner({ maxModules? })` uses a default 100 ms elapsed-time check. It
  reports `limit-exceeded` after slow code returns; it cannot interrupt an infinite loop.
  Loaded modules cannot be unloaded, so it bounds them: `stats().modules` reports
  the loader's process-wide module count, and once that reaches `maxModules`
  (default 256) a package whose hash is not loaded yet is refused with
  `limit-exceeded`, while loaded packages still render. A host with unbounded
  drafts should use the worker runner, which recycles its worker.
- `workerRunner({ timeoutMs?, maxPackages? })` serializes requests in one lazy
  worker, with a
  default 100 ms deadline including startup. Per-render `timeoutMs` overrides
  that default. The effective timeout also applies to module evaluation and rendering inside the worker.
  Timeout terminates the worker and returns `limit-exceeded`;
  crashes return `render-failed`. The next request starts a fresh worker.
  Inputs and trees cross by structured clone. Call `close()` to release it;
  active, queued and future requests then settle as `render-failed`.
  Every tree the worker returns is validated again on the host against the
  request's manifest, and only that request's id is accepted: a result with no
  pending render, the wrong id or a second answer for one id terminates the
  worker and fails the pending render with `render-failed`. A tree the host
  rejects returns the host validator's errors and starts a fresh worker. It
  restarts the worker once `maxPackages` distinct hashes have been loaded (64 by
  default), because loaded modules cannot be unloaded. One worker still serves
  every package, so a hostile widget can answer a later render with a tree valid
  for that render's manifest: run hostile drafts in your own isolated runner.

`limits` supports the SDK's node (5,000), depth (64) and UTF-8 tree byte
(1,048,576) defaults. Bad modules and non-function default exports are
`render-failed`; SDK validation failures pass through. Module evaluation is
raced against `timeoutMs`, so a hand-built package whose top-level await never
settles returns `limit-exceeded` (the worker runner terminates it instead). A
synchronous loop still cannot be interrupted. Reference runners use the SDK's
default error bound; `maxErrors` is not a `RunnerOptions` field.

The reference loader uses dot-escaped `data:` URLs and resolves only canonical
linker SDK headers from the library's own installation. Hand-written packages
with non-canonical SDK imports can pass verification but fail module loading;
use `pack()` output with the reference runners. Source-checkout behavior is
verified on Bun 1.4.2; published-build loader/worker resolution remains a
release gate. Browser-target bundle checks prove the host-free module boundary,
not permission to run widgets in a browser.

## Build a runner with the kit

`@arnilo/liveframe/runner-kit` is the in-sandbox half of a runner, for a host that
runs packages in its own sandbox. It has two pure functions and no host APIs; both
reference runners use them.

`linkPackage(code, resolve): Result<string>` prepares `pkg.code` for the sandbox's
module loader. `pack()` starts the code with one line per SDK specifier it uses,
exactly:

```js
import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
import * as __lf_sdk1 from "@arnilo/liveframe/sdk/jsx-runtime";
import * as __lf_sdk2 from "@arnilo/liveframe/sdk/jsx-dev-runtime";
```

The numbers count from 0 in order, the specifiers are those three, and each appears
at most once. `linkPackage` replaces each specifier with `resolve(specifier)` (a URL
or whatever specifier your isolate imports) and returns every other byte unchanged.
Code without such lines is returned as it is. A line that starts
`import * as __lf_sdk` but differs from the form above, skips a number or repeats a
specifier is an `invalid-document` error at `/code`. Only the header is examined, so
a hand-written import of the SDK further down is left bare for your loader to
reject.

```ts
const linked = linkPackage(pkg.code, (specifier) => `sandbox:${specifier}`);
```

`renderModule(widgetDefault, inputs, { catalog, capabilities, manifest, surfaceId,
revision, limits?, maxErrors? })` renders the module's default export once and
returns the same `Result<UiTree>` as the SDK's `render()`. It is synchronous and
caches the compiled validator, keyed by the manifest and bounded to the 64 most
recent manifests per catalog and capabilities pair. A widget that throws, or a
default export that is not a function, is `render-failed`. It does not time the
render; your sandbox does.

To show several scenarios of one package, pack once and render each scenario with
its own inputs: the module loads once and the validator is cached, so there is no
batch call to add. Validate each tree you receive on the host, whatever sandbox
produced it.

The kit is not an isolation boundary: it runs wherever you call it, with that
realm's authority, and it never belongs in the browser. Isolation is your sandbox's
job.

### Embed the single-file bundle

A sandbox with no module resolution (an isolate, a worker with an empty
`node_modules`, a build service's VM) can take the kit as one file instead:
`@arnilo/liveframe/runner-kit.bundle.js`, which is `dist/runner-kit.bundle.js` in the
installed package. It is one minified ES module (about 57 KB, 19 KB gzipped) that
contains the SDK, the validator, `renderModule` and `linkPackage`, and it imports
nothing: no dynamic `import()`, no `import.meta`, no relative or bare specifier and no
`node:` or `bun:` reference. The archive gate parses it to check that.

Its one namespace answers all three SDK specifiers, so link a package's header to the
bundle itself and load both as modules:

```js
// Node: node --experimental-vm-modules; any isolate with ES module support works alike.
const kit = new vm.SourceTextModule(bundleText, { identifier: "kit", context });
const linked = kit.namespace.linkPackage(pkg.code, () => "kit"); // after kit.evaluate()
const widget = new vm.SourceTextModule(linked.value, { identifier: "widget", context });
// Link widget's one request to kit, then evaluate. widget.namespace.default is the widget.
kit.namespace.renderModule(widget.namespace.default, inputs, { catalog, capabilities, manifest, surfaceId, revision });
```

Create the JSON inputs in the sandbox's realm: pass JSON text across the boundary
and call `JSON.parse` inside the context that loaded the bundle. In particular,
a manifest parsed outside that context is rejected as `invalid-document` at
`/manifest` with a message naming the other realm. Plain objects must use the
validator's own `Object.prototype` or a `null` prototype; matching the shape of
another realm's prototype does not make an object acceptable.

[`vm-bundle.mjs`](https://github.com/ashiqrniloy/liveframe/blob/main/scripts/release/fixtures/vm-bundle.mjs)
is the complete version, run by `runner-bundle.test.ts` on Node 26 in a fresh `vm`
context with no `process`, `require` or `Bun`, and it checks the tree against the
SDK's `render()`.

To snapshot an isolate, evaluate the bundle once, keep the module namespace, and call
`renderModule` per render; the validator cache lives in that namespace, so a snapshot
taken after a first render keeps the compiled validators. Pass the catalog,
capabilities and manifest as plain JSON created in the sandbox's realm each time.
The bundle is the same code the subpath ships, so it is as trusted as your sandbox
makes it: it is not an isolation boundary, and the host validates every tree it gets back.

### Validate without rendering

A host that only validates data can load
`@arnilo/liveframe/validator.bundle.js` (`dist/validator.bundle.js` in the archive).
It is one self-contained ES module with all the root exports, including
`compileValidator`, `checkOffered`, the install validators and recipe resolver.
It needs only ES2022 globals and has no SDK render path, `renderModule` or
`linkPackage`. Keep it separate from the runner kit in a validating isolate,
where widget code never runs.

```js
import * as lf from "@arnilo/liveframe/validator.bundle.js";
const validator = lf.compileValidator({ catalog, capabilities, manifest });
const checked = validator.validateTree(tree);
if (checked.ok) lf.checkOffered(checked.value, origin, intent, validator);
```

In a sandbox with no module resolution, load the bundle text as an ES module
and keep its namespace. Parse transported inputs with `JSON.parse` inside that
context so they belong to its realm.
[`vm-validator.mjs`](https://github.com/ashiqrniloy/liveframe/blob/main/scripts/release/fixtures/vm-validator.mjs)
shows the complete Node VM harness; the tests compare its corpus validation and
accepted/forged intent results with the root module in a bare context.

## Executable proof

[`phase-2-loop.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/phase-2-loop.test.ts) runs this guide's
code block verbatim with the agent-home fixture, then independently proves
reproducible packing, persistence through a fresh file store and parity with
direct SDK rendering through both runners. It covers every proof scenario,
version conflicts, tampering, malformed records, invalid params, reported state
resets, inert packing/loading and worker timeout recovery. No screenshot is
needed to verify this backend path.
