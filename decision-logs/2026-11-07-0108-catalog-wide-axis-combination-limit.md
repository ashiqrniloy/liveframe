---
date: 2026-11-07 01:08
status: approved
decision_about: "A catalog-wide limit on variant axis combinations"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Kinds with axes together have at most 512 combinations

## Decision

`validateCatalog` rejects a catalog whose kinds with `axes` have more than 512 variant and axis-value combinations in total (`invalid-document` at `/definitions`). The existing limits stay: three axes, 16 values per axis and 256 combinations per kind. Kinds without axes add nothing to the total.

## Context

Plan 027 Task 5 expands every combination into the flat recipe table and into one rule set per slot and state. Its cost record (`plans/evidence/027-axes-cost.md`) measures about 8 KB of CSS per added combination in the proof design systems. The per-kind limit of 256 bounded one kind, but a catalog may hold 256 definitions, so the worst case was far beyond any sheet a host could ship. Axes are new in 0.3.0 and unreleased, so adding a limit now breaks no installed document. The Task 8 impact analysis (finding F3) raised the gap and the owner chose to execute it.

## Approval

- Proposed by: agent (impact analysis finding F3).
- Approved by user: Yes.
- Approval evidence: the owner chose "Execute all four" for the plan 027 findings, then answered "512 (Recommended)" when asked to confirm the exact number.

## Alternatives Considered

1. **No catalog-wide limit (status quo)** — a hostile or careless catalog could expand to hundreds of megabytes of CSS at install; the per-kind cap alone does not bound it.
2. **256 in total** — worst case about 2 MB, but at most one maximal kind; it would constrain catalogs that give several kinds a modest tone × size grid.
3. **1024 in total** — worst case about 8 MB of CSS, which is larger than any sheet the cost evidence supports.
4. **A byte budget on the projected sheet** — measures the real cost, but needs a projection at install time and depends on slots and states; a combination count is checkable by multiplication without allocating.

## Rationale and Evidence

- Cost: 8 KB per combination (`plans/evidence/027-axes-cost.md`), so 512 combinations is a worst case near 4 MB, and the proof design systems' 24-combination button costs about 190 KB.
- The check multiplies enum sizes, as the per-kind check does, so it allocates nothing and runs only when no earlier error exists.
- 512 allows two kinds at the per-kind maximum or many smaller grids, for example twenty kinds with 24 combinations.

## References

- `src/formats/axes.ts` (`maxCatalogCombinations`), `src/formats/catalog.ts` (`checkAxisBudget`).
- `src/__tests__/variant-axes.test.tsx` (`axis_combinations_are_bounded_across_the_catalog`), corpus `catalog/axes-total-too-large.json`.
- `plans/evidence/027-axes-cost.md`, `plans/evidence/027-impact-analysis.md` (F3).
- `decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md` and `decision-logs/2026-11-06-0035-variant-axes-role-aliases.md` — the axes design this limit completes.

## Consequences

- A catalog above the total fails to install with a pointer to `/definitions`; adopters split a look into fewer axis values or use product variants.
- The limit is not expressible in the published JSON Schema (it is a sum), so it is an install-time rule like the other relationship checks.
- Revisit if a real catalog needs more, or if the per-combination CSS cost changes materially.
