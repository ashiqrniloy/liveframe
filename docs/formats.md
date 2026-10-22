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
