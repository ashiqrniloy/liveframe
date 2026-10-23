# Liveframe formats

Liveframe formats are JSON data exchanged between a host, widget authors and
renderers. The root package provides schema builders, TypeScript inference and
validation. It has no runtime dependencies or host API requirements.

## The schema language

Props, params, state, context, action arguments and data-source values share a
closed subset of JSON Schema 2020-12:

| Builder | Value | Constraints |
| --- | --- | --- |
| `str({ maxLength, pattern?, enum? })` | string | Required nonnegative integer length; optional Unicode regular expression and nonempty, unique string enum |
| `num({ minimum?, maximum? })` | finite number | Inclusive numeric bounds |
| `int({ minimum?, maximum? })` | finite integer | Inclusive numeric bounds |
| `bool()` | boolean | No coercion |
| `arr(items, { maxItems })` | readonly array | Required nonnegative integer item limit |
| `obj(required, optional?, annotations?)` | readonly object | Only declared properties; required names come from the first argument |

`num()` and `int()` also work without options. Every form accepts `description`
and `deprecated` annotations in its options; `obj` takes them in its third
argument. The builders return ordinary JSON Schema objects, without wrappers or
hidden metadata. `Infer<typeof schema>` derives a readonly TypeScript value type,
including literal string enums and optional object properties.

```ts
import { checkValue, type Infer, obj, str } from "@arnilo/liveframe";

const Args = obj(
  { id: str({ maxLength: 128, description: "Task identifier." }) },
  { reason: str({ maxLength: 500 }) },
);
type ArgsValue = Infer<typeof Args>;
// { readonly id: string; readonly reason?: string }

checkValue(Args, { id: "t-1" }); // { ok: true, value: { id: "t-1" } }
checkValue(Args, { id: "t-1", extra: 1 });
// { ok: false, errors: [{ kind: "invalid-document", pointer: "/extra", ... }] }
```

`checkValue(schema, value, maxErrors = 20)` interprets the schema without running
generated code. It returns the original value on success and collects failures
up to the bound. `maxErrors` must be a positive integer; an invalid bound throws
`RangeError`. Strings are measured in Unicode code points: `"👍👍"` has length
two. The interpreter skips counting when the UTF-16 length already fits.
Patterns use the Unicode `u` flag and must compile and contain at most 256 code
points. Unknown properties, coercion and undeclared keywords are rejected.

Use `isLanguageSchema(json)` to check schema data from an untrusted source. It
rejects missing string or array bounds, open objects, `$ref`, unsupported
keywords, malformed constraints, invalid patterns, and required names absent
from the object's properties. `checkValue` performs this check too. Internal
publishing forms such as constants and pattern-keyed records are outside the
author language.

## Vocabulary

A catalog's vocabulary declares the names its widgets may use. Apps choose the
names; the library fixes their categories. `validateVocabulary(doc)` accepts an
unknown value and returns `Result<Vocabulary>`, preserving the original object
on success.

```ts
import { validateVocabulary } from "@arnilo/liveframe";

validateVocabulary({
  colourRoles: ["surface.base", "text.muted"],
  surfaceRoles: ["surface.base"],
  fillableRoles: [],
  tones: { muted: "text.muted" },
  typographyRoles: ["body"],
  surfaceTypography: "body",
  space: ["space.0", "space.1"],
  radius: ["radius.control"],
  size: ["size.rail"],
  breakpoints: ["bp.sm"],
});
```

All ten fields are required, and unknown fields are rejected. Each list holds
at most 256 unique names. Names contain at most 64 characters and match
`^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$`. The design-value lists require their family
prefix: `space.`, `radius.`, `size.` and `bp.`. Lists may be empty, and a name may
appear in different categories.

`surfaceRoles` and `fillableRoles` must be subsets of `colourRoles`. `tones`
maps at most 256 tone names to declared colour roles; both keys and values obey
the name rules. For example, `tone: "muted"` refers to the declared
`text.muted` role, whose colour a theme will supply. No colour literal belongs
in a vocabulary.

`surfaceTypography` names one role in `typographyRoles` for every surface root's
base typography. It obeys the same bounded name rules and must be declared,
so `typographyRoles` must contain at least that role.

