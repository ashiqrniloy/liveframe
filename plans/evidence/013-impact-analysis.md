# Plan 013 — architectural impact analysis

Reviewed 2026-10-27 against the delivered Tasks 1–13 (commits `283cb4d`…`f98abd8`),
the plan's acceptance criteria, the pre-release review
(`plans/evidence/012-release-readiness-review.md`), the repository audit
(`plans/evidence/013-repository-audit.md`), the agent acceptance record
(`plans/evidence/013-agent-acceptance.md`), decision log
`2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R1–R20), and all
twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** §13 was updated in this plan with the shipped layout, the runtime
   matrix, the binary and the measured peer floors, and it matches the package
   except one line (F1): "What the package ships, and nothing else" still omits
   `SECURITY.md` (`docs/spec.md:713`) although `package.json` `files` names it
   (`package.json:111-117`) and the archive test pins it
   (`src/__tests__/archive.test.ts:12,61`). The shipped tarball has 190 files and
   contains it. Every other §13 clause — 14 runtime export paths plus
   `./schemas/*`, `dist/cli/liveframe.js`, Bun ≥ 1.4.2, the three peer floors —
   is what shipped.

2. **Public API and formats.** No export, subpath, format field or format version
   changed after the plan-012 freeze. The 15 export paths are pinned
   (`src/__tests__/exports.test.ts`, `every_export_has_types_and_default`), and
   the T12 review found 80 of 81 declarations byte-identical to `700fe68`; the
   sole `schema.d.ts` delta is the reviewed N1 restoration of boolean
   annotations (`src/schema.ts:13,26`). All `$id`s stay
   `urn:liveframe:<format>:1`. Package metadata only: version `0.1.0`,
   `publishConfig.tag: next`, `files` with `SECURITY.md`. The stale `next`
   dist-tag (`0.1.0-rc.4`) was explicitly permitted by Task 13 as a note; not a
   finding.

3. **The four laws.** Re-proved from the installed package, not the checkout.
   Law 1: the archive gate bundles `/react`, `/preview/react`, `/css` and
   `/conformance/react` from the installed archive and fails on the draft
   marker (`scripts/release/archive-gate.ts` step 5); the demo's
   `preview_bundle_has_no_draft_code` and `no_draft_code_reaches_the_page` pass,
   and the agent acceptance captured only through the installed package. Law 2:
   archive-gate step 1 renders the same re-validated trees through both runners,
   and T12's timeout forwarding sends the effective limit with the request
   (`src/preview/worker/index.ts:136,147`), held by
   `worker_constructor_timeout_reaches_render` and the forged-result tests. Law 3:
   no recipe, token, sheet or projection code changed; the demo's `demo-warm`
   theme and `demo-round` design system are app-owned
   (`examples/demo-host/app.ts:29,40`). Law 4: the MCP server still exposes seven
   authoring tools and no store/dispatcher; the demo refuses undeclared actions,
   the preview page records intents without dispatching, and the agent
   acceptance ended with an empty action log. None new.

4. **Validation.** No library input format changed. The only new evaluated value
   is T12's effective worker timeout, which is now carried with the render request
   instead of being dropped (F-free; `src/preview/worker/index.ts:136,147`). The
   demo's HTTP bodies are app code validated against the shipped formats before
   pack/store/dispatch, and they are not a library contract. Install/load/render
   validation is unchanged. None new.

5. **Styling.** None — this plan changed no recipe, token, CSS projection or
   theme authority. The demo's second theme and design system are app fixtures,
   proved by `designSystemSuite` and `rendererSuite` from the installed archive,
   not a new library surface.

6. **Interaction tiers.** None changed. The demo exercises all three tiers as an
   app: tree render, `setState` through `POST /placements/:id/intents` after a
   manifest-state check, and an action dispatched only after the manifest,
   capabilities and args re-check, with an action log
   (`examples/demo-host/tests/server.test.ts` `intents_are_rechecked_before_dispatch`).
   No intent tool was added to the MCP server.

7. **Performance.** Every task recorded its numbers, and no budget regressed:

   | Task | Measurement | Result |
   | --- | --- | --- |
   | T1 | `bun run build`, cold | 0.24 s, 81 `.js` + 81 `.d.ts`; whole check 4 m 21 s |
   | T2 | archive gate wall time | 3.1 s warm, 8.4 s cold; no budget |
   | T3 | peer floors | 61 s React, 57 s Playwright, 9 s MCP; no budget |
   | T4 | docs only | n/a |
   | T5 | demo start / first render / later render | 452 ms / 43–47 ms / 5–8 ms |
   | T6 | capture cost | 110–123 ms per cell (16 cells); 709–746 ms for one MCP cell |
   | T7 | audit only | n/a |
   | T8 | CI workflow | about 10 min |
   | T9 | publish dry run | about 10 min |
   | T10 | registry archive gate | seven steps, passed |
   | T11 | agent acceptance | 322 s first proof, 40 s install/place/browser, 560 s measured total |
   | T12 | three quiet `bun run bench` runs | validator 1.397/1.443/1.419 µs/node (≤1.5); render 2.253/2.316/2.255 µs/node (≤3); agent-home 1.2372/1.3130/1.2895 ms (≤2); coverage 511 pass in 102.93 s |
   | T13 | publish / gates | publish 7 m 22 s; registry gate 5.7 s; demo 35 s |

   No threshold changed. A post-release local `bun run check` on this loaded host
   (unrelated `qemu`/`podman`/`tsc` jobs, load 27–170) failed 15 browser/capture
   timeouts; the exact release commit's CI check passed 637/0, and the failures
   are the known loaded-host class recorded since Task 4. Not a finding.

8. **Portability.** The archive gate proves the browser bundle, a strict NodeNext
   consumer with `skipLibCheck: false`, and plain-Node imports of `.`, `/sdk`,
   `/css`, `/pack`, `/store` and `/conformance` (`scripts/release/fixtures/node-probe.mjs`).
   `compiled_output_is_host_api_free` still scans `dist`. One coverage gap (F5):
   `/preview` is declared host-API-free in spec §13 but is not in the Node probe;
   a manual `node` import of `@arnilo/liveframe/preview` on Node 26.11.1 succeeds.
   Windows remains untested (G29 deferred, listed in the release notes).

9. **Agent authoring.** The seven MCP tools, their arguments and error shapes are
   unchanged. The rc.3 docs-only agent run found that the preview binding and
   install/place bodies were undocumented; the fix added `docs/demo-agent.md` and
   linked it from README, preview and MCP guides (T11), and the rc.3 rerun
   authored, captured, installed, placed and verified with matching hashes. The
   MCP guide test keeps `docs/mcp.md` example-consistent. None new.

10. **Docs and examples.** `README.md` is npm-ready; `docs/security.md`,
    `docs/compatibility.md`, `CHANGELOG.md`, `SECURITY.md` and
    `docs/demo-agent.md` exist and ship; `docs_links_resolve` checks relative
    targets against both the checkout and the packed file list, and the registry
    tarball has zero broken targets. Every guide uses the `liveframe` binary, and
    `graft grep "src/cli/liveframe.ts"` finds no Markdown hit. Two doc defects
    (F2, F3): the 0.1.0 GitHub release and changelog limitations omit the
    URL-valued-props guidance Task 13 listed, and four guides still say the
    package is pre-release or that the React renderer is planned work.

11. **Conformance.** No library surface changed, so no suite gained a case. The
    demo registers `storeSuite`, `catalogSuite`, `designSystemSuite`,
    `rendererSuite` and `rendererBrowserSuite` from the installed archive
    (`examples/demo-host/tests/conformance.test.ts:26-43`,
    `conformance-browser.test.ts:38`) and passes 27 + 10 cases. `docs/conformance.md`
    records the T6 fixture lesson (an open dialog's content mounts in a portal
    after load). None new.

12. **Reference hosts.** The Synapta and Clay snapshots were removed from the
    tree and history (T7); the proof tests that read them skip when absent, and
    the audit record keeps the hashes. One audit open item remains (F4):
    `src/__tests__/fixtures/widgets/git-status/labels.ts` is a near-verbatim copy
    of Clay's `packages/git/src/status.ts` and the owner never ruled on it
    (`plans/evidence/013-repository-audit.md:75`). This plan added no `AuthoringConfig`
    field, tool or host obligation.

## Findings

| ID | Finding and evidence | Recommended |
| --- | --- | --- |
| F1 | Spec §13's shipped-files list omits `SECURITY.md` while the package and archive ship it (`docs/spec.md:713`; `package.json:111-117`; `src/__tests__/archive.test.ts:12,61`). Spec drift, docs only. | execute |
| F2 | The `v0.1.0` GitHub release and the `0.1.0` changelog known limitations omit the URL-valued-props guidance Task 13 required; it exists in `docs/security.md:20` and `docs/formats.md:43` but is not named in the release notes. | execute |
| F3 | Shipped guides still say "The package is pre-release" (`docs/conformance.md:6`, `docs/packages.md:13`, `docs/sdk.md:8`) and `docs/styling.md:8-9` says "the public React renderer remains planned work", which is false after 0.1.0. | execute |
| F4 | The audit's open item is unresolved: `src/__tests__/fixtures/widgets/git-status/labels.ts` is a near-verbatim Clay copy and the owner has not ruled on it (`plans/evidence/013-repository-audit.md:75`). Needs an owner decision: keep as the owner's own code, replace, or attribute. | backlog |
| F5 | The archive gate's Node probe omits `/preview`, which spec §13 declares host-API-free (`scripts/release/fixtures/node-probe.mjs`); a manual Node 26.11.1 import of `@arnilo/liveframe/preview` succeeds, so this is verification coverage, not a defect. | backlog |

## Owner disposition

**Recommended dispositions: `execute` F1–F3 now, `backlog` F4–F5.**
F1–F3 are docs/metadata only and add no code, export, format or runtime
behaviour; they reach adopters in the next release. F2's release-notes edit is
external metadata and can be applied immediately. F4 needs an owner ruling on
third-party-derived code in the public repository. F5 is a release-script
coverage improvement.

**Owner's answer (2026-10-27): approve as recommended.** F1–F3 were executed
and F4–F5 handed to `plans/backlog.md`; the outcome per finding is in the table
below.

| ID | Disposition | Result |
| --- | --- | --- |
| F1 | execute | `SECURITY.md` added to spec §13's shipped-files list (`docs/spec.md`). |
| F2 | execute | URL-valued-props bullet added to the `0.1.0` changelog and the `v0.1.0` GitHub release notes; it links `docs/security.md`. |
| F3 | execute | The four guides say "pre-1.0" and `docs/styling.md` states the React renderer ships in `/react`; README's status line says "Pre-1.0". |
| F4 | backlog | "Decide the Clay-derived git-status labels fixture", P2, in `plans/backlog.md`. |
| F5 | backlog | "Cover /preview in the archive gate's Node probe", P3, in `plans/backlog.md`. |

Task 14 and plan 013 are complete.

## Verification

Re-run for this analysis on 2026-10-27, `f98abd8`, Bun 1.4.4:

- `bun run build` — passed; 81 `.js` + 81 `.d.ts`.
- `timeout 900s bun run check` — CI on the release commit `9c08789` passed
  (`637` pass, 4 intentional skips, 0 fail; run
  [40484529746](https://github.com/ashiqrniloy/liveframe/actions/runs/40484529746)).
  A local post-release run on the loaded host recorded the known browser/capture
  timeouts; not a pass.
- Three quiet `bun run bench` runs — T12 evidence
  (`evidence/013-task-12/bench-quiet-{1,2,3}.log`), every gate passed.
- `timeout 900s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.1.0`
  — passed all seven steps in 5.7 s (Task 13).
- `examples/demo-host` from the registry `0.1.0` — typecheck clean, `48 pass`,
  `0 fail`, 117 assertions; `bun run demo:test` against the packed archive also
  `48 pass`.
- `bun audit` — no vulnerabilities in 94 packages.
- `npm view @arnilo/liveframe dist-tags` — `latest: 0.1.0`, `next: 0.1.0-rc.4`
  (permitted note).
- `git diff --check` — clean; `graft build` — clean.
