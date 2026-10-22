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
  space: ["space.0", "space.1"],
  radius: ["radius.control"],
  size: ["size.rail"],
  breakpoints: ["bp.sm"],
});
```

All nine fields are required, and unknown fields are rejected. Each list holds
at most 256 unique names. Names contain at most 64 characters and match
`^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$`. The design-value lists require their family
prefix: `space.`, `radius.`, `size.` and `bp.`. Lists may be empty, and a name may
appear in different categories.

`surfaceRoles` and `fillableRoles` must be subsets of `colourRoles`. `tones`
maps at most 256 tone names to declared colour roles; both keys and values obey
the name rules. For example, `tone: "muted"` refers to the declared
`text.muted` role, whose colour a theme will supply. No colour literal belongs
in a vocabulary.

Malformed structure, names, bounds and duplicates produce `invalid-document`;
undeclared role references produce `unknown-name`. Validation returns at most
20 errors, each with a JSON Pointer. Structural errors are returned before
checking references. The vocabulary's structural schema will be embedded in
the catalog schema; subset and tone reference checks run on install.

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
or tone mappings also requires a major. Pattern changes are conservatively
major when a new pattern remains: arbitrary regex inclusion is not inferred.
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
