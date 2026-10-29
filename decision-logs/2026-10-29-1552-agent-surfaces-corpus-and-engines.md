---
date: 2026-10-29 15:52
status: approved
decision_about: "Ephemeral agent surfaces (LF-16), tree-patch measurement (LF-17), the conformance corpus and hash vectors (CL-06), and WebKit/Firefox verification"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Agent surfaces, the conformance corpus and engine verification

## Decision

Plan 019 settles four areas as follows.

- **LF-16 — element JSON.** An agent emits a JSON document of elements shaped `{ kind, key?, variant?, props?, style?, events?, children? }`. Intents use the existing `Intent` shape. Ids are `render()`'s key-path ids: the root is `root`; every other id is its parent id plus `/` plus `encodeSegment(key ?? kind)`. `key` is an optional string or finite number; siblings whose derived segment repeats fail with `missing-key` (unkeyed) or `duplicate-key` (keyed), exactly as `render()` does for lists. Bounds are `render()`'s `DEFAULT_LIMITS` (5,000 nodes, depth 64, 1 MiB of output-tree JSON) and the 20-error bound. `renderElements(input: unknown, options): Result<UiTree>` lives in `src/sdk/elements.ts`, exported from `@arnilo/liveframe/sdk` beside `render()`, runs on the backend, validates every node in the same pass that builds it, and rewrites every error `pointer` to point into the element JSON (with `nodeId` still the derived key-path id). `type Elements<Catalog>` is the typed form for hosts that build the JSON themselves.
- **LF-16 — ephemeral manifests.** `ephemeralManifest({ catalogId, actions, state? })` lives in `src/sdk/elements.ts` and returns a `Manifest` accepted by `validateManifest`: fixed `id: "ephemeral"`, fixed `version: "0"`, empty `params`/`context` object schemas, empty `sources`, the given action names, and a state schema derived from `state` (default `{}`) by a small deterministic value-to-schema function (every key required; string, number, integer, boolean, array and object only; `null` is rejected as `invalid-document`). It is never stored as a package and never persisted; a host that wants a stored surface authors a real package.
- **LF-16 — generated schema.** `generateElementsSchema(catalog)` ships from `/sdk/gen`; `liveframe gen <catalog> --elements-schema --out <file> [--check]` writes it. It is one JSON Schema 2020-12 document with `$id: "urn:liveframe:elements:1"`, a discriminated `oneOf` over `kind` (one branch per catalog definition in catalog declaration order), each branch embedding that definition's props schema, its declared style-prop names, its variant enum, its declared events whose values are the `Intent` union, and recursive `children`. `--check` compares bytes, like `scripts/schemas.ts`. `/authoring` gains no tool: a host wires `renderElements` into its own agent tool.
- **LF-17 — the measurement.** Task 3 streams a synthetic 679-node, 50-row agent surface (the proof agent-home size, spec §7.1's realistic size) expressed as element JSON through `renderElements` → JSON → `<Surface>` arrival validation → React commit at a target 10 revisions/second, 100 revisions, changing one row's status per revision. It records, per revision: JSON bytes before and after gzip, the summed changed-value bytes as a patch floor, arrival-validation time, and React commit time from the Profiler. Patches are designed only if a gzipped whole-tree update exceeds 1 KiB (Clay's update budget) at 10 updates/s, or if arrival validation plus commit exceeds 8 ms per update (half a 60 Hz frame) on the recorded machine. Otherwise compression stands, per spec §9.
- **CL-06 — the corpus.** `conformance/corpus/<format>/<case>.json` holds cases for `catalog`, `theme`, `design-system`, `capabilities`, `manifest`, `ui-tree`, `package`, `placement`, `style-record` and `elements`, with shared documents under `conformance/corpus/common/`. Each case is exactly `{ inputs, options, expect }`. `inputs.doc` names the document under test; every other `inputs` entry names a supporting document by role (`catalog`, `capabilities`, `manifest`, `theme`, `designSystem`, `vocabulary`, `manifest`); paths are relative to the case file and may not escape the corpus root. `options` is `{}` except for `maxErrors` and `limits` on `ui-tree`/`elements` cases. `expect` is `{ "ok": true }` or `{ "ok": false, "errors": [{ "kind", "pointer" }] }`; errors match on `kind` and `pointer` only, as an unordered set, and the set is exactly what the reference validator returns inside the 20-error bound. `elements` cases run `renderElements` with fixed `surfaceId: "corpus"` and `revision: 1` and compare errors only.
- **CL-06 — hash vectors.** `conformance/hash/*.json` files each hold a JSON array of `{ value, canonical, sha256 }` vectors, where `sha256` is the 64 lowercase hex digits of the UTF-8 canonical string (no `sha256-` prefix). Rejected inputs are `{ value, rejected }` with `rejected: "lone-surrogate" | "non-finite-number"`; the test expects `canonicalJson` to throw `TypeError`. Because JSON cannot carry a non-finite number or an unpaired surrogate as plain data, any value position may use the tagged escape `{ "$liveframe": "number", "value": "NaN" | "Infinity" | "-Infinity" }` or `{ "$liveframe": "string", "codeUnits": ["D800", …] }` (hex UTF-16 code units). A literal `$liveframe` key is therefore not representable in a vector; it never occurs in a format document.
- **Engines.** There is no Playwright Test runner. The existing Bun browser-test helper takes one browser parameter, `LIVEFRAME_BROWSER=chromium|webkit|firefox` (default `chromium`), launching `chromium`, `webkit` or `firefox` from Playwright. CI installs `chromium webkit firefox` with `bunx playwright install --with-deps` and runs the browser suites once per value. Registration in another test runner is **not** verified in this plan: Vitest under Bun would need Vite/Node-targeted tooling and a second module-blocking preload implementation (`vi.mock`/alias) to re-prove `no-playwright` and `no-mcp-sdk`, which use Bun's `mock.module`; the backlog item stays open, narrowed to "a runner with an equivalent blocking preload". The two preload tests are re-proved under Bun by running each suite with and without its `--preload` and showing the without-run fails.

## Context

Plan 019 implements LF-16, LF-17 and CL-06 and closes the engine part of the conformance backlog. Three problems forced choices the spec leaves open:

1. **Element JSON is a new input format.** Law 2 says the host validates every tree it serves. An agent's JSON is untrusted and has no widget function, so it needs a builder that reuses `render()`'s emitter, ids, limits and error kinds rather than a second tree builder. It also needs a manifest that the browser's existing arrival check can compile, without inventing a second manifest format.
2. **Patches are deferred by spec §9** until a realistic measurement calls for them. The measurement has to be fixed before it runs, or the result cannot approve or reject a design.
3. **The corpus and hash vectors are a contract for non-JavaScript ports.** They must be plain data, stable in diffs, runnable by the library's own suite, and versioned with the formats. Error messages cannot be matched because a port phrases its own; only `kind` and `pointer` are normative.

The relevant constraints are law 1 (widget code never runs in the browser; `renderElements` runs on the backend), law 2 (one-pass validation of untrusted data), law 4 (the host re-checks intents), spec §7.1/§7.2/§9/§10/§13, and AGENTS.md's Bun-only tool rule.

## Approval

- Proposed by: agent, from plan 019 Task 1's acceptance criteria.
- Approved by user: Yes.
- Approval evidence: on 2026-10-29 the user wrote, "Complete - [ ] Task 1: Record the agent-surface, corpus and engine-verification decisions from @plans/019-Phase-7-Part-F-Agent-Surfaces-Conformance-Corpus-And-Engines.md and update the plan once done". That instruction adopts the plan's enumerated decisions as the record to finalize, the same wording used to approve `decision-logs/2026-10-29-1244-runner-kit-capture-and-authoring-library.md`.

## Alternatives Considered

1. **Let an agent emit a `UiTree` directly** — rejected: ids are key paths the SDK derives, and an agent cannot reliably derive or keep them stable. LF-16's own problem statement names this.
2. **A second tree builder for element JSON** — rejected: it would duplicate ids, limits, structure rules and error messages and could drift from `render()`. `renderElements` reuses the emitter and validator plumbing in `src/sdk/render.ts`.
3. **Required `key` on every element in the JSON** — rejected: the SDK requires keys only for dynamic lists; static children derive their segment from `kind`. In JSON there is no static/dynamic distinction, so the fail-closed rule is "derived segments must be unique", with `missing-key`/`duplicate-key` as `render()` already reports them.
4. **Point element-JSON errors at the output tree** — rejected: an agent edits the JSON, not the tree. Pointers are input pointers; `nodeId` still names the derived node.
5. **`ephemeralManifest` in `src/formats/manifest.ts`** — rejected: it is an agent-surface convenience, not a format validator, and `/sdk` already owns the render path it serves. Keeping it out of the format module leaves that module free of constructors.
6. **`state?` as a `LanguageSchema`** — rejected: `validateManifest` also needs an `initialState` that matches it, and the signature carries no initial value. A value-to-schema derivation is smaller and produces a valid pair; `null` state is rejected rather than given a schema form the language does not have.
7. **A separate `elements` JSON Schema file published under `/schemas`** — rejected: the schema depends on one catalog's definitions, so it cannot be a package-wide published schema. It is generated per catalog, with a byte-level drift check.
8. **Matching corpus errors on `message`** — rejected: ports phrase messages themselves; only `kind` and `pointer` are normative.
9. **Generating the corpus at build time** — rejected: it must be stable, reviewed data in diffs. Cases are committed JSON.
10. **Encoding rejected hash inputs as bare JSON text** — rejected: JSON has no NaN/Infinity literal, and an unpaired surrogate in an escape is not portable across strict parsers. The small `$liveframe` tagged escape is explicit and parseable in every language.
11. **Playwright Test projects** — rejected: the repository runs `bun test` and launches Playwright directly; adopting `@playwright/test` would add a second test runner and configuration layer for one parameter. The existing helper takes the engine name.
12. **Vitest under Bun in this plan** — not selected: it needs Vite/Node-targeted tooling (AGENTS.md's Bun-only rule) and a second preload mechanism to re-prove the two blocked-peer tests, which the backlog note requires of any verified runner. Kept in the backlog, narrowed.
13. **A WebKitGTK/WebDriver setup for Clay's real engine** — rejected for library CI: Playwright's WebKit build is the portable nearest engine; Clay verifies its own webview through CL-05's backend. Task 6 records the engine versions and any recorded limitation in the evidence.

## Rationale and Evidence

### Element JSON and `renderElements`

`src/sdk/render.ts` already owns the one-pass emitter: it derives ids at `:362` and `:407`, checks duplicate segments and `ids` at `:408-414`, applies `budget.nodes`/`budget.depth` at `:415-419`, rewrites nested validator pointers at `:498`, and counts bytes at `:505-520`. The element JSON builder walks the same facts (`buildFacts(validator)`) and calls the same `children`/node emission path, so the "no second tree builder" acceptance criterion is structural, not aspirational.

`encodeSegment` (`src/validate/structure.ts:14`) is `encodeURIComponent` with `%3A` restored to `:`, and `keyPath` at `:8` accepts the result. `render()` passes `requireKey = false` for static children and `true` for lists (`src/sdk/render.ts:412-414`). Element JSON cannot tell the two apart, so it keeps the id derivation and fails on repeated derived segments with the existing kinds. This is the smallest rule that cannot produce two nodes with one id.

The default limits are a single constant, `DEFAULT_LIMITS = { nodes: 5000, depth: 64, bytes: 1024 * 1024 }` in `src/validate/tree.ts:22`, and the error bound is `DEFAULT_MAX_ERRORS = 20` in `src/errors.ts:38`. Reusing them makes `renderElements` and `render()` agree without a second budget vocabulary.

`Intent` is already a closed union in spec §9 (`setState` with `key`/optional `value`; `action` with `name`/`args` and exclusive `bind`/`bindAll`). Events in element JSON are therefore the same data the validator already checks, not a new intent format.

`ephemeralManifest` needs no capability document of its own: action names are checked by `validateManifest` against the host's capabilities at install and by the compiled validator at render. Its fixed `id`/`version` make it recognisable and prevent an ephemeral surface being mistaken for a stored package. Clause: it is never stored.

### The generated schema

`scripts/schemas.ts` already establishes the drift pattern: deterministic `JSON.stringify(schemaDocument(name), null, 2)` plus `--check` byte comparison. `generate()` in `src/sdk/gen.ts:76` already turns catalog definitions into typed props; `generateElementsSchema` is the JSON-Schema sibling and can share the same schema-to-type knowledge. A discriminated `oneOf` keyed by `kind` is JSON Schema 2020-12's normal form for a closed union of object shapes, and Ajv 8 supports it. Emitting branches in catalog declaration order makes the bytes deterministic without sorting away meaning.

`elements` is not a package-wide format like `manifest` or `theme`, which is why it is generated per catalog and not added to `src/formats/registry.ts`. The `$id` `urn:liveframe:elements:1` follows spec §13's `urn:liveframe:<format>:1` convention so a generated file still has a stable identity.

### The streaming measurement

`docs/model.md:133` records the 679-node, 50-row agent-home tree as the realistic size, and `bench/render.bench.ts:60` already labels that workload `agent-home: 679`. The plan's 3 µs/node render budget applies to `renderElements`; Task 2 adds the bench case. The streaming subject reuses the same shape so the two measurements are comparable.

Spec §9 says whole trees are sent per revision, reconciliation is by `id`, and compression comes before patches. Clay's update budget is 1 KiB (`plans/requests/clay-adoption-requests.md`, LF-17 evidence). The threshold is set before measuring so Task 3 cannot rationalise a patch design after the fact. Ten updates per second is the "many times a second" streaming case named in LF-17; 100 revisions keeps the bench quick while covering warm caches. The changed-value byte sum is recorded as the theoretical floor a patch could reach, without claiming a patch format.

### The corpus and hash vectors

`src/validate/*` enforces rules JSON Schema cannot express — ids, carries/bind agreement, style permission, recipe cascades, UTF-8 byte counting and code-point bounds — which is exactly CL-06's problem. Committed JSON cases run by `src/__tests__/corpus.test.ts` keep the reference honest and give ports executable expectations. Matching on `(kind, pointer)` avoids pinning prose, while the 20-error bound is observable behaviour (the validator stops at `DEFAULT_MAX_ERRORS`).

Existing tests are the source of the cases: `src/__tests__/validator-rules.test.ts` already has a `Row` table with `kind`, `pointer`, `input` and expected text; `manifest.test.ts`, `theme.test.ts`, `design-system.test.ts` and `package-format.test.ts` hold the other failing cases. Committing generated-from-test data is avoided; the cases are authored data.

The hash contract is RFC 8785 §3.2.2.3 and Appendix B. `src/pack/hash.ts` implements byte-exact serialisation and rejects non-JSON and lone surrogates; `src/__tests__/pack-hash.test.ts` currently checks a handful of edges but not Appendix B's full table. Appendix B pins `-0 → 0`, `5e-324`, `1.7976931348623157e+308`, `9007199254740992`, `1e+21`, `1e-7`, the `9.999999999999997e+22`/`1e+23` boundary and round-to-even `1424953923781206.2`. Those are the drift points a Rust `serde_json` port gets wrong by default. The `value` field is the input; `canonical` is the RFC 8785 text; `sha256` is the digest of its UTF-8 bytes.

### Engines and the other runner

The browser tests currently import `chromium` directly (`src/__tests__/conformance-renderer-browser.test.tsx:2`) and CI installs only Chromium (`.github/workflows/ci.yml:25`). Playwright's API is identical for `webkit` and `firefox`; installing them on Linux uses `bunx playwright install --with-deps webkit firefox` (Playwright's own CI guidance). The local Playwright is 1.64.1, above the `^1.49.0` peer floor. Spec §6.4 records that Safari before 26.2 and WebKitGTK before 2.52.3 lack `scrollbar-color`; Task 6 must assert native scrollbars rather than skip when the Playwright WebKit build is older.

The backlog note (`plans/backlog.md:260`) is the reason Vitest is not adopted silently: both preloads use `bun:test`'s `mock.module` (`src/__tests__/fixtures/no-playwright.ts`, `no-mcp-sdk.ts`), so a different runner makes them decorative unless it gets an equivalent block. Vitest's documented Bun story is `bun run test`, which runs Vitest's own Vite pipeline; `bunx --bun vitest` runs Vite under Bun but still brings Vite's Node-targeted dependency tree. The plan permits recording the reason and keeping the backlog item, which is what this log does. The Bun-only re-proof is concrete: run `bun test --preload ./src/__tests__/fixtures/no-playwright.ts <suite>` (passes) and the same command without `--preload` (must fail), and likewise for `no-mcp-sdk`.

## References

- Plan [`plans/019-Phase-7-Part-F-Agent-Surfaces-Conformance-Corpus-And-Engines.md`](../plans/019-Phase-7-Part-F-Agent-Surfaces-Conformance-Corpus-And-Engines.md) — Tasks 1–7.
- `docs/spec.md` §7.1 (widgets, key-path ids, realistic sizes), §7.2 (`render()` and its errors), §9 (wire format, patches deferred), §10 (limits and error kinds), §13 (subpaths, schemas, conformance, ships list).
- `plans/requests/synapta-adoption-requests.md` LF-16/LF-17; `plans/requests/clay-adoption-requests.md` CL-06.
- `src/sdk/render.ts:362,407-419,498,505-520` — ids, key rules, limits, pointer rewrite, byte counting.
- `src/validate/structure.ts:8,14` — `keyPath` and `encodeSegment`.
- `src/validate/tree.ts:22` — `DEFAULT_LIMITS`; `src/errors.ts:38` — `DEFAULT_MAX_ERRORS`.
- `src/formats/manifest.ts:196` — `validateManifest`; `src/sdk/gen.ts:76` — `generate()`.
- `src/pack/hash.ts` — canonical serialisation and UTF-8; `src/__tests__/pack-hash.test.ts:64` — current RFC cases.
- `src/__tests__/validator-rules.test.ts` — failing-case table; `src/__tests__/conformance-renderer-browser.test.tsx:2`; `.github/workflows/ci.yml:25`.
- `src/__tests__/fixtures/no-playwright.ts`, `no-mcp-sdk.ts`; `plans/backlog.md:252-260`.
- [RFC 8785 §3.2.2.3 and Appendix B](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-B) — ECMAScript number serialisation table, retrieved 2026-10-29.
- [Playwright: install browsers with dependencies](https://playwright.dev/docs/browsers) — `playwright install --with-deps chromium webkit firefox`; [test projects](https://playwright.dev/docs/test-projects) — browsers are normally selected by project, which this plan replaces with one helper parameter because the suite runs under `bun test`.
- [Vitest guide](https://vitest.dev/guide/) — `bun run test` runs Vitest via Vite; `bun test` runs Bun's own runner.
- Local versions at decision time: Bun 1.4.4, Playwright 1.64.1, peer floor `playwright ^1.49.0`.

## Consequences

- `@arnilo/liveframe/sdk` gains `renderElements`, `ephemeralManifest` and the `Elements<Catalog>` type; `/sdk/gen` gains `generateElementsSchema`; the CLI gains `--elements-schema`. No `/authoring` tool is added.
- `schemas/` does not gain an `elements.json`; the generated file is per catalog and checked by `liveframe gen --check`.
- `conformance/corpus/**` and `conformance/hash/**` become shipped files; `package.json` `files`, the archive gate, `docs/conformance.md` and `docs/compatibility.md` must add them. Spec §13's ships list and conformance section need the corpus.
- The browser helper gains one engine parameter; CI installs and runs three engines. WebKit/Firefox failures are fixed or recorded as engine limitations with owner approval; the WebKit version is recorded in `plans/evidence/019-engines.md`.
- The Vitest backlog item stays open, narrowed to a runner with an equivalent blocking preload; the two preloads stay proved under Bun.
- Revisit element-JSON key requirements if agents need a static/dynamic distinction; revisit `state?` derivation if a host needs `null` state; revisit the patch thresholds only with a new measurement, never by preference.
- Revisit the corpus escape if a format ever needs a literal `$liveframe` key; revisit the corpus layout only with a format version bump.
