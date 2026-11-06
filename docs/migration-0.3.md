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
