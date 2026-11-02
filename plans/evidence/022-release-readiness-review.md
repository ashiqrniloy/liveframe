# Release readiness review for 0.2.2

Prepared 2026-11-03 against the `0.2.2-rc.2` candidate (commit `41ca14f`), after the registry-installed `0.2.2-rc.1` and `0.2.2-rc.2` evidence. Plan 022 Task 16 owns the final version, tag, publication, registry verification and handoff. Task 17 (impact analysis) follows the release, as plan 021's Task 19 did.

Every register entry, deferred item and finding below is **fixed** with evidence or **deferred** with the owner's approval. One thing is not fully re-proven: the full `bun run bench` could not be re-run clean on a loaded host after the F1/F2 changes (§ "Bench gates" states exactly what that does and does not cover).

## Owner decisions

| When | Decision | Words |
| --- | --- | --- |
| 2026-11-01 | Scope, opt-in rule and no-break rule | Decision log [2026-11-01-1747](../../decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md) |
| 2026-11-02 | Defer node references to 0.3.0 | "Approved. Defer to 0.3.0. Document in the @roadmap.md" ([decision](../../decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md)) |
| 2026-11-02 | Extension recipe properties and multiple variant axes designed for 0.3.0 | "Approve and log" for each ([extension properties](../../decision-logs/2026-11-02-2208-extension-recipe-properties-for-0-3-0.md), [variant axes](../../decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md)) |
| 2026-11-03 | Publish `0.2.2-rc.1` under `next` | Instruction to complete Task 15 ([release candidate](022-release-candidate.md)) |
| 2026-11-03 | Readiness review: the four deferrals below, `next` caveat, publish | Answered "Go, but fix cold compile first". Fixed (see Finding F1), then answered "Publish rc.2, then 0.2.2" |

## Evidence key

- **P22**: [plan 022](../022-Phase-7-Part-I-Release-0-2-2-Performance-And-Accessibility.md), Tasks 1–15 execution notes.
- **Accept**: [022-acceptance.md](022-acceptance.md), every Expected Outcome bullet and Task 1–13 criterion against the checkout.
- **RC**: [022-release-candidate.md](022-release-candidate.md), `rc.1` (Task 15) and `rc.2` (Task 16) registry checks.
- **Profile**: [022-browser-profile.md](022-browser-profile.md). **Reuse**: [022-validator-reuse.md](022-validator-reuse.md).

---

## Tasks 1–15

| Task | Title | Status and evidence |
| --- | --- | --- |
| 1 | Freeze the 0.2.1 API surface and gate every change through a register | fixed: `scripts/release/api-surface.ts`, baseline `api/0.2.1.json`, `api-stability.test.ts` (7 tests) |
| 2 | Profile browser costs on a production React build | fixed: Profile; dominant cost named (React work) |
| 3 | Reuse unchanged nodes when a whole tree arrives | fixed: whole-tree arrival 2.8 ms development (target ≤ 5.0 ms, from 10.7 ms); reuse pass 0.2 ms |
| 4 | Reuse compiled catalogs across validators | fixed: reuse 0.12–0.19 ms (target ≤ 0.25 ms); first compile now 1.5–4% faster than 0.2.1 (F1); stale-hit defect fixed (F2) |
| 5 | `bindSources()` and `renderKey()` | fixed: two `added` register entries |
| 6 | Opt-in recipe-derived contrast audit | fixed: `auditContrast`, `ContrastFinding`, `designSystemSuite` widened |
| 7 | Opt-in focus continuity in `<Surface>` | fixed: `focusContinuity` prop |
| 8 | `pending`, `mixed`, `current`, `readonly` recipe states | fixed: `states` and `design-system.json` widened |
| 9 | Design node references | deferred to 0.3.0 with the owner's approval (D1) |
| 10 | `nodeRef()` | `n/a`, follows Task 9 (D1) |
| 11 | Accessibility capture axes | fixed for `textScale`, `forcedColors`, `reducedMotion`; `contrast` axis deferred (D3) |
| 12 | Extension recipe properties and variant axes (decisions only) | fixed: both approved for 0.3.0, no code in 0.2.2 |
| 13 | 0.2.2 documentation and compatibility notes | fixed: `CHANGELOG.md`, `docs/compatibility.md`, `docs/adopters-0.2.md` |
| 14 | Prove every acceptance bullet against the checkout | fixed: Accept |
| 15 | Publish `0.2.2-rc.1` and verify it | fixed: RC |

