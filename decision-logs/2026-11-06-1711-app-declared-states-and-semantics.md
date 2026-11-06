---
date: 2026-11-06 17:11
status: approved
decision_about: "App-declared recipe states and semantics values (0.3.0, W8a)"
proposed_by: both
explicitly_approved_by_user: true
---

# Decision: Apps declare recipe states and semantics values in the vocabulary

## Decision

Follow plan 027 Task 6 with these choices:

1. `vocabulary.states` is an optional map of app states, each `{ attribute: "data-<kebab-name>", description }`. A state name matches `^[a-z][a-zA-Z0-9]*$`, collides with no library state, and is limited to 16 per catalog. Its `attribute` must be exactly `data-` plus the name in kebab case (`dragOver` → `data-drag-over`) and must not be a data attribute the library states already select on. The projection selects only on the attribute's presence (`[data-dragging]`).
2. Source order is the library order with the app states inserted after `invalid` and before `disabled`, in declared order. App states do not join the hover/press suppression guard.
3. Forced colours: an app state whose resolved recipe differs from `rest` gets the 1px `Highlight` outline cue that `hover`, `active` and `open` use.
4. `vocabulary.semantics` is an optional map of `{ role, description }`. A name matches `^[a-z][a-zA-Z0-9]*$`, collides with none of the 16 library `semantics` values, and is limited to 16. `role` is a member of a published ARIA role allowlist (`ariaRoles`, root export). Implementations decide the element; the library never renders one.
5. Declarative contract for `semantics`: a catalog definition whose string enum prop is named `semantics` may contain only library values and declared names; any other value is `unknown-name` at that enum item. Catalogs that use only the 16 library values are unaffected.

## Context

The state list (`src/formats/fixed.ts`) and the `semantics` list are fixed by the library, so an app that needs a `dragging` state or a `toolbar` landmark waits for a library release (the 0.3.0 evaluation weakness W8a, [release scope](2026-11-05-0238-release-0-3-0-scope.md)). Today the library enforces no `semantics` enum: each catalog declares its own enum and copies the list, so "widening the domain" needed a decision on what the vocabulary entry means. Task 6 also requires an owner decision on the source-order and forced-colours choices before implementation.

## Approval

- Proposed by: both.
- Approved by user: Yes.
- Approval evidence: the owner instructed “Complete - [ ] Task 6: App-declared recipe states and semantics values (W8a)” (which fixes choices 1–3 as written in the task), and answered the semantics question (“Declarative contract (Recommended)”) after the three options were presented.

## Alternatives Considered

1. **Arbitrary selectors per state** — rejected: law 3 (no authored selectors); a data attribute is the only input.
2. **App states before `hover`** — rejected: states must beat rest-like interactions; after `invalid` keeps `disabled` last.
3. **Validate `vocabulary.semantics` but never check a catalog's enum** — rejected: declaring a name would have no effect on any other check.
4. **A strict closed enum by default** — rejected: it would reject catalogs that already use other values without a declaration step; the declaration check gives the same closure with a one-line fix.
5. **Free-form `attribute`** — rejected: a derived name keeps the selector injection-free and the attribute predictable; the field stays so the contract is explicit and can be widened later.

## Rationale and Evidence

- `src/formats/fixed.ts:9-41` holds the closed lists; `src/css/design-system.ts:26` holds the selector table whose order is normative (spec §6.4).
- The three-part check keeps law 3: a state is a data attribute, a role is a closed allowlist member, and no CSS text is authored.
- The role allowlist covers the ARIA 1.2 landmark, document-structure and live-region roles that name a region without needing extra required properties (no `heading`, `img` or widget roles with required state). WAI-ARIA Authoring Practices consulted through Context7 `/w3c/aria-practices` (landmark and live-region pages); the role names come from the ARIA 1.2 role taxonomy.
- Recipes already treat states as optional overlays, so completeness is unchanged.

## References

- [W3C ARIA Authoring Practices Guide (Context7 `/w3c/aria-practices`)](https://github.com/w3c/aria-practices) — landmark and live-region roles.
- `plans/027-Phase-7-Part-N-Release-0-3-0-Formats-References-Extensions-Axes-And-Urls.md` Task 6.
- `decision-logs/2026-11-05-0238-release-0-3-0-scope.md` — W8a.

## Consequences

- Positive: apps add states and landmark names without a library release; a design system without them projects byte-identical CSS.
- Risk: the semantics declaration check rejects an existing catalog whose `semantics` enum holds a non-library value; the fix is a `vocabulary.semantics` entry. Recorded in the 0.3 migration guide.
- Revisit if hosts need attribute values other than presence, or a role outside the allowlist.
