# Migrating to 0.3.0

0.3.0 is a minor release under the [compatibility policy](compatibility.md). It may break contracts from 0.2.3. Each implemented break is registered against the 0.2.3 API baseline and documented here with before and after behaviour, a code sample and an adopter checklist.

This guide grows as the 0.3.0 tasks land. An empty section below means no breaking changes have landed yet; planned changes are listed in [compatibility](compatibility.md#deferred-to-030). The [spec](spec.md) defines the current contracts and the [changelog](../CHANGELOG.md) records shipped changes.

## Breaking changes

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