---

## API register (`scripts/release/api/register-0.2.2.json`): 20 entries

All 11 `widened` and 6 `added` entries are **fixed**: the api-stability gate fails on a stale entry, so each change is proven to have happened, and `0.2.2-rc.2` compared against the 0.2.1 baseline gives `diffs: []` ([RC](022-release-candidate.md), Round 2). The 3 `deferred` entries are **deferred** (D1) and the gate fails if any of them ships.

| Subpath | Name | Change | Task | Status |
| --- | --- | --- | --- | --- |
| `.` | `bindSources` | added | 5 | fixed |
| `./pack` | `renderKey` | added | 5 | fixed |
| `.` | `auditContrast` | added | 6 | fixed |
| `.` | `ContrastFinding` | added | 6 | fixed |
| `./preview/capture` | `CaptureMedia` | added | 11 | fixed |
| `./preview/capture` | `CaptureMediaOptions` | added | 11 | fixed |
| `./conformance` | `designSystemSuite` | widened | 6 | fixed |
| `./react` | `createRenderer` | widened | 8 | fixed |
| `.` | `states` | widened | 8 | fixed |
| `./schemas/*` | `design-system.json` | widened | 8 | fixed |
| `./react` | `ImplementationProps` | widened | 8 | fixed |
| `./preview/capture` | `CaptureOptions` | widened | 11 | fixed |
| `./preview/capture` | `CaptureSession` | widened | 11 | fixed |
| `./preview/capture` | `CaptureCell` | widened | 11 | fixed |
| `./preview/capture` | `CapturedCell` | widened | 11 | fixed |
| `./authoring` | `CaptureInput` | widened | 11 | fixed |
| `./authoring` | `AuthoringCaptureCell` | widened | 11 | fixed |
| `./sdk` | `ref` | deferred | 9 | deferred (D1) |
| `.` | `NodeRef` | deferred | 9 | deferred (D1) |
| `./schemas/*` | `catalog.json` | deferred | 9 | deferred (D1) |

---

## Deferred items

| ID | Item | Why | Approval | Migration entry |
| --- | --- | --- | --- | --- |
| D1 | Node references (`ref`, `NodeRef`, `catalog.json` `refProps`) | A catalog declaring `refProps` is rejected by a 0.2.1 validator, so it cannot ship in a patch (R15) | Owner, 2026-11-02, see Owner decisions | `docs/compatibility.md` § "Deferred to 0.3.0" (before/after, adopter checklist) |
| D2 | Proof design systems fail the opt-in contrast audit: 9 non-text boundary findings (3 certified, 6 rack) | The audit is opt-in, so nothing fails; fixing the proof styles is a styling change, not a release blocker | Owner's "Go" and "Publish rc.2, then 0.2.2" on the readiness question that listed it, 2026-11-03 | `plans/backlog.md` P3 "Proof styles fail the opt-in contrast audit" |
| D3 | `contrast` capture axis | Needs Playwright 1.51; the supported peer floor is `^1.49.0` | Same answer as D2; also recorded in P22 Task 11 and Further Actions | Plan 022 Further Actions (revisit when the floor reaches 1.51) |
| D4 | `next` dist-tag may stay below `latest` | npmjs.com "Allow npm dist-tag" toggle may be off; the 0.2.1 release got a 403 on this step | Same answer as D2; owner command is in `docs/compatibility.md` § "Release process" step 4 | `plans/backlog.md` P3 "Enable trusted-publisher dist-tag management" |

## Findings

| ID | Finding | Status | Evidence |
| --- | --- | --- | --- |
| F1 | Task 4's first compile of an unseen catalog was 6–8% slower than 0.2.1, missing the plan's 5% criterion | **fixed**: the owner asked for the fix before release. Interleaved paired runs (9) give checkout/0.2.1 = 0.961–0.985, so it is now 1.5–4% faster | Reuse (follow-up section); `src/schema.ts` `pointerAt`, `src/validate/compile.ts` |
| F2 | The catalog cache entry kept the first caller's catalog object, so mutating it made a later equal catalog fail with "Catalog does not match" | **fixed**: a hit confirms the entry's documents still equal its key, else evicts and compiles fresh | `mutating_the_compiled_catalog_never_stales_an_equal_catalog` in `src/__tests__/validator-smoke.test.ts` |
| F3 | The Task 14 acceptance record counted the register as "4 added, 13 widened, 3 deferred" | **fixed**: corrected to 6 added, 11 widened, 3 deferred | `022-acceptance.md` |
| F4 | The demo host from the registry had one failing test on its first run (not captured) while the host load average was 8.7–11 | **no defect found**: 6 further runs passed 52/52, and the checkout's archive passes 52/52 in `demo:test` | RC, Round 2 |

