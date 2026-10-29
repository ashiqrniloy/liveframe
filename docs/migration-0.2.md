# Migrating to 0.2.0

0.2.0 is a minor release under the [compatibility policy](compatibility.md): it breaks three things on purpose and adds everything else. Each break has one fix, below. If your app uses none of the three, nothing changes for you.

What the release adds is not a migration: it is new optional fields, new exports and one new conformance corpus. [`adopters-0.2.md`](adopters-0.2.md) maps each adopter request to the shipped API and names its limitation, and [`../CHANGELOG.md`](../CHANGELOG.md) lists the release. The normative behaviour stays in the [spec](spec.md).

## 1. State is keyed by placement and scope

**Why.** A placement is often shared — an organisation's page, a module in a window — while filter, selection and cursor belong to one viewer or session. 0.1.0 keyed state by placement id only, so a host either duplicated placements per viewer or re-implemented `loadPlacement`'s verification.

**Before → after.** Both `Store` state methods take a scope. `""` is the shared state.

| 0.1.0 | 0.2.0 |
| --- | --- |
| `store.putState(placementId, state)` | `store.putState(placementId, scope, state)` |
| `store.getState(placementId)` | `store.getState(placementId, scope)` |
| `loadPlacement(store, id, options)` | `loadPlacement(store, id, options, { scope })` |

Omit `scope` on `loadPlacement` and it reads `""`, as 0.1.0 did. `deletePlacement` removes every scope.

```ts
export async function scopedState(store: Store, placement: Placement, state: Json) {
  await store.putPlacement(placement);
  await store.putState(placement.id, "", state); // shared by every viewer
  await store.putState(placement.id, "viewer-7", state); // one viewer's own state
  const shared = await store.getState(placement.id, "");
  const mine = await store.getState(placement.id, "viewer-7");
  await store.deletePlacement(placement.id); // removes every scope
  return { shared, mine, afterDelete: await store.getState(placement.id, "viewer-7") };
}
```

**Your store.** A custom `Store` must take the scope on both state methods and reject a scope that is not a string of at most 128 Unicode code points, with `invalid-document` at `/scope`. Do not fall back to shared state when a scope is unsupported: a silent fallback shows one viewer another's state.

**Your files.** `fileStore` reads a 0.1.0 directory as it is: `states/<id>.json` is shared scope `""`, and a named scope is a file under `states/<id>/`. Nothing is rewritten on upgrade. A rollback to 0.1.0 keeps shared state and loses named scopes, so stop scoped writes before rolling back.

**No store at all?** `verifyPlacementInputs(pkg, { params, state })` applies the same checks without reading a store, including the reported reset.

## 2. `<Preview>` never guesses which scenario it shows

**Why.** 0.1.0 labelled the first `result` with the scenario the URL named. When the host had rendered another scenario first, the preview recorded that tree as the wrong scenario's result, and its "last good render" map was keyed wrongly. It also read and wrote `scenario`, `width`, `theme` and `designSystem` on every mount, so two previews on one page fought over the same keys.

**Before → after.** The label is now a prop, and URL ownership is a choice.

| 0.1.0 | 0.2.0 |
| --- | --- |
| `result={tree}` | `result={tree} resultScenario="ready"` |
| always reads and writes `window.location.search` | the same, unless `selection` is supplied |
| one preview per page | `urlKey="left"` per preview |
| — | `selection={cell}` with `onSelect` makes it controlled |

`resultScenario` is required. The component trusts no other source for that label, and capture addresses a keyed page through `<urlKey>.scenario`.

**Controlled mode.** Pass `selection` and `onSelect` when the app owns its URL or uses an in-memory router: the component then neither reads nor writes the location. Keep passing `result` for the scenario in `selection`; other scenarios' results arrive as the user selects them.

## 3. Capture is a library function, with a backend you choose

**Why.** `liveframe preview capture` and the MCP `capture_preview` tool drove headless Chromium internally, so an app whose webview is WebKit or WebView2 could not capture what its users see.

**Before → after.** Import `capture` from `@arnilo/liveframe/preview/capture` and give it a backend. `playwrightBackend(playwright)` is the one shipped; any engine can implement `CaptureBackend`.

```ts
export async function captureOnce(url: string, backend: CaptureBackend) {
  const { index, files } = await capture(url, { backend, scenarios: ["ready"] });
  return { index, files };
}
```

It returns an in-memory file map, so the caller owns persistence. Importing the subpath loads no browser driver. The CLI and MCP tools keep their behaviour: they use the Playwright backend by default. A backend that cannot produce an accessibility snapshot returns `null`, and `index.json` says so.

## 4. Everything else is additive

New optional fields (schema keywords, `semantics` values, an event's `carries: "number"` or object form, manifest `description` and `meta`, capability `meta` and `irreversible`, `contrast` pair declarations, scrollbar and placeholder recipe properties, `minHeight`/`maxHeight`), new exports (`/sdk/gen`, `/authoring`, `/runner-kit`, `capabilitiesFor`, `checkOffered`, `verifyPlacementInputs`, `renderElements`), new props (`<Surface>`'s `wrapperProps`, `portalProps`, `transparency`, `confirm`), and the language-neutral corpus under `conformance/corpus/`. Nothing you already wrote needs to change to get them.

Two behaviours do change without breaking an interface, so check them if you rely on them:

- A vocabulary that declares `contrast` now fails a theme install that misses a pair's minimum, maximum or strict ordering, with `insufficient-contrast`.
- The empty portal container still takes a layout box, as in 0.1.0. In a grid or flex parent it can claim a track or add a gap; `portalProps={{ style: { display: "contents" } }}` removes the box without detaching overlays. See [The renderer](renderer.md).

## 5. Keep the host's security boundaries

- **`meta` grants nothing.** Treat manifest and capability annotations as untrusted input on load; they never authorise an operation. See [the security model](security.md).
- **`confirm` is not authorisation.** The renderer's confirmation hook is a UI convenience. The host still checks its confirmation policy and authorises the authenticated user on dispatch. See [the renderer guide](renderer.md).
- **The runner kit is not isolation.** `/runner-kit` runs inside the realm supplied by the host and does not bound time or access. Run hostile code in an isolated runner and validate every returned tree on the host. See [the security model](security.md).
- **`checkOffered` is the host's job.** Before dispatch, call it with the current served tree, the captured origin, the completed intent and the compiled validator. Reject stale or unoffered intents, then authorise the operation; a passing check grants no authority. See [the renderer guide](renderer.md).

## 6. Check the migration

Run the conformance suites you already registered ([Conformance](conformance.md)). The store suite fails as soon as a store keeps 0.1.0's two-argument state methods, which is the point:

```sh
bun test
```

In this repository, `bun run check` runs the guide's samples themselves: `src/__tests__/migration-guide.test.ts` asserts that this page prints them verbatim and then executes them.