Malformed structure, names, bounds and duplicates produce `invalid-document`;
undeclared role references produce `unknown-name`. Validation returns at most
20 errors, each with a JSON Pointer. Structural errors are returned before
checking references. The vocabulary's structural schema is embedded in
the catalog schema; subset, tone and surface typography reference checks run on install.

The root export also provides the library-fixed `states`, `styleProps`,
`semantics` and `recipeProperties` arrays. These are format vocabulary, with no
app roles or design values. Recipe motion uses `translateY`; the proof's
`transformPreset` shorthand is not part of the format.

## Definitions and catalogs

A catalog is the app's versioned primitive contract. `defineComponent` preserves
literal kinds, variants and events for SDK generation; `validateCatalog` checks
unknown JSON on install. A definition's `props` is a closed language object
schema, built with `obj(required, optional)`.

```ts
import { defineComponent, obj, str, validateCatalog } from "@arnilo/liveframe";

const Button = defineComponent({
  kind: "button",
  description: "Runs an intent when pressed.",
  props: obj({ label: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default", "primary"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: { onPress: { carries: "none", description: "Pressed by pointer or keyboard." } },
  styleProps: ["width", "grow"],
  a11y: { role: "button", name: "label" },
});

validateCatalog({
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "The app's primitives.",
  vocabulary, // a vocabulary document as shown above
  definitions: [Button],
});
```

Catalogs contain at most 256 definitions. Their id is at most 128 characters
and matches `^[a-z][a-z0-9.-]*@[1-9][0-9]*$`. Kinds are unique. Kind, variant,
slot and child-kind tokens match `^[a-z][A-Za-z0-9-]*$` and have at most 64
characters. Descriptions and the optional primitive `deprecated` explanation
have at most 500 code points. Prop schemas may carry the language's boolean
`deprecated` annotation and a replacement explanation in `description`.

Each definition requires all fields in the example. Variant and slot lists
contain at most 256 unique tokens; `defaultVariant` must be declared and slots
must include `root`. `styleProps` is a unique subset of the exported fixed list.
`a11y.role` is a lowercase token of at most 32 characters; the optional
`a11y.name` names a string prop. Children are `"none"`, `"any"`, or at most 256
`{ kind, min, max }` rules with unique declared kinds and nonnegative integer
counts, where `min <= max`.

An event map has at most 256 entries. Names match `^on[A-Z][A-Za-z]*$` and have
at most 64 characters. Each event requires `carries` (`none`, `string` or
`boolean`) and a description. Unknown fields and invalid schemas fail closed.
Malformed structure returns `invalid-document`; unresolved references return
`unknown-name`. Errors are bounded to 20 and point into the catalog, including
its vocabulary. Success preserves the input object.

`classifyCatalogChange(prev, next)` accepts two validated catalogs and returns
`{ level: "major" | "minor" | "none", reasons: string[] }`. A `major` result
requires a new major in `catalogId`, even if the inputs currently share an id.
The classifier reports contract changes; it does not edit ids or enforce a bump.

| Change | Level |
| --- | --- |
| Remove a kind, prop, variant, slot, event or vocabulary name | major |
| Narrow a schema type, enum or bound; make a prop required | major |
| Change an event's carried value | major |
| Add a kind, optional prop, variant, slot, event or vocabulary name | minor |
| Widen a schema or make a required prop optional | minor |
| Change descriptions or deprecation annotations; reorder lists | none |

Nested object and array schemas use the same rules. Removing style props,
tightening child rules, changing default variants, accessible-name contracts
or tone mappings, or changing `surfaceTypography`, also requires a major.
Pattern changes are conservatively major when a new pattern remains:
arbitrary regex inclusion is not inferred.
Changing only the catalog id produces `none`.

`@arnilo/liveframe/schemas/catalog.json` embeds the vocabulary and schema
language in `$defs`. It checks document structure; install validation also
checks references, unique kinds, required schema-name membership and child
count relationships. The 24-kind performance fixture is regenerated with
`timeout 20s bun proof/scripts/export-catalog.ts`; it adds metadata, derives
bounds for enum-only proof strings and renames textField's `onSubmit` to
`onCommit`. The full proof-format exporter is a later plan task.

