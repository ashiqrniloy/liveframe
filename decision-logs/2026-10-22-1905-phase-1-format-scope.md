---
date: 2026-10-22 19:05
status: approved
decision_about: "What Phase 1's formats and validator contain, and the format questions left open in spec §15"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Phase 1 defines a contract for every trust boundary, and settles spec §15's format questions

## Decision

Phase 1 delivers one versioned, closed, bounded format per trust boundary, each with a validator and one shared error format:

- **The schema language**: a closed subset of JSON Schema in the spirit of JTD. `maxLength` and `maxItems` are required.
- **The vocabulary**: the app declares the names; the library fixes the kinds of name and their value types.
- **Definitions and the catalog**, with descriptions, deprecation, default variants and written versioning rules.
- **The host's capabilities (new)**: actions and data sources, each with a description and schemas.
- **The manifest.**
- **The theme**, with DTCG colour objects and the DTCG typography composite.
- **The design system**, with DTCG-typed values and a recipe cascade.
- **The UI tree and intents**, with an action's optional `bind`.
- **The validator**: compiled per catalog into closures with no `Function` constructor, collecting every error up to a bound, with a node and a JSON Pointer on each error.
- **The recipe resolver.**
- **Published JSON Schemas.**

The six open questions are settled as follows:

1. **Vocabulary.** The app declares the names (colour, surface and fillable roles, typography roles, tones, and `space`/`radius`/`size`/breakpoint names). The library fixes the kinds, value types, states, style props and recipe properties.
2. **Primitive set.** It stays per app. A catalog is the app's contract; portability comes from the formats, not from one mandated set.
3. **Event value into an action argument.** An action intent may carry `bind: "<arg>"`. The event's value fills that argument; the validator checks the types and the app re-checks on dispatch.
4. **Host capabilities.** The app publishes its actions and data sources with descriptions and schemas. A manifest may only name what it declares.
5. **Colour values.** Themes use DTCG 2025.10 colour objects. The projection converts them to CSS.
6. **Recipes.** One variant axis, with a cascade: `kind.*.slot.rest`, then `kind.variant.slot.rest`, then the state overlays. A complete system gives every `(kind, variant, slot)` a `rest` style, and every kind that raises events a `focus` overlay.

## Context

Phase 0 is go, and Phase 1 freezes the formats. The owner asked for an analysis of what belongs in Phase 1, built from frameworks with neighbouring purposes and from first principles, with an argument for why it is sufficient. The analysis found six trust boundaries and showed that the spec covered about half of them:

- **B1, host → library:** the vocabulary was hard-coded in proof library code (`proof/styles/types.ts:5, 53, 112–117`).
- **B2, style author → projection:** product values were baked into the recipe types (`transitionTiming?: "expo-out"`, `transformPreset: "press-shift-down"`).
- **B3, host → author:** missing. A manifest names actions, but nothing declares argument or data shapes, and the validator only checks that `args` is an object (`proof/runtime/validate.ts`, `checkIntent`).
- **B4, author → host:** partly specified (the manifest).
- **B5, backend → renderer:** specified (the tree).
- **B6, validator → author:** partly specified. There is no path convention, and only the first error is returned.

## Approval

- Proposed by: agent, in the Phase 1 analysis.
- Approved by user: Yes
- Approval evidence: "I agree with all the recommendations. Create the plan documents".

## Alternatives Considered

