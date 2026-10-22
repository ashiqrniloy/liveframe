---
date: 2026-10-21 20:17
status: approved
decision_about: "Liveframe's founding model, name and stack"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Liveframe combines Synapta's authoring and interaction model with Clay's styling model

## Decision

Liveframe (`@arnilo/liveframe`) is a TypeScript library for runtime-composable UI. Authoring and interaction follow Synapta: TSX widgets run on the app's backend, with three interaction tiers (local, `setState` re-run, action). Styling follows Clay: a theme is the only colour source, and a design system supplies typed values plus recipes keyed `<kind>.<variant>.<slot>.<state>`. Catalogs hold primitives only, and the first project task proves that a primitive set can express real product UI (spec §12).

## Context

Synapta (a multi-tenant web platform) and Clay (a Tauri desktop editor) each built their own version of the same idea: untrusted code produces a tree over a host-owned component catalog, validated before a trusted renderer draws it. Each hit a limit from a different side:

- **Synapta's catalog mixes primitives with product-shaped components.** `Queue` locks layout, controls and paging, which blocks its approved home design (Synapta Plan 200.4 T4b).
- **Clay's primitives carry thin props.** They can be arranged but barely shaped.

The owner wants one library, generally useful for any app with this problem, rather than two app-specific frameworks.

## Approval

- Proposed by: both. The agent proposed the combination and the primitives-only rule; the owner chose to combine the two models and chose the name.
- Approved by user: Yes
- Approval evidence:
  - "Let's take these two (Clay's design-system recipes … Synapta's TSX authoring and its three interaction tiers) and combine them to be the common library."
  - "Let's go with liveframe. Let's put it as @arnilo/liveframe in npm."

## Alternatives Considered

1. **A2UI as the wire format.** Not used in v1. The model needs neither streaming partial output nor client-side data binding, so a minimal whole-tree format is simpler. A converter to A2UI can be added later.
2. **A Rust core compiled to WebAssembly, with QuickJS as the bundled sandbox.** Rejected: every host already runs JavaScript for widgets, so one TypeScript implementation suffices. The owner also did not want QuickJS.
3. **A Remote DOM-style client sandbox (author code in an isolated browser worker).** Rejected as too complex for the goal. Its only gain, code-driven interactivity without a round trip, is not needed.
4. **Layers, regions, MCP agent tools and proposals inside the library.** Rejected: these are each app's policy, built on top.
5. **Other names** (Armature, Bricolage, Marquetry, Widgetry, Roux and others). Not chosen by the owner.

## Rationale and Evidence

- Both source apps already prove the base model works. What failed was component granularity and styling depth, not the model itself.
- Synapta's TSX SDK gives agents a familiar language and type errors as feedback. Its three tiers cover business UI without client-side author code.
- Clay's recipes restyle the whole app as data with zero runtime JavaScript, and keep colour under one authority (the theme).
- TypeScript-only keeps the project one language. The SDK runtime is already host-API-free in Synapta (`check_widget_sdk_runtime_is_portable`).

## References

- `docs/spec.md` — the normative specification produced from this decision.
- Synapta: `plans/200.1-WidgetRuntimeCore.md`, `plans/200.4-SdkComponentsRendererAndQueue.md` (T4b blocker), `packages/synapta-widget-sdk`, decision `2026-10-17-1221-artifact-driven-widget-ui.md`.
- Clay: `decision-logs/2026-08-28-2234-package-defined-ui-design-systems.md`, `packages/design-rack/package.json` (`uiDesignSystem`), `crates/clay-server/src/shell/components.rs` (`ComponentKind`).

## Consequences

- Phase 0 (plan 001) must prove the primitive set before any library code is built. A no-go reopens spec §5–§6.
- Synapta and Clay each need a full migration to adopt Liveframe. That is accepted; the library is never bent to ease it.
- Revisit if the proof shows that real UI needs product-shaped primitives or raw styling, or if outside agents need a standard wire format (A2UI).
