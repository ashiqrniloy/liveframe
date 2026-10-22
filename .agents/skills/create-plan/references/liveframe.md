# Liveframe plan requirements

`docs/spec.md` is the normative design and `roadmap.md` orders the work. This file turns them into planning rules. If this file and the spec disagree, the spec wins; fix this file in the same plan.

## 1. Numbering

- The next free plan number is in `roadmap.md` §3. Take it, then bump it in the same change.
- File name: `NNN-Phase-N-<Title-Slug>.md`. Non-phase plans (a fix, a chore) use `NNN-<Title-Slug>.md`.

## 2. Place the work

| The change… | Belongs in | Never in |
| --- | --- | --- |
| A format, type, schema, the validator, the recipe resolver | `src/` root export (`@arnilo/liveframe`) | `/react`, `/css` |
| The JSX runtime, intent helpers, `render()`, the `liveframe gen` CLI | `/sdk` | the root export |
| Projecting a theme or design system to CSS | `/css` | the root export, `/react` |
| Drawing a UI tree, `implement()`, `onIntent` | `/react` | any other subpath |
| Shared test suites for apps | `/conformance` | the other subpaths |
| Phase 0 proof code, reference-UI snapshots | `proof/` (never published) | `src/` |
| A primitive's React implementation or a design system | an app, a demo host or `proof/` | the published package |

## 3. Task probes

Ask each probe for every task. Record the answer as an acceptance criterion, a listed file, a test, or `n/a — <reason>`.

1. **Spec section.** Which `docs/spec.md` sections does this implement? Does it change their meaning? If so, update the spec in this task.
2. **Placement.** Which subpath (§2)? Does anything outside `/react` and `/css` import a host API? It must not.
3. **The four laws.** Which of spec §2's laws does this touch, and what rejects a violation? Every rejection gets a test.
4. **Primitives only.** Does this add anything product-shaped to a catalog, or to the library? It must not.
5. **Public surface.** Which exports, subpaths or format fields are added, changed or removed? Update `package.json` `exports` and the spec together.
6. **Callers.** `graft callers <symbol> --depth all` for every rename, move or delete. Update all of them in the same task.
7. **Proof.** Which named test fails if the logic breaks? Which conformance suite covers it, once one exists?
8. **Dependencies.** Does this add a runtime dependency? Only with an explicit justification in the task; heavy dependencies only in `/react` or `/css`.
9. **Performance.** Does it touch the render, validation or style path? State the budget or the non-regression check.
10. **Docs.** Which docs page or README section changes? Docs are written for outsiders.
11. **Reference hosts.** Does this widen or close a gap for Synapta or Clay? Record it; never bend the design to them.

## 4. Chore checklists by change type

**New or changed format** (definition, catalog, theme, design system, UI tree, intent)
- JSON Schema and TS type change together, with a test that one validates against the other.
- The validator rejects every malformed case the spec names.
- Spec section and docs updated in the same task.

**New SDK surface**
- Typed from the catalog; a type-level test proves wrong props fail to compile.
- Runtime stays host-API-free; the portability check covers the new file.

**New renderer behaviour**
- A test for each interaction tier it touches; focus, scroll and local state survive a re-render where relevant.

**Style or design-system change**
- The completeness check (spec §6.2) and the "no colour outside the theme" check cover it.

## 5. Impact areas (final task)

Sweep each one against the delivered work, and record each, or `None — <reason>`, in `plans/evidence/NNN-impact-analysis.md`:

1. **Spec**: does `docs/spec.md` still describe what shipped?
2. **Public API and formats**: exports, subpaths, format fields, versioning.
3. **The four laws**: any new path where widget code, colour, raw CSS or authority could leak.
4. **Validation**: every new input is validated, and failures are typed errors.
5. **Styling**: theme authority, recipe completeness, CSS projection.
6. **Interaction tiers**: local, `setState`, action.
7. **Performance**: render, validation and style budgets.
8. **Portability**: host-API-free core; Bun, browsers, other runtimes.
9. **Agent authoring**: generated types and error messages an agent can act on.
10. **Docs and examples**: outsider-facing docs current.
11. **Conformance**: suites cover the new surface.
12. **Reference hosts**: gaps found for Synapta or Clay, recorded.

## 6. Plan-level rules

- One roadmap phase is one plan, or explicit Part A/B plans.
- `## Verification (whole plan)` includes at least `bun run check`.
- No version bump or publish before roadmap Phase 6.
- Proof code in `proof/` is never imported by `src/`.