1. **Phase 1 limited to the spec as written** (definitions, catalog, theme, design system, tree and validator). Rejected. It freezes formats with the vocabulary hard-coded, action arguments unchecked until dispatch, and no format an agent can learn the host's actions and data from.
2. **A fixed library vocabulary** (Liveframe-chosen role and value names). Rejected. It would bend every app's design language to one naming scheme; Adaptive Cards shows that host-chosen values under library-fixed categories is enough.
3. **A standard primitive set every app implements.** Rejected for 1.0. The proof showed that the catalog is app vocabulary (box variants, icon sets); a mandated set can follow once reference hosts converge.
4. **Keep the commit-to-state workaround for typed values.** Rejected. Adding a field to a closed intent format after the freeze breaks older validators, and the workaround costs a round trip (`proof/REPORT.md` G18).
5. **CSS colour strings in themes.** Rejected. DTCG objects import from Figma and Style Dictionary and are already structured; a CSS string would need a parser for every colour syntax.
6. **Multi-axis variants and compound variants (Panda CSS).** Rejected for 1.0: the proof needed one axis. A cascade alone removes most of the 536-recipe duplication per system (`proof/GAPS.md`).
7. **An Ajv-style compiled validator using the `Function` constructor.** Rejected. Ajv's documentation says it is forbidden under a Content Security Policy, and some sandboxes forbid it too. Closures over precomputed sets and checks stay portable.
8. **Zod or TypeBox as the format source.** Rejected. A small internal builder that emits JSON Schema and infers TS types is enough. It keeps the core dependency-free and follows the proof's `PropSchema`/`SchemaValue` precedent.

## Rationale and Evidence

Frameworks consulted (via Context7, 2026-10-22):

- **A2UI v1.0** (a2ui.org): catalog as JSON Schema with a `catalogId` URI and LLM `instructions`; major bump for breaking catalog changes; `VALIDATION_FAILED {surfaceId, path, message}` errors meant for agent self-correction.
- **Adaptive Cards** (`microsoft/adaptivecards`, `specs/HostConfig.md`): host-owned named scales (spacing, container styles, font sizes) under fixed categories; a card `version` gate; different error policy for a required versus an optional property.
- **json-render** (Vercel Labs): action definitions with parameter schemas and descriptions; catalog → prompt; catalog → JSON Schema.
- **Slack Block Kit**: published limits (50 blocks per message, 100 per modal or Home tab, 3,000-character text, 255-character ids).
- **Custom Elements Manifest**: per-component description, deprecation, events and slots, and a document `schemaVersion`.
- **DTCG Design Tokens 2025.10**: `color` as `{colorSpace, components, alpha?, hex?}`; `dimension` in px or rem; `duration` in ms or s; `cubicBezier`; `shadow`; the `typography` composite.
- **Panda CSS slot recipes**: slots, per-slot base, default variants.
- **JSON Type Definition (RFC 8927) via Ajv 8.20**: a small closed schema language for code generation. Ajv's standalone mode is needed under CSP.

The sufficiency argument:

1. Every boundary (B1–B6) gets an identity, a closed schema, bounds, a validator and an error format.
2. Every invariant has an enforcing check at its earliest point: I1 closed world, I2 typed bounded values, I3 structure, I4 identity, I5 authority including argument schemas, I6 resources, I7 style safety, and S1–S4 at install.
3. Every concept the consulted frameworks found necessary is either included or excluded for a stated reason.
4. The proof's four UIs are re-expressed in the new formats as fixtures. Plan 003 makes that its acceptance test.

## References

- `docs/spec.md` §5, §6.1, §6.2, §6.5, §7.1, §8, §9, §10, §13, §15 — updated by this decision.
- `plans/003-Phase-1-Part-A-Formats.md`, `plans/004-Phase-1-Part-B-Compiled-Validator.md` — the plans that implement it.
- `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md` — the single-pass and per-node budget route.
- `proof/styles/types.ts`, `proof/runtime/validate.ts`, `proof/widgets/agent-home/manifest.ts` — the gaps cited above.

## Consequences

- Spec §15 keeps only the license question.
- New formats: vocabulary, capabilities. Changed formats: definition, catalog, theme, design system, manifest, intent.
- The design system's completeness rule changes from "every state resolves" to "`rest` everywhere and `focus` for every kind that raises events". Other states are optional overlays.
- Phase 1's performance gate becomes the validator's share: ≤ 1.5 µs per node on the proof's 679-node tree. Phase 2 Part A keeps the 3 µs-per-node total through `render()`.
- Revisit if a reference host needs a second variant axis, a value kind that the fixed kinds cannot express, or a schema form beyond the language.