## Validation errors

Every validator uses `Result<T>`:

```ts
type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly LiveframeError[] };
```

`LiveframeError` contains `kind`, `pointer`, `message`, an optional `expected`
rule, and an optional `nodeId` for errors associated with a UI node. Pointers use
JSON Pointer escaping (`~` becomes `~0`, `/` becomes `~1`); the document root is
the empty string. Missing properties point to the missing property's location.

The install-time kinds are `invalid-document`, `unknown-name`,
`incomplete-design-system`, `colour-outside-theme`, `catalog-mismatch` and
`cyclic-extends`. Tree and rendering errors use the kinds in spec §7.2. The
generic interpreter reports `invalid-document`.

## Published JSON Schemas

The language's structural meta-schema is available at
`@arnilo/liveframe/schemas/schema-language.json`. It declares the 2020-12 dialect
and a stable `$id`. Configure your validator to check the standard `regex`
format if you need pattern syntax validation. Install-time validation also
checks semantic relationships such as required names referring to declared
properties; the structural meta-schema alone does not check that relationship.

Schemas come from `src/formats/registry.ts`. To regenerate or verify them:

```sh
bun scripts/schemas.ts
bun scripts/schemas.ts --check
```

The check command fails on missing, changed or unregistered JSON files. Tests
compare each file to its source and compile it with Ajv 8 in strict mode. Ajv is
a development dependency used as an independent test oracle.

## UI trees and intents

`UiTree`, `UiNode`, `Intent` and `Json` are readonly types exported from
`@arnilo/liveframe`. A tree is JSON data: each render sends the entire tree,
and the renderer uses stable node ids to preserve local state.

```ts
import { LIVEFRAME_FORMAT, type UiTree } from "@arnilo/liveframe";

const tree: UiTree = {
  format: LIVEFRAME_FORMAT, // "liveframe/1"
  catalogId: "acme.ui@1",
  surfaceId: "main",
  revision: 1,
  root: {
    id: "root",
    kind: "textField",
    props: { label: "Reason" },
    events: {
      onCommit: {
        type: "action",
        name: "tasks.escalate",
        args: { id: "t-4812" },
        bind: "reason",
      },
    },
  },
};
```

Every node requires `id`, `kind` and `props`; `variant`, `style`, `events` and
`children` are optional. Props, style values and action arguments contain only
JSON values. Each event carries one intent:

- `{ type: "setState", key, value? }`: an absent `value` uses the event's
  value; an explicit `null` sets null.
- `{ type: "action", name, args, bind? }`: `args` is required, even when empty.
  `bind` names the argument filled by the event's value; it carries no value
  or authority. The host checks and authorises the completed arguments.

The catalog-independent schema is published at
`@arnilo/liveframe/schemas/ui-tree.json`. It rejects unknown tree, node and
intent fields, unknown intent types, and `bind` on a state intent. Revision
is a nonnegative integer. Catalog ids use the catalog format's grammar;
kind and variant names use its 64-character token grammar. Surface ids,
state keys and bound argument names are nonempty strings of at most 128
code points; action names use the capabilities format's grammar.

Ids start at `root` and append nonempty slash-separated key segments, such as
`root/queue/row:4812/claim`. Segments contain letters, digits, `_ . ! ~ * ' ( ) : -`
or uppercase percent escapes such as `%2F`. The schema recursively checks
children and JSON values without imposing fixed node, depth or byte limits.
Catalog membership, prop schemas, allowed style props, event declarations,
argument types, id uniqueness and parent relationships, and configurable
render limits require the compiled validator described below. Structural
schema validation alone does not establish those guarantees.

## Validation

Compile once when the host loads a catalog, its capabilities and a widget's
manifest. The catalog includes its vocabulary. Recompile when any of these
documents changes; reuse the compiled validator across renders for that set.
`compileValidator` checks all three documents with the install validators before
building closures over their schemas and declared names. Invalid documents
throw an `Error` whose message is the JSON-encoded install errors; compilation
does not return a `Result`. No `eval` or `Function` constructor is used.

