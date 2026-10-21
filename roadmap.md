# Liveframe Roadmap

Liveframe (`@arnilo/liveframe`) lets an app's UI change at runtime — by users, organisations or AI agents — without a deployment, while staying safe and looking native. The app ships primitives and a design system; everything above them is TSX widget code installed at runtime.

The normative design is [`docs/spec.md`](docs/spec.md). This roadmap orders the work and holds the execution state.

## Contents

1. Rules for every phase
2. Phases
3. Execution state

## 1. Rules for every phase

**Authority order.**
1. `docs/spec.md` is the single normative target.
2. Accepted decision logs in `decision-logs/` come next. A decision that changes the spec updates the spec in the same change.
3. Execution state (current phase, plan status, next free plan number) lives only in §3 of this file.

**The four laws** (spec §2). Every phase keeps all four:
1. Widget code never runs in the browser. Only the app's compiled primitives run there.
2. The UI tree is data, validated before the renderer reads it.
3. Widget code never sets colours or raw CSS. Look comes from the design system; layout comes from token-constrained style props.
4. A widget never holds authority. Data is resolved and actions are run by the app, as the viewer.

**Library rules.**
- **Primitives, not product components.** The library ships no components. Catalogs hold only primitives; anything composable from primitives is widget code.
- **Host-API-free core.** Everything outside `/react` and `/css` imports no `node:`, `bun:`, DOM or `require`, and CI enforces it.
- **The problem class first.** Liveframe is designed for any app with this problem. Never bend it to ease one adopter's migration; record the adopter's gap instead.
- **No new runtime dependency** without an explicit plan task that justifies it.
- **Green after every task.** `bun run check` passes when each plan task ends.
- **Simplest thing that holds.** No feature the spec does not require; extras go to `plans/backlog.md`.

## 2. Phases

Phases run in order. Each phase is one plan, or explicit Part A/B plans.

### Phase 0 — Primitive-set proof

- **Goal:** prove the spec's central claim before building the library: a small primitive set, plus recipes and style props, can express real product UI with no product-shaped components.
- **Why:** both source apps hit this wall. Synapta's components are too big (its approved home is blocked by `Queue`); Clay's primitives are too thin.
- **Scope:** spec §12 exactly — four reference UIs from Synapta and Clay built as TSX widgets on the candidate primitives, under the Certified and Rack design systems, with all three interaction tiers. Proof-grade code in `proof/`, not the published package.
- **Done:** the §12 report exists with the final primitive list, the style props needed, the gaps and how each was resolved, and a go/no-go. The spec is updated with what the proof changed.
- **If no-go:** stop and revisit spec §5–§6 before any later phase.

### Phase 1 — Formats and validator

- **Goal:** `@arnilo/liveframe` root export: the definition, catalog, theme and design-system formats; the UI tree and intent types; the validator (spec §10); the recipe resolver.
- **Done:** every spec §10 check has a failing-case test; themes and design systems are validated on install; the formats are JSON Schema with TS types derived from them.

### Phase 2 — SDK

- **Goal:** `@arnilo/liveframe/sdk`: the JSX runtime, `state.set` / `action`, `render()` with key-path ids and every spec §7.2 error kind, and the `liveframe gen` CLI with `--check`.
- **Done:** a widget renders to a validated tree in Bun with no host APIs; codegen output is checked for drift in CI.

### Phase 3 — CSS projection

- **Goal:** `@arnilo/liveframe/css`: a theme and design system projected into CSS custom properties, plus one class per `(kind, variant, slot, state)`.
- **Done:** switching theme or design system swaps variables atomically with no widget re-render; forced-colours mode is honoured.

### Phase 4 — React renderer

- **Goal:** `@arnilo/liveframe/react`: `<Surface>`, `implement()`, the startup registry check, id-keyed reconciliation, the fallback, server-side rendering, and `onIntent`.
- **Done:** the three interaction tiers work end to end against a test host; focus, scroll and local state survive re-renders.

### Phase 5 — Conformance kit

- **Goal:** `@arnilo/liveframe/conformance`: shared suites for catalogs, design systems and renderers.
- **Done:** an app can prove its catalog, design system and renderer conform with one test import.

### Phase 6 — First release (0.1.0)

- **Goal:** license chosen, docs for outsiders, a small public demo host, and publish to npm.
- **Done:** `@arnilo/liveframe@0.1.0` installs and the demo host runs from the published package.

### Phase 7 — Reference hosts

- **Goal:** Synapta and Clay adopt Liveframe. The migrations run in their own repos; this phase collects the gaps they report and fixes them here.
- **Done:** both apps render at least one production surface through Liveframe.

## 3. Execution state

- **Current phase:** Phase 0.
- **Next free plan number:** 002.

One line per plan. Detail lives in the plan file, never here.

| Plan | Phase | Status |
| --- | --- | --- |
| [001](plans/001-Phase-0-Primitive-Set-Proof.md) | 0 | in progress (Tasks 1–3 complete) |