No other finding is open. Task 17's architectural sweep follows the release and will dispose of anything it finds.

---

## Gates on the candidate (`0.2.2-rc.2`, before the tag)

| Gate | Result |
| --- | --- |
| `bun run check` | 1000 pass, 4 skip, 0 fail (377 s) |
| `bun run release:gate` | 13 of 13 steps |
| `bun scripts/release/peer-floors.ts` | React 19.0.0, Playwright 1.49.0 (23 pass), MCP server 2.0.0 (76 pass) |
| `bun run demo:test` | 52 pass, 0 fail |
| Registry: dist-tags, archive gate, provenance, API stability, demo host | [RC](022-release-candidate.md) Round 2 |

## Bench gates

| Gate | Target | Measured | Status |
| --- | --- | --- | --- |
| Whole-tree arrival, development build (LF-17) | ≤ 5.0 ms median | 2.8 ms (from 10.7 ms); 2.0 ms production | fixed (Task 14, `rc.1` code) |
| Node-reuse pass at 679 nodes | ≤ 1.0 ms median | 0.2 ms | fixed (Task 14) |
| Patch mode | ≤ 2.97 ms median | 2.6 ms development, 1.8 ms production | fixed (Task 14) |
| Second `compileValidator` call, same catalog | ≤ 0.25 ms median | 0.118 ms before the F2 guard; 0.15–0.19 ms with it, under load | fixed |
| First `compileValidator` call, unseen catalog | within 5% of 0.2.1 | 0.961–0.985 of 0.2.1 (9 interleaved runs) | fixed (F1) |
| CSS projection bytes | unchanged | 152,019 B certified, 164,152 B rack | fixed (Task 14) |
| Render bench, agent-home | ≤ 3.0 µs/node, ≤ 2.0 ms | 1.942 µs/node, 1.318 ms | fixed (Task 14) |

**The full `bun run bench` could not be re-run clean after the F1/F2 changes.** The host's load average was 6–20 from unrelated work (two `qemu` VMs, Clay builds, Tilt) for the whole session. Eight attempts failed the micro-timing gates at 6–20 load: validator ≤ 1.5 µs/node and the `applyPatch` 0.5 ms median. The measurement was disturbed rather than the code: the generic `checkValue` baseline, which no change touches, slowed by the same factor (1.0 → 1.4–1.8 µs/node), and the `rc.1` code, run under the same load, failed the same gate (1.62 µs/node on agent-home). What changed since `rc.1` is install-time only (`pointerAt` in `src/schema.ts`, the catalog-cache lookup in `src/validate/compile.ts` and their test); `validateTree`, `applyPatch`, `diffTrees`, the renderer and the CSS projection are byte-identical to the code Task 14 measured clean. The new gates (F1, reuse) were measured with interleaved A/B runs, which load affects equally. A clean `bun run bench` is a remaining item for a quiet host; CI does not run the bench.

## The four laws

Unchanged by this release. Task 14 re-checked them by name against `0.2.2-rc.1`; the only runtime changes since are in `compileValidator`'s catalog cache and the install-time schema check, whose outputs are identical. The cache is content-keyed, bounded (8) and never reached with an invalid document (`invalid_catalog_never_hits_cache`); the new hit-time check can only evict.

1. **Widget code never runs in the browser:** no change.
2. **The UI tree is data, validated before the renderer reads it:** `shareNodes` runs only after `validateTree`; the cache returns the same checks that compile would.
3. **Widget code never sets colours or raw CSS:** no change; `auditContrast` reads recipes and resolved roles only.
4. **A widget never holds authority:** `bindSources` resolves no data; `renderKey` is a pure hash.

## Go / no-go

**GO**, on the owner's words recorded above: "Go, but fix cold compile first" (fixed, F1), then "Publish rc.2, then 0.2.2". `0.2.2-rc.2` is verified from the registry; the final archive will be compared with it byte for byte except `package.json`, `CHANGELOG.md` and `README.md`.