```ts
import { compileValidator, type ValidateTreeOptions } from "@arnilo/liveframe";

// Documents loaded by the host; tree is an unknown value at the boundary.
const validator = compileValidator({ catalog, capabilities, manifest });
const options: ValidateTreeOptions = {
  limits: { nodes: 5000, depth: 64, bytes: 1048576 },
  maxErrors: 20,
};
const result = validator.validateTree(tree, options);
if (result.ok) {
  // result.value is the original tree, typed as UiTree; it is not frozen.
} else {
  // Give result.errors to the author or agent, then validate the repaired tree.
}
```

Run `validateTree` on every render before the tree leaves the backend, and
again on arrival in the renderer. It checks metadata, catalog membership,
props, variants, styles, event intents, children, unique key-path ids and
limits. Unknown fields and undeclared names fail closed. Strings are bounded
in Unicode code points, and action bindings must match the event's carried
type while omitting the bound argument from `args`.

| Option | Default | Meaning |
| --- | --- | --- |
| `limits.nodes` | 5,000 | Maximum total UI nodes |
| `limits.depth` | 64 | Maximum node levels; the root is level 1 |
| `limits.bytes` | 1,048,576 (1 MiB) | UTF-8 length of `JSON.stringify(tree)`, counted without serialising |
| `maxErrors` | 20 | Maximum collected errors before stopping the walk |

Options are per call; omitted limits use their defaults. Each option must be a
positive safe integer, or validation returns `invalid-prop`. Hitting a tree
limit returns `limit-exceeded`. Reaching `maxErrors` stops traversal and appends
one extra `limit-exceeded` error with
`expected: "fix the errors above and validate again"`; there may therefore be
`maxErrors + 1` errors.

Failures return `Result<UiTree>` with `LiveframeError` entries. Each entry has
`kind`, `pointer`, `message`, optional `expected`, and optional `nodeId`.
`pointer` is an escaped JSON Pointer into the tree; `nodeId` identifies the
affected UI node. For example, using the button definition above, an agent
submits a root node with `props: { label: 7 }` and receives:

```json
{
  "kind": "invalid-prop",
  "nodeId": "root",
  "pointer": "/root/props/label",
  "message": "Expected string of at most 80 characters",
  "expected": "string of at most 80 characters"
}
```

The agent changes that node's props to `{ label: "Claim" }`, preserving its id,
then calls `validateTree` again. Only a successful result is sent for display;
the next run may reveal further errors if collection stopped at the bound.

The root also exports `CompileValidatorOptions`, `CompiledValidator`,
`ValidateTreeOptions`, `NodeCheck`, `NodeCheckSink`, `Result` and
`LiveframeError`. `validator.checkNode(node, pointer, sink)` returns a boolean
and appends bounded errors to `{ errors: LiveframeError[], maxErrors: number,
nodeId?: string }`. It supplies per-node checks for a builder; it does not
check tree metadata, parent relationships, unique ids, child-kind counts or
whole-tree limits. Use `validateTree` at transport boundaries.

Validation is not authorisation. An action matching the capabilities and
manifest is still only a request. On dispatch, the host fills any bound event
argument, re-checks the completed arguments against the capability schema,
and authorises the operation as the current viewer.

## Capabilities

The host publishes the operations a widget may request. `validateCapabilities(doc)` returns a `Result<Capabilities>` and checks the closed document, bounded descriptions and schema language. Action arguments and source parameters are object schemas; source results may use any language schema.

```ts
const capabilities = {
  format: "liveframe-capabilities/1",
  actions: {
    "tasks.claim": { description: "Claim a task", args: obj({ id: str({ maxLength: 128 }) }), confirm: true },
  },
  sources: {
    "tasks.queue": {
      description: "Read the next page of tasks",
      params: obj({ cursor: str({ maxLength: 128 }) }),
      result: arr(obj({ id: str({ maxLength: 128 }) }), { maxItems: 50 }),
    },
  },
} as const;
validateCapabilities(capabilities);
```

