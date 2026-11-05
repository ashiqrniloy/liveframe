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

## Compatible additions

### Preview and authoring validation limits

Optionally set limits; defaults remain unchanged. `createPreview()`, `createAuthoring()` and the MCP config accept `limits: { nodes: 20_000 }`, with optional positive safe integers for `nodes`, `depth` and `bytes`. Limits apply to both the runner and host validation. Invalid limits report `invalid-document` at `/limits` during construction (MCP exits 2). Authoring tool response and capture bounds remain unchanged. See [preview](preview.md) and [MCP](mcp.md) for details.
