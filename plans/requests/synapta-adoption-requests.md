# Bug and feature requests from the Synapta adoption analysis

- **Release scope update (2026-10-27):** the owner renumbered the release to **0.2.0**, including every LF/CL request and the backlog items both documents raise; this supersedes the original targets below ([scope decision](../../decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md)).
- **Delivery status (2026-10-29):** all 17 requests are implemented for 0.2.0. [`docs/adopters-0.2.md`](../../docs/adopters-0.2.md) records, per ID, the shipped API, its spec section and its limitation; this document stays the request record and is not updated as the answer. The one item that did not close is G29, the native Windows forced-colours and assistive-technology audit: its checklist is written (`plans/evidence/020-g29-audit.md`) and the owner waived the run for this release.
- **Source:** analysis of `@arnilo/liveframe@0.1.0` (the published tarball, `docs/`, `schemas/`, `dist/`, and source at `f98abd8`) against Synapta's widget runtime (`synapta-core`: `packages/synapta-widget-sdk`, `web/app/lib/widgets/*`, `web/app/lib/ag-ui/*`, `product-modules/ui/core/*`, Plans 201–204).
- **Date:** 2026-10-27
- **Status:** requests, not decisions. Each item names the general problem first; Synapta is the evidence, not the reason. Settle each one with a decision log and a plan before you build it.
- **Not repeated here:** items already in `plans/backlog.md`. Raise these priorities rather than filing them again: G30 (icon tone), G31 (tab content slot), G29 (forced-colours and assistive-technology audit; Synapta's accessibility list requires forced colours), G2 (Certified identity and diagnostic fill roles), and the Phase 7 adopter list.

## Summary

| ID | Type | Title | Priority | Target |
|---|---|---|---|---|
| LF-01 | Bug | `onIntent` gives the host no way to check an intent's origin | P1 | 0.2.0 |
| LF-02 | Bug | `generate()` and `capture()` are built but not exported | P2 | 0.2.0 |
| LF-03 | Bug (docs) | `model.md` still calls `implement()` "planned" | P4 | 0.2.0 |
| LF-04 | Feature | Schema language: `minLength`, `minItems`, `nullable`, discriminated unions | P1 | 0.2.0 |
| LF-05 | Feature | Multi-value commit: an event that carries a declared object | P1 | 0.2.0 |
| LF-06 | Feature | State scope beyond the placement | P1 | 0.2.0 |
| LF-07 | Feature | Manifest `description` and host `meta` | P2 | 0.2.0 |
| LF-08 | Feature | `irreversible` actions, with confirmation metadata visible to primitives | P2 | 0.2.0 |
| LF-09 | Feature | More `semantics` values: form, group, figure, live regions | P2 | 0.2.0 |
| LF-10 | Feature | Contrast pairs declared in the vocabulary, checked on theme install | P2 | 0.2.0 |
| LF-11 | Feature | Alpha modifier for colour-role recipe values | P3 | 0.2.0 |
| LF-12 | Feature | A standard source-outcome envelope | P3 | 0.2.0 (docs and helper) |
| LF-13 | Feature | A public kit for the in-sandbox half of a runner | P1 | 0.3.0, before an isolated host runner is built |
| LF-14 | Feature | `capabilitiesFor(manifest)`: prune capabilities before shipping them to the browser | P3 | 0.3.0 |
| LF-15 | Feature | Authoring as a library (`/authoring`) | P2 | 0.4.0, before in-process agent authoring |
| LF-16 | Feature | Unpackaged (ephemeral) surfaces from agent JSON | P2 | 0.4.0 |
| LF-17 | Feature | Measure tree patches on a streaming agent surface | P4 | after LF-16 is in use |

**Why the targets are grouped this way.** Packages are immutable and hashed (spec §7.3), and stored records are re-verified on every load (spec §7.4). So anything that changes what an adopter writes into manifests, catalogs, capabilities, themes, design systems or stores should land **before** the adopter writes and stores them. That is the 0.2.0 set. Under `docs/compatibility.md` § Growth, each format change there is additive (new optional fields, keywords or enum values). The exception is LF-06, which changes the `Store` interface and the `fileStore` layout, so 0.2.0 must be a minor release. LF-13 to LF-17 only add new surfaces and can follow the adopter's sandbox and agent-authoring phases.

---

## LF-01 · Bug · `onIntent` gives the host no way to check an intent's origin

- **Problem.** `docs/renderer.md` § "Handle intents at the host boundary" requires the host to "reject stale revisions and intents not offered by the current tree". But `<Surface>` calls `onIntent(intent)` with the completed intent only (`src/react/renderer.tsx:20`, `:194`). The host can capture the revision in a closure, but it cannot learn which node or event raised the intent. So it cannot verify that the served tree offered that intent on that node. It can only check that the manifest declares the intent, which is a weaker guarantee than the docs promise.
- **Evidence (Synapta).** Synapta's action boundary dispatches irreversible operations with confirmation tokens and idempotency keys (`web/app/lib/widgets/actions.server.ts`). Checking that the served tree offered the intent closes a forged-intent path that manifest checks alone leave open.
- **Proposal.**
  - `onIntent(intent, origin)` where `origin = { surfaceId, revision, nodeId, event }`. This is additive: existing one-argument callbacks keep working.
  - A host-API-free backend helper, for example `checkOffered(tree, origin, intent): Result<void>`. It confirms that `tree.surfaceId`/`revision` match, that the node exists, and that its `events[event]` is the intent before completion: same `type`/`key`/`name`/`args`, with only the `bind` argument or the `setState` value filled from the event. The rule lives in one place instead of in every host.
  - Apply the same `origin` to `<Preview>`'s `onIntent` and to `createPreview().intent()`, so preview sessions can apply the same check.
- **Acceptance.**
  - Renderer tests show that `origin` is correct for nested, collection (`items[i].emit`) and portal-rendered nodes.
  - `checkOffered` rejects: a wrong revision, an unknown node, an undeclared event, changed args, a filled arg other than `bind`, and a `setState` key that differs from the offered one.
  - The renderer guide's host example uses it.
  - The conformance renderer suite records `origin` alongside intents.

## LF-02 · Bug · `generate()` and `capture()` are built but not exported

- **Problem.** `dist/sdk/gen.js` (`generate(catalog): string`) and `dist/cli/capture.js` (`capture(url, options)`) ship in the archive, but no `exports` entry reaches them. A host can use codegen and capture only through the CLI or the stdio MCP server, not from its own build service or agent host.
- **Evidence (Synapta).** Synapta's widget builder (a Bun service) and its in-process agent host need both as functions. Synapta's architecture forbids MCP as an internal transport.
- **Proposal.** Export them from public subpaths, for example `generate` from `/sdk/gen` and `capture` from `/preview/capture`, or both from `/authoring` (see LF-15). `capture` keeps `playwright` as a lazy optional peer.
- **Acceptance.**
  - The exports test lists the new subpaths.
  - The archive gate imports them from the installed package.
  - `liveframe gen` and `liveframe preview capture` call the exported functions.
  - Importing the subpath does not load Playwright.

## LF-03 · Bug (docs) · `model.md` still calls `implement()` "planned"

- **Problem.** `docs/model.md` step A2 says "Liveframe's planned `implement(definition, Component)` binds it". It shipped in 0.1.0.
- **Proposal.** Fix the wording, and sweep the shipped docs for other "planned" or "will" wording about shipped APIs.
- **Acceptance.** A docs check (or a grep in CI) finds no "planned" next to an exported name.

## LF-04 · Feature · Schema language: `minLength`, `minItems`, `nullable`, discriminated unions

- **Problem.** The schema language allows `string: maxLength, pattern, enum`, `array: items, maxItems`, `object: properties, required, additionalProperties`, and numbers with `minimum`/`maximum` (`src/schema.ts:107`). Spec §5 bans `pattern` in widget-authored schemas. That leaves no way to express four common constraints:
  - a non-empty string (an id, a reason, a label);
  - a non-empty list;
  - a value that is a `T` or `null`, which is common in API results (`nextCursor: string | null`);
  - a list of mixed record kinds, each with its own fields (a feed of tasks, alerts and decisions).

  Adopters fall back on making every field optional and checking by hand. That pushes validation into widget code, and agents can no longer read the constraint from the schema.
- **Evidence (Synapta).**
  - `product-modules/ui/core/manifest.json` uses `minLength: 1` on every action id argument.
  - Its source results use `nextPageToken: anyOf [string, null]`.
  - Its queue mixes decision, task and alert rows.
  - The approved reason contract is "1–500 characters".
- **Proposal.** Follow RFC 8927 (JTD), which spec §5 already cites:
  - `minLength` (code points, ≤ `maxLength`) and `minItems` (≤ `maxItems`). These are linear-time checks with no ReDoS risk, so they are allowed in widget schemas.
  - `nullable: true` on any form.
  - A discriminated union: `{ discriminator: "<prop>", mapping: { "<tag>": ObjectSchema, … } }`. Each mapping entry is a closed object that does not declare the tag property; the tag is a bounded string. Do not add general `oneOf`/`anyOf`: they cost more and give agents worse error messages.
  - `Infer<S>` produces `T | null` and a tagged union type, so `liveframe gen` and `WidgetProps` types follow.
  - Both the compiled validator and the published JSON Schemas understand the new forms. The JSON Schema form of a discriminated union can be `oneOf` with a `const` per tag.
- **Acceptance.**
  - Every new keyword has failing-case validator tests: bounds, well-formedness (`minLength > maxLength` is rejected), and code-point counting.
  - Each failing value produces an agent-readable `expected`.
  - The published schemas validate documents that use the new forms.
  - The compiled checks stay within the existing ≤ 1.5 µs/node validator bench and the 3 µs/node render bench.
  - A test pins that `pattern` is still rejected in widget schemas while `minLength` is accepted.

## LF-05 · Feature · Multi-value commit: an event that carries a declared object

- **Problem.** An event's `carries` is `none`, `string` or `boolean`, and an action's `bind` fills exactly one argument (spec §8; `src/formats/catalog.ts:22`). A form with N inputs can only reach one action in two ways:
  - N `setState` commits, each a server round trip, before the submit renders an action with all the values. If the user clicks submit before the last blur commit has re-rendered, the submit sends stale arguments.
  - One action per field, which is not a form.

  This affects every form, every dialog with a reason field, and every wizard step.
- **Evidence (Synapta).**
  - The agent-surface `Form`, `Field` and `Wizard` keys submit several fields as one intent.
  - The queue's escalate dialog combines a reason with a confirmation.
  - Workflow recipe inputs are forms generated from an input schema.
- **Proposal** (pick one in a decision log):
  - **A. Object-carrying events.** `carries` gains `{ object: ObjectSchema }`, which must be closed and bounded. A form-like primitive's implementation emits `{ name: value, … }` from its local field state. An action may `bind` the whole object to its argument object: `action("x", { id }, { bindAll: true })` merges the emitted object into `args`. The validator checks at build time that the event's schema fits the action's argument schema, minus the literal args. `setState` with such an event writes the object to an object-typed state key.
  - **B. Named bindings.** `bind` accepts a map `{ argName: fieldKey }`, and the emitting primitive supplies the named values it holds locally.

  A is simpler to validate and reuses the schema language. B keeps `carries` scalar but needs a new emitter contract.
- **Acceptance.**
  - The validator rejects a mismatched object/argument schema at render time with `invalid-prop` and a pointer.
  - `emit` throws on a value that fails the declared object schema, and the existing `carries` mismatch tests cover the new form.
  - A renderer browser test shows that one submit carries every field's current local value with no prior `setState`.
  - The preview session's `intent()` re-checks the filled arguments.
  - The conformance renderer suite gains a "form submits its fields" fixture.

## LF-06 · Feature · State scope beyond the placement

- **Problem.** The `Store` keys widget state by placement id only (`putState(placementId, state)`, `getState(placementId)`), and `loadPlacement()` always reads state from the store. A placement is often shared, for example an organisation's or a team's page, while state (filter, selection, cursor) belongs to a viewer, a session or a URL. Today a host has two workarounds: duplicate placements per viewer, or bypass `loadPlacement()` and re-implement its state verification and reset semantics.
- **Evidence (Synapta).** Home placements are an organisation or member layout. Widget state is per viewer and mirrored into the URL (`?widget.<placementId>=<json>`, `web/app/hooks/use-widget-state.ts`), so a shared link reproduces the view.
- **Proposal.**
  - Key state by `(placementId, scope)`, where `scope` is an opaque host string (bounded, storable), and `""` means the shared state:
    - `putState(placementId, scope, state)`
    - `getState(placementId, scope)`
    - `deletePlacement` removes every scope.
  - `loadPlacement(store, id, options, { scope?, state? })`: when `state` is given, the store's state is not read, and the same check-and-reset rules apply and are reported in `reset`.
  - Also export `verifyPlacementInputs(pkg, { params, state }) → Result<{ params, state, reset? }>` for hosts that never store state.
  - `fileStore` reads an existing 0.1.x directory and treats its states as scope `""`, as `docs/compatibility.md` promises ("read an existing directory rather than require an export").
- **Acceptance.**
  - `storeSuite` covers scoped state isolation and deletion across scopes.
  - `memoryStore` and `fileStore` pass it.
  - A 0.1.x `fileStore` fixture directory loads under 0.2.0.
  - `loadPlacement` with explicit state resets an invalid state exactly as it resets a stored one.
  - The compatibility doc records the interface change as a minor-version break.

## LF-07 · Feature · Manifest `description` and host `meta`

- **Problem.** The manifest, capabilities and placement formats are closed (`additionalProperties: false`). A widget has no human or agent-readable description. A host cannot bind its own facts to the immutable, hashed package: a display title, the size classes it supports, provenance, an owning module. Hosts keep parallel maps keyed by `(id, version)`, and those maps can drift from the package.
- **Evidence (Synapta).** Synapta's `widget.json` carries `title`, `sizes`, `module` and `provenance.scope`. The trust path (in-process or sandbox) is chosen from `provenance.scope`. A widget gallery and the agent's discovery of existing widgets need a description.
- **Proposal.**
  - Manifest: optional `description` (string, ≤ 500 code points), and optional `meta`: closed JSON (bounded depth and bytes) that Liveframe hashes and carries but never interprets.
  - Capabilities: optional `meta` per action and per source, for the host's binding data (for example an operation id or an authorisation key).
  - `list_capabilities` and the MCP server show `description`. `meta` stays host-only unless the host opts in.
- **Acceptance.**
  - The format, JSON Schema, `pack()` and `verifyPackage()` tests cover both fields, including size bounds.
  - The hash changes when `meta` changes.
  - The docs say that `meta` grants nothing and is untrusted on load.

## LF-08 · Feature · `irreversible` actions, with confirmation metadata visible to primitives

- **Problem.** A capability action may set `confirm: true`, but nothing reaches the browser primitive that raises it. Whether a button shows an in-place confirmation or an "irreversible" label is left to each widget author, and a forgotten confirmation goes unnoticed until the host refuses or performs the action. Confirmation is also not the same as irreversibility: a reversible action can need confirmation, and an irreversible one must say so on the control.
- **Evidence (Synapta).** Synapta's catalog trust rule 6: "Irreversible intents are labelled irreversible on the control and confirmed in an in-place confirmation." Its module manifest distinguishes `confirm` from `irreversible` on each action.
- **Proposal.**
  - Capabilities: optional `irreversible: boolean`.
  - `implement()` context: an `events` map that exposes each declared event's resolved action metadata (`{ type, confirm, irreversible }`) and no argument values. A host primitive can then render the confirmation step and the label uniformly.
  - Optional: `<Surface confirm={(intent, meta) => Promise<boolean>}>`. When it is present, the renderer awaits it before `onIntent` for actions with `confirm: true`, so confirmation is enforced in one place.
- **Acceptance.**
  - Renderer tests show the metadata reaches implementations for nested and collection nodes.
  - With `confirm` supplied, an unconfirmed action never reaches `onIntent`.
  - The capabilities format and schema tests cover `irreversible`.
  - The docs repeat that the host still re-checks on dispatch.

## LF-09 · Feature · More `semantics` values

- **Problem.** `semantics` is a library-fixed list of 11 values (`src/formats/fixed.ts:4`): `section`, `article`, `aside`, `header`, `footer`, `nav`, `list`, `listItem`, `terms`, `term`, `detail`. A catalog cannot add to it. Common structure is missing:
  - a form landmark;
  - a labelled group of related controls (fieldset);
  - a figure with a caption;
  - live regions, so assistive technology announces status changes and errors (progress, "saved", "failed").
- **Evidence (Synapta).** Synapta's banners, progress indicators and source-failure states must be announced. Its forms are server-checked groups of labelled fields.
- **Proposal.**
  - Add `form`, `group`, `figure`, `status` (polite live region) and `alert` (assertive live region).
  - Live regions must stay mounted across re-renders so announcements fire. The id-keyed reconciliation already preserves this; document it.
  - Tables are deliberately not on this list: a table is a host primitive with its own `a11y.role`.
- **Acceptance.**
  - Format, schema and generated-type tests cover the new values.
  - A renderer browser test shows that a `status` node's text change is announced once (via the accessibility snapshot) and is not remounted.
  - The conformance renderer suite gains semantics fixtures.

## LF-10 · Feature · Contrast pairs declared in the vocabulary, checked on theme install

- **Problem.** Themes are installable at runtime by users and agents (spec §6.1), and `validateTheme` checks that every role is present and well formed. Nothing stops an installed theme from making text unreadable. Contrast is a property of role **pairs** that the app knows: muted text on raised surfaces, a focus ring on the base surface.
- **Evidence (Synapta).** Synapta's design gates check contrast pairs in all four themes: hairlines on surfaces ≥ 1.35:1 or 1.15:1, foil marks ≥ 3:1, foil text and body text ≥ 4.5:1 (`docs/design/tokens.json` `pairs`).
- **Proposal.**
  - Vocabulary: optional `contrast: [{ foreground, background, minimum, description? }]`, naming declared colour roles.
  - `validateTheme` computes WCAG 2.x relative-luminance contrast after alpha compositing over the background role, and fails with a new `insufficient-contrast` error kind naming the pair and the measured ratio.
  - Optionally include APCA as an informational `expected` hint.
  - `designSystemSuite` or a new theme case in the conformance kit runs the check against every installed theme.
- **Acceptance.**
  - Colour-space conversion tests cover every DTCG colour space Liveframe accepts.
  - Alpha compositing is tested.
  - A pair below its minimum fails with the measured ratio.
  - A vocabulary without `contrast` behaves exactly as in 0.1.0.
  - The new error kind is documented as an addition, per the compatibility policy.

## LF-11 · Feature · Alpha modifier for colour-role recipe values

- **Problem.** Colour-typed recipe properties take a theme role only. Only the background has an opacity multiplier (`backgroundOpacity`). Translucent borders, text and shadow colours need a separate theme role for each alpha step, so the vocabulary grows and every theme must define each variant.
- **Evidence.** The proof vocabulary (`src/__tests__/fixtures/proof/vocabulary.json`) already carries `shadow.ambient.alpha-0-14`, `shadow.ambient.alpha-0-45`, `border.hairline.alpha-1`, `surface.scrim.alpha-0-55` and similar roles. These are Certified's values (Synapta) expressed as roles.
- **Proposal.**
  - Allow a colour-typed value to be `{ role, alpha }`, with `alpha` either a design-system `opacity` value name or a bounded number in 0–1. The projection uses `color-mix(in oklab, var(--lf-c-<role>) <alpha%>, transparent)`, or relative colour syntax if the platform floor allows it.
  - Colour authority is unchanged: the colour still comes only from the theme.
  - Forced colours and reduced transparency override it as they do `backgroundOpacity`.
- **Acceptance.**
  - Projection tests cover byte-stable output, forced colours and reduced transparency.
  - The design-system validator rejects an alpha on a non-colour property and an unknown opacity name.
  - The proof vocabulary drops its `*.alpha-*` roles, and Certified/Rack parity is unchanged.

## LF-12 · Feature · A standard source-outcome envelope

- **Problem.** A widget's data sources are resolved as the viewer, and each can independently be unauthorised, unavailable, timed out, stale or malformed. Honest UI shows each source's outcome rather than a blank or a guess. Today every host invents its own wrapper inside the source's `result` schema, so widgets, scenarios and agents can't rely on one shape. The proof itself invented `data.status` (`fixtures/widgets/core-queue/widget.tsx`).
- **Evidence (Synapta).** Synapta's resolver returns `{ status: Present | Unauthorized | Unavailable | Stale | Failed, value, freshness, reason? }` per source (`web/app/lib/widgets/sources.server.ts`), and its widget frame draws a state for each.
- **Proposal** (docs and helpers; no format change needed once LF-04 lands):
  - A documented envelope schema, built with LF-04's discriminated union: `{ status: "ok", value, checkedAt? } | { status: "unauthorized" | "unavailable" | "stale" | "failed", reason?, value? }`.
  - A helper `sourceOutcome(resultSchema)` that builds the envelope schema for a capability's `result`.
  - Scenario generation in preview and MCP can expand each envelope status into a named scenario, so authors see the failure states without writing them.
- **Acceptance.**
  - The helper's output validates under the schema language.
  - A preview test renders the generated outcome scenarios.
  - `docs/formats.md` documents the convention as optional.

## LF-13 · Feature · A public kit for the in-sandbox half of a runner

- **Problem.** Spec §7.5 says hostile code needs the app's own isolated runner, but the part of a runner that runs **inside** the isolate is not public:
  - `renderPackage` is `@internal` (`dist/preview/in-process.d.ts`).
  - The package loader rewrites SDK imports using `import.meta.resolve` and imports the result through a `data:` URL, which ties it to Bun.

  An adopter with a V8 isolate, `deno_core`, QuickJS or a separate process must re-implement module linking, validator compilation and `render()` wiring, and keep them in step with every release.
- **Evidence (Synapta).** Organisation and agent widgets run in Synapta's `deno_core` hostile-code sandbox: one child process per invocation, no network, no host operations. That sandbox needs to evaluate the package code with the SDK available and return a tree. Synapta also renders a page's placements as one batch per sandbox call.
- **Proposal.**
  - A host-API-free subpath, for example `/runner-kit`, exporting `renderModule(widgetDefault, inputs, { catalog, capabilities, manifest, surfaceId, revision, limits, maxErrors }): Result<UiTree>`. It compiles and caches the validator, then calls `render()`. It is synchronous and needs nothing from the host.
  - A published **single-file ESM bundle** of SDK + validator + `renderModule`, with no dynamic `import()`, no `import.meta` and no relative imports, so a sandbox can embed or snapshot it.
  - A documented **linker contract**: the exact header lines `pack()` emits for SDK imports, and a pure `linkPackage(code, sdkSpecifier)` that rewrites them to any module id the sandbox provides.
  - Optional on `Runner`: `renderMany(requests)`, or documented guidance that batching is the runner's choice. The host still validates each result again.
- **Acceptance.**
  - The bundle runs under a non-Bun isolate in CI, for example plain V8 through Deno or `node --experimental-vm-modules`, and the test records which.
  - `workerRunner` and `inProcessRunner` are rebuilt on the kit, with identical results on the existing runner tests.
  - The archive gate checks the bundle is self-contained.
  - The security doc repeats that the kit is not an isolation boundary.

## LF-14 · Feature · `capabilitiesFor(manifest)`

- **Problem.** Arrival validation compiles a validator from the catalog, capabilities and manifest, so the host ships the capabilities to the browser. An app's full capabilities document can be large, and it describes operations a given widget never uses.
- **Proposal.**
  - `capabilitiesFor(capabilities, manifest)` returns a capabilities document holding only the actions and sources the manifest names. It is pure and deterministic.
  - `compileValidator` gives identical results with the pruned document.
- **Acceptance.**
  - The equivalence test passes on every proof manifest.
  - The renderer guide recommends pruning before transfer.

## LF-15 · Feature · Authoring as a library (`/authoring`)

- **Problem.** The seven authoring tools exist only behind `liveframe mcp` over stdio. An app whose agents run in its own process, with its own tool protocol, permissions and audit, cannot reuse them without spawning a stdio MCP server.
- **Evidence (Synapta).** Synapta's agents call host tools inside its Do host. Its architecture rule says MCP is an external adapter, never the internal bus. Plan 204 needs tools with the same behaviour: list primitives, vocabulary and capabilities; generated types; pack a draft; render scenarios; capture.
- **Proposal.**
  - `/authoring` exports `createAuthoring({ catalog, capabilities, runner, preview? })`, which returns the seven operations as typed async functions. They have the same inputs, outputs, bounds, serialisation and `LiveframeError` shapes as the MCP tools.
  - `liveframe mcp` becomes a thin adapter over it.
- **Acceptance.**
  - The existing MCP tests pass unchanged against the adapter.
  - New unit tests call `/authoring` directly.
  - `/authoring` doesn't load the MCP SDK.

## LF-16 · Feature · Unpackaged (ephemeral) surfaces from agent JSON

- **Problem.** Chat agents usually answer with a one-off surface emitted as JSON, not a TSX package that has been authored, previewed and stored. Liveframe's path to a validated tree assumes a widget function and a manifest. An agent can't reliably produce a `UiTree` directly, because ids must be key paths derived by the SDK. A host today must synthesise a fake package and manifest by hand.
- **Evidence (Synapta).** Synapta's `render_a2ui` agent tool paints ad-hoc surfaces from the shared catalog (`packages/synapta-ai-core/src/tools.ts:540`). Migrating it to Liveframe needs this path.
- **Proposal.**
  - An element-JSON format for agents: `{ kind, key?, variant?, props, style?, events?, children? }`, with intents in the existing `Intent` shape, plus a published JSON Schema generated per catalog so an agent tool can declare it.
  - `renderElements(json, { validator, surfaceId, revision, limits })` builds the tree with the same key-path ids, one-pass validation and errors as `render()`.
  - `ephemeralManifest({ catalogId, actions, state? })` builds the manifest such a surface validates against, so the browser's arrival check stays unchanged.
- **Acceptance.**
  - The trees from `renderElements` are identical to those from `render()` for equivalent TSX in the existing SDK fixtures.
  - Each validation error kind is reported with a pointer into the JSON.
  - The agent-facing JSON Schema is generated deterministically from the catalog, with a `--check` drift test.

## LF-17 · Feature · Measure tree patches on a streaming agent surface

- **Problem.** Spec §9 defers tree patches until a realistic measurement calls for them. A streaming agent surface, whose progress and partial results arrive many times a second, is the realistic case that has not been measured. Every update re-sends and re-validates the whole tree.
- **Proposal.**
  - Once LF-16 is in use, benchmark revision-per-update streaming on an adopter-sized agent surface: transfer bytes before and after gzip, arrival validation cost, and React commit cost.
  - Record the result in a decision log, and design patches only if the numbers call for them.
- **Acceptance.** A recorded benchmark and decision; no API change unless the decision approves one.