Each map holds at most 512 entries. Names start with a lowercase letter and contain letters or digits, optionally separated into dot segments (`tasks.queue`); names are at most 128 characters. Descriptions are at most 500 code points. `confirm` is optional descriptive metadata. Capabilities carry no authority: the host authorises every read and action as the viewer and re-checks action arguments on dispatch.

## Manifest

`validateManifest(doc, { catalog, capabilities })` takes an installed, validated catalog and capabilities. It checks the catalog identity, declared operations, initial state and source parameter bindings. The result preserves the original document on success and reports up to 20 errors with JSON pointers on failure.

```ts
const manifest = {
  format: "liveframe-manifest/1",
  id: "task-list",
  version: "1.0.0",
  catalogId: catalog.catalogId,
  params: obj({}),
  state: obj({ cursor: str({ maxLength: 128 }) }),
  context: obj({}),
  initialState: { cursor: "start" },
  sources: {
    queue: { source: "tasks.queue", params: { cursor: { from: "state", path: "cursor" } } },
  },
  actions: ["tasks.claim"],
} as const;
validateManifest(manifest, { catalog, capabilities });
```

`params`, `state` and `context` are closed language object schemas. Source parameters accept literals checked against the capability's parameter schema, or `{ from: "params" | "state" | "context", path }`. An object with a `from` field is interpreted as a binding. Paths traverse object properties only, with at most eight identifier segments; array indices and expressions are rejected. A binding's schema type must equal the destination type. Bound values still need checking against the destination's bounds when the host resolves them. Every required source parameter must be supplied; extra parameters are errors.

Manifest ids start with a lowercase letter and contain letters, digits, dots or hyphens (128 characters maximum). Versions are nonempty bounded strings, with no enforced versioning scheme. Source keys follow capability naming rules; there are at most 512 sources and 512 distinct actions. The catalog id must match exactly. A manifest describes requests and never grants permission.

Published structural schemas are available as `@arnilo/liveframe/schemas/capabilities.json` and `@arnilo/liveframe/schemas/manifest.json`. Cross-document names, binding resolution and initial-state validation require the corresponding validator.

## Theme

`validateTheme(doc, vocabulary)` checks a resolved theme against an installed,
validated vocabulary. The theme supplies every declared colour and typography
role exactly once. Missing or undeclared roles return `unknown-name`; malformed
values return `invalid-document`. Success preserves the input object, and
failure returns at most 20 errors with escaped JSON Pointers.

```ts
import { type Theme, validateTheme } from "@arnilo/liveframe";

const theme: Theme = {
  format: "liveframe-theme/1",
  id: "daylight",
  version: "1.0.0",
  colorScheme: "light",
  colours: {
    "surface.base": { colorSpace: "oklch", components: [0.966, 0.01, 172] },
  },
  typography: {
    body: {
      fontFamily: ["Inter", "sans-serif"],
      fontSize: { value: 14, unit: "px" },
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: { value: -0.01, unit: "em" },
    },
  },
};
validateTheme(theme, vocabulary); // vocabulary declares these two roles
```

Themes are closed documents. Ids follow manifest id rules, versions are
nonempty strings of at most 128 code points, and `colorScheme` is `light` or
`dark`. Each role map holds at most 256 vocabulary names. Light and dark themes
are separate documents; apps choose how to assemble and select them.

