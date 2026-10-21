# Backlog

Follow-ups handed off from plans. One entry per item; update an entry with the same source and title instead of duplicating it.

## Phase 0 parity re-proof

- Section: Phase 0 (spec §5, §6.2–§6.4, §12)
- Priority: P1
- Source: plans/001-Phase-0-Primitive-Set-Proof.md
- What:
  - Add the Task 12 spec additions to `proof/`: `disclosure`, layout `semantics`/`label`, button `current`/`pressed`, app-declared `box` variants, `breakpoint` values with responsive style values, `position`/`inset`, box `fill`/`radius`, `textAlign`/button `align`, and surface-root typography.
  - Add rejection tests for `fill` (declared roles only) and responsive values (closed keys, per-value domains).
  - Snapshot the artifact's Schibsted Grotesk and Martian Mono files.
  - Re-run `proof/scripts/parity.ts` to ≤ 1% pixel mismatch at 1440/1024/390 px, or to an inventory where every remaining difference is intended.
  - Re-measure the render budgets. The full core queue was at 1.702 ms against 2 ms.
- Why: Phase 0 is a conditional go (`decision-logs/2026-10-22-0033-phase-0-conditional-go.md`). It closes, and Phase 1 starts, only when this passes. If closing a gap needs a product-shaped primitive or raw styling, §12's no-go path reopens.

## Decide the spec §15 open items before Phase 1

- Section: spec §8, §9, §15
- Priority: P2
- Source: plans/001-Phase-0-Primitive-Set-Proof.md
- What:
  - Decide whether the primitive set becomes a standard contract every app must implement, or stays per app.
  - Decide whether and how an event's value binds directly into an action argument in the intent format.
- Why: Phase 1 freezes the formats. The proof worked around action arguments with commit-to-state, then a static action (`proof/REPORT.md` G18).

## Later-phase gaps from the Phase 0 report

- Section: Phases 1, 3 and 4 (spec §6.4, §8, §10, §11)
- Priority: P2
- Source: plans/001-Phase-0-Primitive-Set-Proof.md
- What:
  - Phase 1: name the `textField` commit event `onCommit` (G19), and build the install validator for untrusted themes and design systems (G28).
  - Phase 3: give every surface root and text slot theme typography (G12), scope the projection per surface (G27), and audit forced colours on real platforms (G29).
  - Phase 4: enforce `maxLength` in code points, not UTF-16 units (G20), support app-owned icon sets (G26), and audit with assistive technology (G29).
- Why: the proof built these parts proof-grade only. `proof/REPORT.md` §6 assigns each one to the phase that builds the real part.

## Seed conformance suites from the proof tests

- Section: Phase 5 (spec §13 `/conformance`)
- Priority: P3
- Source: plans/001-Phase-0-Primitive-Set-Proof.md
- What: use `proof/tests/{catalog,styles,projection,renderer,renderer-browser}.test.*` as prior art for the catalog, design-system and renderer suites.
- Why: these tests already enforce completeness, colour authority, the registry check and reconciliation against two real design systems.

## Hand adopter gaps to Synapta and Clay

- Section: Phase 7 (reference hosts)
- Priority: P4
- Source: plans/001-Phase-0-Primitive-Set-Proof.md
- What:
  - Synapta: Certified has no five-patch identity roles or diagnostic fill roles (G2).
  - Clay: Rack's docs claim 273 recipes, but the manifest has 247 (G3); Rack recipes reference undeclared spacing and easing values (G5); Rack typography is user-owned, which spec §6.1 now allows through an assembled theme (G1).
- Why: these are the source apps' own gaps. Record them for the adopters; never bend the library to them (problem class first).
