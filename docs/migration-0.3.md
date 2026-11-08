# Migrating to 0.3.0

0.3.0 is a minor release under the [compatibility policy](compatibility.md). It may break contracts from 0.2.3. Each implemented break is registered against the 0.2.3 API baseline and documented here with before and after behaviour, a code sample and an adopter checklist.

This guide grows as the 0.3.0 tasks land. An empty section below means no breaking changes have landed yet; planned changes are listed in [compatibility](compatibility.md#deferred-to-030). The [spec](spec.md) defines the current contracts and the [changelog](../CHANGELOG.md) records shipped changes.

## Breaking changes

### Foreign-realm documents are rejected everywhere

Before, install validators could accept objects constructed outside their JavaScript realm, while tree validation reported a generic `invalid-prop` error. After, document validators consistently reject foreign plain objects with `invalid-document`, the offending pointer and the instruction to parse inside the sandbox. `compileValidator` throws `LiveframeFailure`; `renderModule` returns its document errors. Patch bases and diff inputs still require previously validated, immutable trees.

```ts
// Before: pass a host object directly to the sandbox's validator.
sandbox.validateCatalog(hostCatalog);
// After: transport text and parse it inside the sandbox.
const text = JSON.stringify(hostCatalog);
// Inside the receiving realm:
const result = validateCatalog(JSON.parse(text));
```

Adopter checklist: Parse transported JSON in the receiving realm before validation. Recreate installed catalogs, capabilities and manifests in that realm before compiling; validate returned trees in the host after transport. Same-realm and null-prototype objects retain their existing behaviour.

### Packages are deeply frozen

Before, `pack()` and `verifyPackage()` returned mutable packages. After, they return owned copies frozen at every depth. `outcomeScenarios()` also returns deeply frozen copies.

```ts
// Before
pkg.manifest.description = "Reviewed";
// After: prepare metadata before packing and store approval separately.
const approval = { hash: pkg.hash, approvedBy: reviewerId };
```

Adopter checklist: Follow the migration checklist. move package metadata before packing; keep approval outside the package; remove writes to package fields and nested scenarios. Writes throw in strict mode.

### Render inputs keep caller ownership

Before, rendering froze caller objects in place and cached checked data by identity. After, each render checks mutable inputs and gives the widget a deeply frozen structural copy, including the input envelope. Caller objects remain writable. Element rendering has no widget inputs; module rendering uses the same SDK path.

```ts
// Before: clone inputs to preserve writable host state.
render(Widget, JSON.parse(JSON.stringify(inputs)), options);
// After
render(Widget, inputs, options);
```

Adopter checklist: Follow the migration checklist. explicitly freeze host state if needed; do not depend on widget input identity matching host objects; expect changed mutable data to be checked again.

### Fractions on dimension props are rejected

Before, `width`, `height`, `minWidth`, `maxWidth`, `minHeight` and `maxHeight` accepted `fr` values. They projected to `minmax(0, Nfr)`, which browsers ignored as a size. After, those props reject fractions with `invalid-prop`, including values inside responsive breakpoint maps. Grid `columns` and `rows` still accept fractions.

```tsx
// Before
<Box width="2fr" />
// After: distribute available space in a flex parent.
<Box grow={2} basis={0} />
// Or express the tracks on a grid parent.
<Grid columns={["2fr", "1fr"]} />
```

Adopter checklist: replace dimension fractions in widgets, stored trees and responsive maps with `grow` / `basis` for flex layout, or move fractions to the parent's grid `columns` / `rows`. Use declared `space.*` / `size.*`, `fill`, `fit`, or bounded `ch` / `%` when a dimension is needed. Regenerate catalog SDK types with `liveframe gen`.

### Render keys and widget props include actions

Before, `WidgetProps` had four members and `renderKey` hashed `{ hash, catalogId, params, state, data, context }`. After, `WidgetProps` has a fifth, `actions` (the host's report on each action), and `renderKey` hashes it too, an absent `actions` as `{}`, so every key differs from 0.2. `render()`, `renderModule()` and the runners take the new `WidgetInputs`, which is `WidgetProps` with `actions` optional, so a host that reports nothing still renders.

```ts
// Before
const inputs: WidgetProps = { params, state, data, context };
// After: build render inputs as WidgetInputs, or add actions.
const inputs: WidgetInputs = { params, state, data, context };
const key = renderKey({ hash, catalogId, params, state, data, context, actions });
```

Adopter checklist: Type host-built render inputs as `WidgetInputs`, or add `actions: {}`. Recompute cached keys; they are not comparable with 0.2 keys. A widget that reads `actions` receives `{}` when the host supplies none.

### Surfaces keep focus by default

Before, `<Surface>` left focus recovery off unless `focusContinuity` was supplied.
After, focus continuity defaults to `true`: removing the focused element moves
focus to the next surviving tabbable, else the previous one, else the surface
wrapper. Every move prevents scrolling and emits no intent. Existing focus
placed by the host or a primitive is respected.

```tsx
// Before: explicitly enable focus recovery.
<Surface {...surfaceProps} focusContinuity />
// After: enabled by default.
<Surface {...surfaceProps} />
// Opt out to retain 0.2.3 behaviour.
<Surface {...surfaceProps} focusContinuity={false} />
```

Adopter checklist: Remove redundant `focusContinuity={true}` props if desired.
If the host owns recovery, pass `focusContinuity={false}`; this takes no snapshot,
adds no attribute or `tabIndex`, and installs no listener. Check keyboard flows
that remove a focused row or portal control.

### Semantics enums and recipe states follow the vocabulary

Before, a definition's `semantics` enum could hold any values, and a recipe key with an undeclared state failed both the published schema (`invalid-document`) and install (`unknown-name`). After, a string enum prop named `semantics` may hold only the sixteen library values and names declared in `vocabulary.semantics`; any other value is `unknown-name` at the enum item. The published design-system schema now accepts any state name, because it cannot know the catalog's app states, so an undeclared state such as `button.*.root.busy` is `unknown-name` at install only. `RecipeKey` ends in any string, so the compiler no longer rejects an unknown state.

```jsonc
// Before: any enum value passed install
"semantics": { "type": "string", "enum": ["section", "banner"] }
// After: declare each value that is not a library value
"vocabulary": { "semantics": { "banner": { "role": "banner", "description": "Page header." } } }
```

Adopter checklist: list the values in each `semantics` enum and declare every non-library one in `vocabulary.semantics` with an `ariaRoles` role (a minor catalog change). Update design-system ports that rely on the schema alone to reject an unknown state: install now does. Catalogs that use only library values need no change.

### A tree for another catalog is refused as catalog-mismatch

Before, a tree whose `catalogId` differed from the surface's catalog was rejected by the validator as `invalid-prop` at `/catalogId`.
After, `createSurfaceCore` (and so `<Surface>`) refuses it with `catalog-mismatch` at `/catalogId`, in the returned errors and the `arrival-rejected` event. The surface still draws the fallback.

Adopter checklist: if you branch on the error kind of a rejected arrival, treat `catalog-mismatch` at `/catalogId` as a tree for the wrong catalog.

## Compatible additions

### Preview and authoring validation limits

Optionally set limits; defaults remain unchanged. `createPreview()`, `createAuthoring()` and the MCP config accept `limits: { nodes: 20_000 }`, with optional positive safe integers for `nodes`, `depth` and `bytes`. Limits apply to both the runner and host validation. Invalid limits report `invalid-document` at `/limits` during construction (MCP exits 2). Authoring tool response and capture bounds remain unchanged. See [preview](preview.md) and [MCP](mcp.md) for details.

### Optional verified-package cache

Optionally pass a host-owned verifiedPackages cache; existing calls remain supported.

Before, every `loadPlacement` call performed full package verification. After,
that remains the default; hosts may opt in to reuse verification for the same
package content and canonical installation documents.

```ts
// Before (still supported)
await loadPlacement(store, id, install, { scope });
// After: share this host-owned cache across loads.
const verified = verifiedPackages({ max: 256 }); // import from @arnilo/liveframe/store
await loadPlacement(store, id, install, { scope, verified });
```

Adopter checklist: Profile repeated loads before opting in. Keep the cache in the
host and share it across stores of one installation. Only insert verified frozen
packages through its trusted `set` method. Stored structure and hashes are checked
every time; changed content or installation documents miss automatically. Params
still reject and invalid state still resets. This addition requires no migration.

### Node references

Regenerate reference-bearing SDK types and element schemas; update catalog validators before using refProps.
Catalogs can declare up to eight string reference props. Generated authoring types
use `NodeRef` markers (`ref("hint")`); element JSON uses `{ "$ref": "hint" }`
with `$anchor: "hint"` on the target. Rendered trees still carry plain string ids.
Missing targets fail with `not-found`. Catalogs without references keep their
existing prop types.

In the renderer, `<Surface>` gives every implementation a `domId` and rewrites
`refProps` values from key-path ids to the target's `domId` before they reach
`props`. The renderer adds no wrapper element, so the target's implementation
renders `domId` as its own `id`:

```tsx
implement(Hint, ({ props, slot, domId }) => <p id={domId} className={slot("root")}>{props.text}</p>);
implement(TextField, ({ props, domId }) => (
  <input id={domId} aria-describedby={props.describedBy} />
));
```

Put `domId` on the element a reference-bearing target renders; a host that builds ImplementationProps by hand adds the field.
Existing implementations keep working unchanged: an implementation that ignores `domId` renders the same DOM.
`rendererSuite` fails an example whose reference names no element.

### Extension recipe properties

Declare app-owned recipe properties in `vocabulary.extensions` and set them in a recipe's `extensions` map; the projection emits each as `--lf-p-<name>` for your trusted primitive CSS to read.
Update catalog and design-system validators and ports before installing documents that use extensions; a 0.2.x validator rejects them fail-closed.
Adopting is opt-in: a catalog or design system without extensions is unchanged and projects byte-identical CSS.

1. Declare the name and type in the catalog vocabulary (`colour`, or `value` with a design-value `kind`). Adding one is a minor catalog change.
2. Set it in each design system's recipes; a system that does not set it keeps working.
3. Read `var(--lf-p-<name>, <fallback>)` in your primitive CSS, or build the name with `extensionVar` from `@arnilo/liveframe/css`.

`auditContrast` ignores extensions, so audit any pair your CSS paints from one yourself. See [extension properties](styling.md#extension-properties).

### App-declared states and semantics values

Declare recipe states and `semantics` values of your own in the vocabulary instead of waiting for a library release.
Update catalog and design-system validators and ports before installing documents that use them; a 0.2.x validator rejects them fail-closed.
Adopting is opt-in: a catalog without `states` and `semantics` keeps its recipes, resolved tables and CSS bytes.

```jsonc
"states": { "dragging": { "attribute": "data-dragging", "description": "Being dragged." } },
"semantics": { "toolbar": { "role": "toolbar", "description": "A set of controls." } }
```

1. Add the entry (a minor catalog change; removing one or changing its `attribute` or `role` is major). A state `attribute` must be `data-` plus the name in kebab case, and a `role` must be in `ariaRoles`.
2. Key the state in recipes (`box.default.root.dragging`); a design system that ignores it stays complete. Set and remove the data attribute in your primitive, and supply a state fixture to `rendererBrowserSuite` for every app state a system styles.
3. Add the semantics value to your layout primitive's `semantics` enum, and map it to an element in the implementation.

Two checks tighten for existing documents; see [Semantics enums and recipe states follow the vocabulary](#semantics-enums-and-recipe-states-follow-the-vocabulary).

See [app states](styling.md#app-states) and [app semantics](styling.md#app-semantics).

### URL strings

Declare `url` on a prop that carries a URL, so no host has to hand-roll `javascript:` blocking.
Update catalog and design-system validators and ports before installing documents that use them; a 0.2.x validator rejects the keyword fail-closed.
Adopting is opt-in: a prop without `url` validates exactly as before.

```ts
href: str({ maxLength: 2048, url: { schemes: ["https", "mailto"], relative: true } })
```

1. Replace a hand-written `pattern` on a URL prop with `url` (the two cannot be combined). A value with a control character, an unlisted scheme (case-insensitively), or a `//host` or backslash start is `invalid-prop`.
2. Widget schemas may use `url`; they still may not use `pattern`.
3. Regenerate types and element schemas with `liveframe gen`: the prop doc names the schemes and the element schema carries a generated `pattern`.
4. `catalogSuite` gains `url_props_declare_a_url_rule`, which fails a string prop named like a URL (`href`, `src`, `url`, or ending in `Href`, `Src`, `Url`) that has no `url` rule, `pattern` or `enum`. Declare `url` on it, or constrain it another way; nested props inside objects, arrays and unions are checked too.

See [the security model](security.md) and [formats](formats.md#the-schema-language).

### Variant axes

Declare a second look choice as an axis instead of enumerating product variants such as `primary-critical`; an axis value can alias colour roles, so one entry recolours every variant.
Update catalog and design-system validators and ports before installing documents that use axes; a kind that adopts an axis changes its slot classes to `lf_<kind>_<variant>__<value>_<slot>`, so update host CSS and tests that select them.
A 0.2.x validator rejects these documents fail-closed. Adopting is opt-in: a kind without axes keeps its classes and projects byte-identical CSS.

```ts
// Before: one axis, product variants
variants: ["primary", "primary-critical", "ghost", "ghost-critical"]; // <Button variant="primary-critical" />
// After: an axis, and one alias entry per value
props: { tone: str({ maxLength: 12, enum: ["neutral", "critical"] }) },
variants: ["primary", "ghost"], axes: { tone: { default: "neutral" } }; // <Button variant="primary" tone="critical" />
// design system: "button.tone:critical.root.rest": { "roles": { "accent": "status.critical" } }
```

1. Add the enum prop and `axes` to the definition (a minor catalog change; all kinds with axes together may have at most 512 variant and axis combinations) and keep the product variants until widgets have moved; removing them is major.
2. Move product recipes into axis overlays with `roles` aliases; every rewritten role must be a declared theme role.
3. Replace product variants in widgets and stored trees with the variant and the axis prop.
4. Search host CSS and tests for `.lf_<kind>_` selectors: the class gains the axis values (`lf_button_primary__neutral_root`).
5. Supply an example per axis value and, for styled states, a fixture for each non-default value (keyed `button.primary__critical.hover`).

See [variant axes](styling.md#variant-axes).

### Template widgets

A widget can now be a JSON template: element JSON plus a bounded expression language, validated at install against the manifest and evaluated by the library, so it needs no isolation runner. `@arnilo/liveframe/template` exports `validateTemplate`, `renderTemplate`, `checkExpression` and `evaluate`, and `schemas/template.json` publishes the transport schema.
Optional: validate template widgets with validateTemplate before installing them; existing calls are unchanged.
Port the template validator against the corpus before installing templates: `conformance/corpus/template/` holds the cases and `common/template-manifest.json` and `common/template-capabilities.json` their support documents. Nothing in a 0.2.x install changes, and a 0.2.x validator does not know the format.

```ts
import { validateTemplate } from "@arnilo/liveframe/template";
const checked = validateTemplate(doc, { catalog, capabilities, manifest }); // Result<Template>
```

1. Install templates only after `validateTemplate` passes; it is the only place a template is checked against the manifest.
2. Optional: render installed template widgets with renderTemplate; existing calls are unchanged. `renderTemplate(template, { params, state, data, context }, { validator, surfaceId, revision })` returns the same validated `Result<UiTree>` as `render()`, with `limits.steps` (default 1,000,000) bounding evaluation. Its errors point into the template document.
3. Packaging and running templates: see [Template packages](#template-packages).

See [formats](formats.md#template-widgets) and [the spec](spec.md#76-template-widgets).

### Template packages

A template widget is installed, stored, placed and rendered like a TSX widget. `pack({ template, manifest, scenarios }, { catalog, capabilities })` validates the template and returns a `liveframe-package/1` package whose `template` field replaces `code`; exactly one of the two is present (both or neither is `invalid-document` at `/code`).
Handle a package without `code` (check `template`) wherever you read `pkg.code`; code packages are unchanged.
Update widget-package validators and ports to accept a template package: `schemas/widget-package.json` no longer requires `code` and references `urn:liveframe:template:1`. A 0.2.x verifier rejects a template package fail-closed.
None: the hash of a code package is unchanged. A template package hashes `{ format, manifest, template, scenarios }`; `conformance/hash/template-packages.json` pins a vector.
Port the package hash to cover `template` before accepting template packages.
Port package verification against the corpus before accepting template packages: `conformance/corpus/package/template-*.json` cover a valid package, both fields, an unknown path and a hash mismatch.

```ts
// Before: every package has code, and every runner loads it.
const code: string = pkg.code;
// After: check which kind it is.
if (pkg.template !== undefined) renderTemplate(pkg.template, inputs, options);
else load(pkg.code as string);
```

1. Optional: use templateRunner for untrusted authors who only need template widgets. `templateRunner()` from `@arnilo/liveframe/preview` loads and runs no author code and refuses a code package; `inProcessRunner()`, `workerRunner()` and the runner kit render template packages too, with identical trees.
2. Optional: call it from a runner that renders template packages: `renderTemplatePackage(template, inputs, options)` from `@arnilo/liveframe/runner-kit` is the in-sandbox half, and it needs no sandbox.
3. Optional: pass `limits.steps` to bound a template widget's evaluation; existing calls are unchanged. `RunnerOptions.limits` and `RenderModuleOptions.limits` accept it, and a code widget ignores it.

See [packages](packages.md#template-packages) and [the security model](security.md).

### Template authoring and the template schema

A template widget can be previewed and authored like a TSX widget. `createPreview().update`, `createAuthoring().packDraft` and the MCP `pack_draft` accept `{ template, manifest, scenarios }`; `pack_draft({ dir })` reads a directory holding `template.json`; and `generated_types({ module: "templateSchema", manifest? })` returns a per-catalog JSON Schema an LLM can target. `generateTemplateSchema(catalog, { manifest?, capabilities?, structuredSubset? })` in `/sdk/gen` and `liveframe gen --template-schema` emit the same bytes.
Optional: send template drafts to createAuthoring().packDraft and the MCP pack_draft; existing calls are unchanged.
Optional: generate the template schema with generateTemplateSchema or liveframe gen --template-schema; existing calls are unchanged.

```sh
liveframe gen catalog.json --template-schema --capabilities capabilities.json --manifest manifest.json --out template.schema.json
```

1. A draft is code (`files` and `entry`) or a template (`template`), never both: `files` or `entry` beside `template` is `invalid-document` at that key.
2. A draft directory is a template draft when it holds `template.json`; it takes no source files and no `entry`.
3. The schema guides generation; `validateTemplate` stays the authority.

See [template widgets](templates.md) and [the agent guide](mcp.md).

### Action results

The host reports each action's status to the widget as an optional `actions` input, so a widget can draw "Saving…" or "Failed: name taken" without the host improvising.
Optional: pass `actions` when a widget should draw pending, failed or refused actions; omitting it is `{}`.
Optional: pass `{ resultKey }` to `action()` when one action runs for many rows.
Optional: declare `result` on an action to type its ok value.
Optional: type render inputs as `WidgetInputs`; type a widget's `actions` with `WidgetProps`'s fifth parameter.
Update patch consumers that reject unknown intent fields before sending resultKey.
Port `renderKey` to hash `actions` (absent as `{}`) before sending or accepting actions; `conformance/hash/render-keys.json` pins vectors.

```ts
// The host: pending, dispatch, then the outcome, re-rendering each time.
actions = { ...actions, "tasks.claim": { status: "pending" } };
actions = { ...actions, "tasks.claim": { status: "failed", reason: "Already claimed" } };
// The widget: draw it.
<Button label={actions["tasks.claim"]?.status === "pending" ? "Claiming…" : "Claim"} onPress={action("tasks.claim", { id })} />
```

1. `actions` is keyed by the action name, or by an intent's `resultKey` (a row id, say). A row-keyed entry names its action with `action`, which types its `value`.
2. `value` appears only with `ok` and must match the action's capability `result`. Entries are bounded (64 entries, a 128-character key, a 500-character `reason`) and invalid input is `invalid-prop` at `/actions/<key>`.
3. Scenarios, preview, `render_scenarios` and template widgets (root `actions`) carry it. A result grants nothing: it only changes what the widget draws.

See [the renderer guide](renderer.md#report-action-results) and [spec §8](spec.md#8-interaction-synaptas-three-tiers).

### Local state and bindings

A manifest may declare `local` state, and a tree may carry `when` and `bind` expressions and `setLocal` events, so interactions that need no data (a live filter, a disclosure) cost no round trip and no widget code runs in the browser.
Optional: declare `local` and `initialLocal` in a manifest, and use `local.set`, `local`, `ex`, `when` and `bind` from `/sdk`; existing widgets are unchanged.
Update tree consumers that reject unknown node or intent fields before a widget sends `when`, `bind` or `setLocal`; a renderer from 0.2.x fails closed on them.
`Intent` stays `setState | action` (what `onIntent` receives); a node's `events` may now hold the new `LocalIntent`. Narrow with `TreeIntent` when reading a tree's events.
A host's `checkOffered` rejects `setLocal` with `invalid-prop` at `/type`; no host dispatches it.
Run `conformance/patch/bindings.json` and the local-state corpus cases (`when-*`, `bind-*`, `set-local-*`, `reference-gated`, `local-*`) through your validators and `diffTrees`/`applyPatch` before accepting `when`, `bind` or `setLocal`.

```tsx
<TextField label="Filter" onChange={local.set("q")} />
<Row when={ex.contains(r.title, local("q"))} />
```

See [the SDK guide](sdk.md#intents-and-author-constraints), [formats](formats.md) and [spec §8](spec.md#8-interaction-synaptas-three-tiers).

### The surface core

`@arnilo/liveframe/surface` exports `createSurfaceCore`, the framework-independent half of the renderer: arrival validation, revision rules, node contexts, intent completion, confirmation, local state and bindings. `/react` is rebuilt on it and its public API is unchanged: `createRenderer`, `<Surface>`, `implement` and `ImplementationProps` keep their declarations, their behaviour for a tree without `when`, `bind` or `setLocal`, and their cost.
Optional: write a renderer for another framework on the core, or keep using `/react`. A `<Surface>` now applies `setLocal` events itself, never calls `onIntent` for them, hides nodes whose `when` is false and draws the node fallback for a binding that failed.
Hosts need no change. An implementation's `events[...].type` may now read `"setLocal"`.

See [writing another renderer](renderer.md#writing-another-renderer) and [spec §11](spec.md#11-renderer).

### Observability events

`<Surface>` gains an optional `onEvent(event)` prop and `createSurfaceCore` an `onEvent` option. It receives frozen events for rejected arrivals, ignored stale revisions, rejected emits, failed implementations, failed bindings and dropped confirmations; the events hold no prop values.
Optional: pass `onEvent` to log or count what the surface drops silently.
Existing code is unchanged.

See [watch what the surface rejects](renderer.md#watch-what-the-surface-rejects) and [spec §11](spec.md#11-renderer).

### The host pipeline

`@arnilo/liveframe/host` exports `renderPlacement`, the ordered, stateless request-time render: load the placement, bind and resolve its sources as the viewer, skip an unchanged render, run the widget, validate the runner's tree on the host and diff it against the last accepted tree. You inject `store`, `runner` and `resolve`; the library keeps nothing between calls.
Optional: replace hand-rolled request-time orchestration with `renderPlacement`; every composed helper stays public.
Existing code is unchanged. Serialise calls per placement and scope, and keep the returned `Served` per placement to pass back as `previous`.

`handleIntent` is the intent half: `checkOffered`, then your `authorize` (for a `setState` write as for an action), then the write or your `dispatch`, the recorded `actions` map and the re-render. You inject `authorize`, `dispatch` and, for push hosts, `publish`.
Optional: replace hand-rolled intent handling with `handleIntent`; supply `authorize` and `dispatch` and keep the returned `served` and `actions`.
Existing code is unchanged.

`dependents(placements, change)` names the placements that read a changed source, so you can re-render them after an action.
Optional: after an action changes a shared source, re-render the placements `dependents` returns. Keep the `Served` you already store.

See [the host guide](host.md) and [spec §7.7](spec.md#77-the-host-pipeline).

### Checking packages against a new catalog

`checkPackages(packages, { catalog, capabilities, runner? })` from `/pack` reports, per stored package, whether it still verifies and (with a `runner`) renders every scenario to a valid tree under a new catalog. `liveframe check-packages` does the same for a `fileStore` directory.
Optional: before shipping a new catalog, run `checkPackages` (or `liveframe check-packages`) over the packages you keep and decide per package.
Existing code is unchanged.

See [upgrading the catalog](packages.md#upgrading-the-catalog).

### Several catalog majors in one renderer

`createRenderer({ catalogs: [{ catalog, implementations }, …] })` runs the registry check per catalog, and each `<Surface>` draws with the catalog its `validator` was compiled for, so surfaces of `acme.ui@1` and `acme.ui@2` share a page and a registry.
Optional: pass `catalogs` instead of routing surfaces to one renderer per catalog yourself.
Existing code is unchanged: `createRenderer({ catalog, implementations })` works as before.

See [two catalog majors on one page](renderer.md#draw-two-catalog-majors-on-one-page) and [spec §11](spec.md#11-renderer).

### Declarative state migration

A manifest may declare `migrateState`: per state key, a template expression over one root, `previous` (the stored state). When a stored state no longer fits the new version's `state` schema, `loadPlacement`, `verifyPlacementInputs` and `renderPlacement` start from `initialState`, overlay each evaluated key and, if the result fits, return it as `state` with the original failures in `migrated` (and `renderPlacement` raises `state-migrated`) instead of resetting. A failed or non-fitting migration still resets.
Optional: declare `migrateState` in a manifest to carry state across a version change; read `migrated` to persist the migrated state.
Existing code is unchanged: a manifest without `migrateState` resets as before, and results gain an optional field.
Run the `migrate-state-*` manifest corpus cases through your manifest validator before accepting `migrateState`.

See [migrating state](packages.md#migrating-state-across-versions) and [spec §7.4](spec.md#74-storage).

### Package dependencies

A code package whose manifest declares `exports` is a library; a widget imports its names as `import { TaskCard } from "liveframe:lib/<id>@<version>"`. `pack()` takes `libraries`, does not copy their code, emits one `__lf_lib<N>` header line per library after the SDK lines and records `manifest.dependencies` as exact `{ id, version, hash }` pins that the package hash covers. `verifyPackage` accepts `libraries` and checks pins, names and graph bounds; `rebindDependencies` moves the pins to new library versions without transpiling again.
Optional: pack shared components as a library (`exports`) and pass `libraries` to `pack()` and `verifyPackage()`; packages without library fields are unchanged.
Optional: when a library ships a new version, rebind the widgets that use it with `rebindDependencies` and `verifyPackage` instead of repacking from source.
Existing code is unchanged: a package without `exports` or `dependencies` packs, hashes and verifies exactly as before, and `libraries` is optional. A verifier older than this release rejects a manifest with these fields (an unknown field), so it fails closed.
Run the `library-fields-valid`, `dependencies-unsorted`, `library-valid` and `template-with-dependencies` corpus cases and the library vectors in `conformance/hash/library-packages.json` before accepting `exports` or `dependencies`.
Port the package hash over `manifest.dependencies` and check the library vectors before accepting `exports` or `dependencies`.

Runners and stores load them: `Runner.render` takes `options.libraries`, which `loadPlacement` returns as `libraries` (each pin read by `(id, version)`, verified and required to have the pinned hash) and `renderPlacement` passes on. `inProcessRunner` and `workerRunner` load each library once by hash before the widget; a missing library is `not-found` and a hash that differs is `hash-mismatch`. `linkPackage` also rewrites the `__lf_lib<N>` lines, calling `resolve` with the library specifier.
A runner that supplies its own `resolve` should return the module its sandbox loaded for a `liveframe:lib/…` specifier; a callback typed for `SdkSpecifier` only must accept `LibrarySpecifier` too, and code with no library lines links as before
Optional: use `LibrarySpecifier` to type a `resolve` callback that maps library specifiers to modules
Optional: pass `libraries` from `loadPlacement` to `Runner.render` when a package has dependencies; a package without them is unchanged and the result has no `libraries` field.

See [sharing components](packages.md#share-components-between-widgets) and [spec §7.3](spec.md#73-packages).

### Streamed element JSON

`streamElements({ validator, surfaceId, revision?, limits?, maxErrors? })` from `/sdk` draws an agent's element JSON while it is still arriving: `push(chunk)` returns a new valid tree when the nodes completed so far changed, and `end()` returns what `renderElements` returns for the whole text. Trees are numbered `revision + 1`, `revision + 2`, … so a host can send `diffTrees` patches.
Optional: stream an agent's element JSON through streamElements and send diffTrees patches; existing calls are unchanged.

See [the SDK guide](sdk.md#draw-agent-json-while-it-streams) and [spec §7.2](spec.md#72-the-sdk).

### Runner conformance

`runnerSuite({ runner, catalog, capabilities, packages, isolation?, accepts?, timeoutMs?, slackMs? })` from `@arnilo/liveframe/conformance` returns cases that prove a `Runner` against spec §7.5: it renders every scenario of the packages you supply to the tree the reference renderer produces, refuses a package whose hash does not match before loading it, reports a thrown widget, a non-function default and an invalid tree, stops a widget that outlives `timeoutMs` and then renders again, and loads pinned libraries. With `isolation: true` it adds the cases for a runner that claims to contain hostile widget code (host globals, state between renders, infinite loops, memory, recursion, a hold in one native call, forged results). `conformance/runner/fixtures.json` holds the suite's catalog, capabilities, packages and probe table as one document.
Optional: register runnerSuite for the runner you ship or supply
Optional: port the runner contract and isolation cases to a runner in another language
Existing code is unchanged. The reference runners are not isolation boundaries: do not pass `isolation: true` for them. `RunnerSuiteOptions` is the options type.
None

See [conformance](conformance.md#prove-a-runner) and [spec §7.5](spec.md#75-runners-and-preview).