Colours follow [DTCG 2025.10 §4.2](https://www.designtokens.org/tr/2025.10/color/#supported-color-spaces):
`srgb`, `srgb-linear`, `hsl`, `hwb`, `lab`, `lch`, `oklab`, `oklch`,
`display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d65` and `xyz-d50`.
Exactly three components are required, each a finite number or `"none"`.
RGB and XYZ channels are in `[0, 1]`; HSL/HWB percentages and Lab/LCH lightness
are in `[0, 100]`; OKLab/OKLCH lightness is in `[0, 1]`. Hue is in `[0, 360)`.
Lab/OKLab axes allow any finite signed number, and LCH/OKLCH chroma any finite
nonnegative number: DTCG's typical magnitudes are not upper bounds. Optional
`alpha` is in `[0, 1]`; optional `hex` is six hexadecimal digits prefixed by
`#`. CSS colour strings and unknown fields are rejected.

Typography uses resolved [DTCG composite values](https://www.designtokens.org/tr/2025.10/format/#typography)
with the optional fields from spec §6.1. Token references are resolved before
installation. The required fields are `fontFamily`, `fontSize`, `fontWeight`
and `lineHeight`; `letterSpacing` is optional under Liveframe's spec.

| Field | Accepted value |
| --- | --- |
| `fontFamily` | One font name or a nonempty ordered list of at most 8 names; each name is 1–128 code points |
| `fontSize` | `{ value, unit }`, value in `[0, 4096]`, unit `px` or `rem` |
| `fontWeight` | Number in `[1, 1000]` or a DTCG weight alias |
| `lineHeight` | Multiplier in `[0, 10]` |
| `letterSpacing` | Optional dimension in `[-1024, 1024]`, unit `px`, `rem` or `em` |
| `textTransform` | Optional `none` or `uppercase` |
| `fontStretch` | Optional numeric percentage in `[50, 200]`, such as `87.5` |
| `fontSizeAdjust` | Optional ex-height factor in `[0, 10]` |

Font names are plain data, never CSS fragments: semicolons, braces, backslashes,
ASCII control characters and `url(` (case insensitive, allowing whitespace)
are rejected. Give fallbacks as a list of individual names. Weight aliases
are DTCG's exact lowercase names, from `thin`/`hairline` through
`extra-black`/`ultra-black`; numeric weights may be fractional.

`@arnilo/liveframe/schemas/theme.json` checks the same structure, bounds and
colour-space ranges. Vocabulary completeness and undeclared roles require
`validateTheme`. The theme is the sole colour source; a design system will
reference its roles. CSS projection and font loading belong to later phases
and the host respectively.

## Design systems and recipes

`DesignSystem` is a `liveframe-design-system/1` document with `id`, `version`,
optional `extends` (a registry id), `values`, and `recipes`. Install with
`validateDesignSystem(document, { catalog, registry })`. The catalog and registry
are host-supplied; registry keys equal their documents' ids. Ancestors may be
partial, but the merged system must cover the catalog's vocabulary and recipes.
Validation returns the original document or up to 20 pointed install errors.

```ts
import { resolveRecipes, validateDesignSystem } from "@arnilo/liveframe";

const result = validateDesignSystem(document, { catalog, registry });
if (result.ok) {
  const recipes = resolveRecipes(result.value, { catalog, registry });
  // recipes["button.primary.root.hover"] is a resolved property object.
}
```

A named value is `{ kind, value }`. Its value follows the corresponding
[DTCG 2025.10 shape](https://www.designtokens.org/tr/2025.10/format/):

| Kind | Value and Liveframe bounds |
| --- | --- |
| `radius`, `border-width`, `spacing`, `size`, `breakpoint`, `backdrop-blur` | `{ value, unit: "px" \| "rem" }`, value 0–16384 |
| `motion-duration` | `{ value, unit: "ms" \| "s" }`, value 0–60000 |
| `easing` | Four coordinates `[x1, y1, x2, y2]`; x in 0–1, y in −100–100 |
| `opacity` | Number in 0–1 |
| `saturation` | Number in 0–10 (1 means unchanged) |
| `shadow` | One layer or at most 16 layers; each has `color`, `offsetX`, `offsetY`, `blur`, `spread`, optional `inset` |

Shadow `color` names a declared theme role; literal colours are rejected.
Offsets and spread are dimensions in −16384–16384; blur is nonnegative.
To vary shadow alpha, define theme roles with the desired alpha and reference
those roles. Names have at most 64 characters and use lowercase dotted segments.
Maps hold at most 1024 design values and 16384 recipes. All numbers must be finite.
The system must supply every declared `space`, `radius`, `size` and breakpoint
name with its matching kind.

Recipe keys are `kind.variant.slot.state`; `*` in the variant position applies
to every variant. Keys must name catalog kinds, variants and slots, and a fixed
Liveframe state. Recipes accept only the exported `recipeProperties` list:

| Properties | Accepted value |
| --- | --- |
| `backgroundColor`, `textColor`, `borderColor`, `outlineColor` | Declared theme colour role only |
| `typography` | Declared typography role only |
| `borderWidth`, per-side border widths, `outlineWidth` | `border-width` reference or dimension |
| `borderRadius` | `radius` reference or dimension |
| `padding`, `paddingX`, `paddingY`, `gap` | `spacing` reference or dimension |
| `outlineOffset`, `translateY` | `spacing` reference or signed dimension |
| `borderStyle`, `outlineStyle` | `solid`, `dashed` or `none` |
| `opacity`, `backgroundOpacity` | `opacity` reference or number |
| `shadow`, `backdropBlur`, `backdropSaturate`, `transitionDuration`, `transitionTiming` | Respectively `shadow`, `backdrop-blur`, `saturation`, `motion-duration`, `easing` reference or literal |

A reference is a plain design-value name, such as `radius.control`; inline
literals follow the shapes above. No property accepts raw CSS or selectors.

```json
{
  "button.*.root.rest": { "borderRadius": "radius.control", "padding": "space.2" },
  "button.primary.root.rest": { "backgroundColor": "accent.fill" },
  "button.*.root.focus": { "outlineColor": "focus.ring", "outlineWidth": { "value": 2, "unit": "px" } }
}
```

Inheritance merges parent values first, then child values; matching recipe keys
merge per property, with child properties winning. Recipe resolution then merges
wildcard rest, variant rest, wildcard state, variant state, in that order.
All states resolve to rest plus their optional overlays. Every variant and slot
needs a rest entry (an empty object counts); each interactive kind needs a focus
overlay in at least one slot for each variant. A wildcard focus satisfies all
variants. Validation reports missing entries as `incomplete-design-system` and
cycles as `cyclic-extends`.

`resolveRecipes` returns the flat table for every catalog variant, slot and state.
It replaces design-value references with DTCG literals, preserving colour and
typography role names. It does not mutate its inputs. Call it after validation;
invalid input throws an error containing the install errors. The published
`@arnilo/liveframe/schemas/design-system.json` checks structure and bounds;
installation additionally checks names, references, inheritance and completeness.

## Package and storage transport formats

Package and scenario types and validators are exported from `@arnilo/liveframe/pack`:
`WidgetPackage`, `Scenario`, `validateWidgetPackageShape(doc)` and `validateScenario(doc)`.
Placement and style record types and validators are exported from `@arnilo/liveframe/store`:
`Placement`, `StyleRecord`, `validatePlacement(doc)`, `validateStyleRecord(doc)` and `validateState(doc)`.
Each validator returns `Result<T>` with at most 20 pointed `invalid-document` errors.

A package has `format: "liveframe-package/1"`, a manifest, code, 1–64 scenarios and a
`sha256-` hash followed by 64 lowercase hexadecimal digits. Code is limited to
1 MiB of UTF-8 bytes. Scenario names are non-empty, unique within the package and
at most 128 code points. A scenario contains `name`, `params`, `context`,
`data` (a map of source names to JSON values), and optional `state`.

A placement contains `id`, `slot`, `widget: { id, version }` and JSON `params`.
A style record contains `kind: "theme" | "designSystem"`, `id`, `version` and
JSON `body`. State is any JSON value, stored separately under the placement id.
Record names and versions are non-empty strings of at most 128 code points;
widget and style ids use the manifest id grammar. Unknown envelope fields,
non-JSON values, cycles and non-finite numbers are rejected.

The published schemas are `@arnilo/liveframe/schemas/widget-package.json`,
`placement.json` and `style-record.json` under the same schemas subpath.
The package schema references `manifest.json` by its published `$id`; register
that schema with your JSON Schema validator too. Scenario and JSON value schemas
are embedded. Standard JSON Schema cannot enforce unique scenario names or a
UTF-8 byte bound, so use the structural validator for those checks.

These checks establish transport structure. They do not execute code, verify the
hash, compare scenario inputs with manifest schemas, or install style bodies.
Package verification and theme/design-system installation must apply those checks
before the host uses the records.
