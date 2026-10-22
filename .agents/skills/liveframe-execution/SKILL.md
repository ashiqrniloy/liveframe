---
name: liveframe-execution
description: >-
  Execute work in the Liveframe repo (`@arnilo/liveframe`, runtime-composable UI): formats and validator, the TSX SDK, design-system recipes and CSS projection, the React renderer, conformance suites, and the Phase 0 primitive-set proof. Use it to implement, fix, refactor or review code, or to execute a plan task ("do task N", "next unchecked task"). Do NOT use it to write a new plan (create-plan) or to look up third-party library docs (find-docs).
---

# Liveframe Execution

A router. Apply **Always apply**, read the architecture reference, then read **one** area reference. Open spec sections and code only at the spans you need.

## Where the repo is

- `docs/spec.md` is the normative design. `roadmap.md` §3 holds the current phase, the plan ledger and the next free plan number. Never copy execution state into a skill or a doc.
- The root export provides formats, install validators, the compiled tree validator and the recipe resolver; `./schemas/*` publishes their JSON Schemas. See the area references for implementation details. Later work adds the subpaths (`/sdk`, `/pack`, `/store`, `/store/fs`, `/preview`, `/preview/worker`, `/preview/react`, `/css`, `/react`, `/conformance`).
- Phase 0 proof code lives in `proof/` and is never published or imported by `src/`.

## Always apply

- **Authority order.** `docs/spec.md`, then accepted `decision-logs/`, then `roadmap.md`. When a task changes what the spec means, update the spec in the same task. A finalized decision uses `create-decision-log`.
- **The four laws (spec §2).**
  1. Widget code never runs in the browser.
  2. The UI tree is validated data.
  3. Widget code never sets colours or raw CSS.
  4. A widget never holds authority.
  Never weaken a test that enforces one of them.
- **Primitives only.** The library ships no components and no visual style. Catalogs hold primitives; anything composable from primitives is widget code.
- **Host-API-free core.** Nothing outside `/react`, `/css`, `/store/fs`, `/preview/worker`, `/preview/react` and the CLI imports `node:`, `bun:`, DOM globals or `require`.
- **The problem class first.** Never bend the design to ease Synapta's or Clay's migration; record their gaps instead.
- **Simplest thing that holds.** No feature the spec doesn't require. No new runtime dependency without a plan task that justifies it.
- **Green after every task.** `bun run check` passes before a checkbox is ticked.
- **Commit per task.** Subject `Plan NNN T<k>: <task title>`, staging only that task's files by path. Never push unless asked.

## Graft first

```bash
graft ask "<task or question>" --source   # ranked nodes with code spans
graft skeleton <file>                     # a file's API surface
graft callers <symbol> --depth all        # before any rename, move or delete
graft grep "<literal>"                    # every occurrence
```

Run `graft build` after large changes.

## Route

Read [references/architecture.md](references/architecture.md) first whenever a task adds or moves code, or you can't tell where a change belongs. Then pick one area reference:

| Task touches | Read |
| --- | --- |
| Phase 0: the reference UIs, the primitive set, the proof harness, the §12 report and parity re-proof | [references/proof.md](references/proof.md) |
| Definitions, catalogs, the UI tree, intents, the validator | [references/formats.md](references/formats.md) |
| JSX runtime, `state.set` / `action`, `render()`, `liveframe gen` | [references/sdk.md](references/sdk.md) |
| `pack()`, widget packages, scenarios, records, the `Store` interface, reference stores, `loadPlacement()` | [references/storage.md](references/storage.md) |
| Runners, preview sessions, `<Preview>`, `liveframe preview capture` | [references/preview.md](references/preview.md) |
| Themes, design systems, recipes, style props, CSS projection | [references/styling.md](references/styling.md) |
| `<Surface>`, `implement()`, reconciliation, `onIntent`, conformance suites | [references/renderer.md](references/renderer.md) |

## Supporting skills

- `karpathy-guidelines`: all writing, reviewing and refactoring.
- `typescript-advanced-types`: catalog-derived prop types, the JSX namespace, schema-to-type inference.
- `find-docs`: any library, framework or CLI question (React, Bun, TypeScript, Biome, Playwright). Prefer it over training data.
- `create-plan`: writing or amending a plan. `create-decision-log`: a finalized decision.
- `skill-creator`: creating or changing a skill.

## Plan-task loop

1. Read the whole plan file and the roadmap phase it implements.
2. Take the first unchecked task, unless the user names one.
3. Implement only that task. A small, explicitly noted prerequisite is allowed.
4. Run the task's tests plus `bun run check`.
5. Tick the box only when they pass. Write `Notes (executed <date>)`: what changed, findings that affect later tasks, and any spec change.
6. If a finding invalidates a later task, amend that task now and say why.
7. Commit the task, then move to the next.
8. At plan end, run `## Verification (whole plan)`, the impact-analysis task, and the backlog handoff (`create-plan` § Execution updates).
