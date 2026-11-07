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

### Semantics enums and recipe states follow the vocabulary

Before, a definition's `semantics` enum could hold any values, and a recipe key with an undeclared state failed both the published schema (`invalid-document`) and install (`unknown-name`). After, a string enum prop named `semantics` may hold only the sixteen library values and names declared in `vocabulary.semantics`; any other value is `unknown-name` at the enum item. The published design-system schema now accepts any state name, because it cannot know the catalog's app states, so an undeclared state such as `button.*.root.busy` is `unknown-name` at install only. `RecipeKey` ends in any string, so the compiler no longer rejects an unknown state.

```jsonc
// Before: any enum value passed install
"semantics": { "type": "string", "enum": ["section", "banner"] }
// After: declare each value that is not a library value
"vocabulary": { "semantics": { "banner": { "role": "banner", "description": "Page header." } } }
```

Adopter checklist: list the values in each `semantics` enum and declare every non-library one in `vocabulary.semantics` with an `ariaRoles` role (a minor catalog change). Update design-system ports that rely on the schema alone to reject an unknown state: install now does. Catalogs that use only library values need no change.

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

