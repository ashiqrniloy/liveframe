---
date: 2026-11-06 00:35
status: approved
decision_about: "Variant axes alias declared colour roles in 0.3.0"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Variant axes alias colour roles

## Decision

Amend the [2026-11-02 variant-axes decision](2026-11-02-2208-multiple-variant-axes-for-0-3-0.md):
axis overlays may carry a `roles` map that aliases colour roles or role prefixes. Merge maps in
the existing axis cascade, rewrite each colour reference once, and validate the resulting roles
at install. The full rules and worked example are in
[design §2.8](../plans/evidence/022-variant-axes-design.md#28-role-aliases).

## Context

Direct property overlays cannot express a critical tone as both a primary button's fill and a
ghost button's text without repeating the emphasis × tone product. Variants should select the
paint pattern while a tone axis selects its colour family. The approved expansion into a flat
table, completeness rules, caps, class suffixes and unchanged tree format remain in force.

## Approval

- Proposed by: both; Plan 027 Task 1 specifies the alias approach.
- Approved by user: Yes.
- Approval evidence: on 2026-11-06 the user instructed: “Complete - [ ] Task 1: Revise the
  variant-axes design to alias colour roles, and record the decision” from Plan 027, and requested
  that the plan be updated once done. This explicitly authorizes the design amendment and record.
  Task 5 has not started.

## Alternatives Considered

1. **Direct property overlays or product variants** — repeat the emphasis × tone recipes and
   defeat the intended reuse.
2. **Compound variants** — add a cascade dimension and completeness questions for each pair.
3. **Runtime CSS-variable remapping** — existing state snapshots can override axis choices;
   redesigning state emission would change existing sheets.
4. **Chained aliases** — introduce traversal and cycle semantics without helping the worked case.

## Rationale and Evidence

- The existing cascade merges rest before state, wildcard before variant. The axes design inserts
  axes after the variant in declared order at each level. Alias entries follow that order by
  source name; inheritance merges parent before child.
- Longest matching dot-delimited prefixes make exact exceptions deterministic. Rewriting once
  avoids chains; all resulting full roles must be declared, with `unknown-name` pointing at the
  responsible `/recipes/<key>/roles/<from>` entry. Original role validation still applies.
- Rewriting applies only to typed colours, including role-alpha objects, shadow colours and colour
  extensions. It preserves `none`, alpha and non-colour data. Law 3 still holds.
- The four-pair example uses two base recipes and two alias entries. Critical primary resolves to
  `status.critical.fill` / `status.critical.on-fill`; critical ghost resolves to `none` /
  `status.critical.text`. Neutral uses the equivalent `status.neutral` family.
- Radix Themes' independently selectable Button `variant` and `color` provide prior art for
  separating emphasis from colour choice. Context7 returned indexed version 3.x, without an exact
  release pin. This is evidence for the separation, not for Liveframe's alias algorithm.

## References

- [Design §2.3–§2.8](../plans/evidence/022-variant-axes-design.md) — cascade, projection and alias rules.
- [Plan 027 Task 1](../plans/027-Phase-7-Part-N-Release-0-3-0-Formats-References-Extensions-Axes-And-Urls.md)
  — requested scope; Task 5 implements the design.
- [Spec §6.2](../docs/spec.md#62-design-system-values-and-recipes) — colour authority and cascade.
- `src/resolve.ts:16-86`, `src/formats/design-system.ts:350-383`,
  `src/css/design-system.ts:255-278` — existing resolution, installation and projection flow,
  inspected through graft.
- [Radix Themes Button props](https://github.com/radix-ui/themes/blob/main/_autodocs/api-reference/buttons.md)
  and [colour props](https://github.com/radix-ui/themes/blob/main/_autodocs/api-reference/props.md)
  — Context7 `/radix-ui/themes`, retrieved 2026-11-06 via `bunx ctx7@latest library` then `docs`.

## Consequences

- Task 5 implements design §2.8 and its listed proof obligations, including inherited entries,
  longest-match precedence, one-step rewriting and shared shadow values.
- Alias work happens during flat-table resolution used by projection and contrast audit;
  the renderer does no alias work. Existing axes caps and performance gates remain.
- Kinds without axes retain their CSS bytes. No format identifier bump or runtime dependency is
  introduced. Existing validators reject the new fields fail-closed.
- This task delivers design documentation only. Plan 026's format/schema prerequisites still
  apply to implementation, and no performance claim has been measured for aliases yet.
