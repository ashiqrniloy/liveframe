# Plan 020 Task 7: installed-candidate agent acceptance

Passed against registry-installed `@arnilo/liveframe@0.2.0-rc.3`, using a fresh
agent with no inherited conversation. Its product inputs were only the installed
`README.md` and `docs/`, the running demo host, and public authoring results.
It imported the operator-supplied config through the documented interface;
it did not read repository source, tests, declarations, config source, the demo
README or previous acceptance artifacts.

## Host preparation

The operator copied `examples/demo-host/` outside the repository to
`/tmp/liveframe-020-t7-demo`, set its package dependency to `0.2.0-rc.3`, ran
`timeout 120s bun install`, and started it with `timeout 2400s bun run start`.
The installed package, rather than source-condition exports, supplied every API.

Public introspection found a fixture prerequisite: the stock demo has no
object-carrying event or source capability. The operator augmented only that
isolated copy, retaining the setup script as
`evidence/020-agent-acceptance/setup-host.ts`. It adds a native `form` primitive
with an object-carrying `onSubmit` event, nullable `note`, complete recipes and
an implementation; `demo.note` has a `sourceOutcome` result schema. The host
resolves declared source aliases to an `ok` envelope containing
`"Host supplied note"`. Startup validates the augmented documents. The fresh
agent learned the changed contract through refreshed public introspection.
These are app-owned fixture additions, not changes to the published package or
repository demo. The initial, narrower proof remains under `preliminary/` and
is not counted as the complete-feature pass.

## Acceptance results

| Condition | Evidence and result |
| --- | --- |
| In-process `/authoring`, explicit runner | `createAuthoring({ catalog, capabilities, runner: inProcessRunner() })` packs and renders `docs-acceptance-form@1.0.0`. |
| Object form event and nullable field | Generated `Form` binds `onSubmit={state.set("fields")}`. Saved tree assertions verify the implicit object binding has no fixed `value`; params, state and source payload include nullable `note`. |
| Source-outcome envelope | Two seed scenarios render successfully; `renderScenarios({ outcomes: true })` passes ten checks, all five statuses per seed. The placed surface shows host-resolved text, distinct from preview data. |
| Own-draft capture | `/preview/capture` with injected `playwrightBackend(playwright)` produces eight clean cells: two scenarios × two themes × two design systems at width 360, each with PNG and ARIA snapshot. |
| Ephemeral paint | `renderElements` produces validated JSON; an app-owned renderer paints it through documented SSR, then a browser captures the resulting HTML. No widget is installed for this surface. |
| Publish and place | `POST /widgets`: 201; `PUT /placements/docs-acceptance-form`: 200; `GET /surfaces/docs-acceptance-form`: 200. Authoring, last-preview and installed hashes match. |
| No action dispatched | Manifest and placed action logs are empty. Browser audit records seven GET requests, no intent requests, no draft module requests and zero page errors. No form event is emitted during acceptance. |
| Drafts reach only runners | Authoring and preview explicitly use the backend in-process runner; placement uses the demo's worker runner. Browser receives the host client and rendered surface data. Ephemeral input is JSON, with no widget code. |

Final hash:

`sha256-b2f8fca7d71e7cd6f7dbe7eeea188dee76d2e90dddf98f6cdb7648d92b8b17bc`

## Timing, iterations and findings

The fresh session started **2026-10-29 21:31:14 UTC**. Its first full-feature
run was **21:33:24.885–21:33:26.633 UTC (1.748 s)**. After additional security
assertions, an unchanged-draft replay passed at **21:40:04.015–21:40:05.558 UTC
(1.543 s)**, 531.558 seconds after session start, including documentation reads,
the fixture repair, inspection and reporting. Final artifact verification ended
at **21:40:12 UTC**, for **538 seconds** total. Ephemeral browser paint and the
independent saved-artifact verifier also exited zero. There was **one complete
widget content iteration**, with no draft correction or capture retry.

Every Liveframe API guess was recorded:

| Finding | Disposition |
| --- | --- |
| Initial cleanup assumed `inProcessRunner` had worker-style `close()`. Preliminary assertions passed before cleanup threw. | Resolved against existing installed `docs/packages.md:274–301`: `Runner` requires `render`; `close()` is documented for the worker runner. Cleanup was corrected and rerun successfully. |
| Initial ephemeral renderer supplied bindings only for used kinds while passing the full catalog. Startup rejected missing bindings. | Resolved against existing installed `docs/renderer.md:115–119`, which explicitly requires exactly one binding per catalog kind. The independent ephemeral host uses a matching three-kind catalog and three implementations. |
| Stock demo lacks the requested form/source contracts. | Operator repaired the isolated fixture, as described above; the full run then passed. No unpublished host endpoint or source fallback was supplied to the agent. |

The API guesses were agent mistakes already answered by shipped documentation;
no unresolved documentation gap, archive documentation change, new candidate or
backlog waiver was needed. Ancillary Playwright browser inspection used ordinary
host automation calls, not extra product context. No external documentation or
outside-published-doc product/source reads were used by the fresh agent.

## Reproduction and local artifacts

All scripts, drafts, JSON transcripts, images and ARIA snapshots are local-only
under `evidence/020-agent-acceptance/` (E). Images are never committed. The host
working directory is `/tmp/liveframe-020-t7-demo` (H).

After preparing a fresh registry-installed host as above, run the operator's
`timeout 15s bun E/setup-host.ts` once before starting it. The script currently
uses these absolute E/H locations. Scripts import the opaque config relatively,
so copy them beside it and run from H:

```sh
timeout 10s cp /home/arn/Projects/liveframe/evidence/020-agent-acceptance/acceptance.ts ./acceptance.ts
timeout 10s cp /home/arn/Projects/liveframe/evidence/020-agent-acceptance/acceptance-ephemeral.tsx ./acceptance-ephemeral.tsx
timeout 120s bun acceptance.ts
timeout 30s bun acceptance-ephemeral.tsx
timeout 10s bun /home/arn/Projects/liveframe/evidence/020-agent-acceptance/verify.ts
```

Reposting the identical draft is supported. `acceptance.ts` regenerates
`draft.json`, authoring/outcome trees and statuses, `captures/index.json`, all
capture PNGs/snapshots, `last-preview.json`, install/placement/surface responses,
`browser-audit.json`, `placed.png` and `summary.json`.
`acceptance-ephemeral.tsx` regenerates `ephemeral.html` and `ephemeral.png`.
`verify.ts` independently checks event bindings, nullable payload, ten outcome
renders, eight valid PNG/snapshot pairs, HTTP statuses, hash parity and ephemeral
HTML. `agent-report.md` records the fresh agent's input audit and findings.

The agent viewed
`captures/nullable_360_demo-warm@1.0.0_demo-round@1.0.0.png` and `placed.png`
(both regenerated by `acceptance.ts`) and `ephemeral.png` (regenerated by
`acceptance-ephemeral.tsx`). Controls and labels were visible without clipping;
the fixture form and independent ephemeral paint intentionally use plain host
HTML rather than adding a visual design.

Repository validation: `timeout 900s bun run check` passed: **847 pass, 4 skip,
0 fail**, 851 tests across 107 files, tests elapsed 307.02 s. The log is local
at `/tmp/liveframe-020-t7-check.log`. No spec or public API changed. Reference
runners execute trusted drafts with process permissions; this proves the
authoring workflow, not isolation. Task 8's owner review remains separate.
