---
date: 2026-10-25 02:31
status: approved
decision_about: "0.1.0 release: license, runtimes and packaging, the API and format freeze, security hardening, publishing and release gates"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Release 0.1.0 — hardening, API freeze and publishing (R1–R20)

## Decision

0.1.0 ships under the MIT license as compiled ES2022 JavaScript with `.d.ts` files. It ships only after the readiness review's security fixes, defect fixes and API-freeze changes (R3–R13) are in. Publishing runs from a public GitHub repository, with the npm CLI used only in the publish job, through trusted publishing with provenance. A release candidate goes out under `next` first. A second full review checks every readiness item just before 0.1.0 is published. The native Windows forced-colours and assistive-technology audit (G29) is deferred past 0.1.0 and listed as a known limitation.

The individual decisions:

- **R1 — License.** MIT. Spec §15's only open decision is closed.
- **R2 — Runtimes and packaging.**
  - The backend subpaths (`/store/fs`, `/preview/worker`, the in-process loader and the CLI) support Bun ≥ 1.4.2.
  - The host-API-free subpaths support any ES2022 runtime.
  - The browser subpaths (`/react`, `/preview/react`, `/conformance/react`, `/css`) support any ESM bundler.
  - The package ships `tsc`-compiled JavaScript and declarations (TypeScript 7, `rewriteRelativeImportExtensions`), the published JSON Schemas, `LICENSE`, `README.md` and `CHANGELOG.md`. It ships no tests, fixtures or raw `.ts` sources.
- **R3 — Runner trust.**
  - `workerRunner()` re-validates every result on the host thread with the validator it compiles from `{ catalog, capabilities, pkg.manifest }`. Each request carries an id, and a result is accepted only for the pending id.
  - An unsolicited or duplicate result message terminates the worker and fails the pending render with `render-failed`.
  - The residual risk stays documented: one worker serves every package, so hostile code needs the app's isolated runner.
- **R4 — Runner caches.**
  - The reference runners use `pkg.hash` as a cache key only after checking it against `packageHash(pkg)`, once per package object.
  - Validator caches are bounded.
  - `workerRunner()` recycles its worker after a bounded number of distinct loaded packages, because loaded modules cannot be unloaded.
- **R5 — Patterns in widget-authored schemas.** A manifest's `params`, `state` and `context` schemas may not use `pattern`, so widget authors cannot cause catastrophic regex backtracking on the host or in the browser. Catalog and capabilities schemas, which the app authors, keep `pattern`.
- **R6 — Top-level `await`.** Widget modules may not use top-level `await`, matching spec §7.1's "pure and synchronous". `pack()` and `verifyPackage()` reject it. The in-process runner also bounds module loading by `timeoutMs`.
- **R7 — Store contract.**
  - `Store` gains `getPlacement(id)`, so `loadPlacement()` reads one placement instead of scanning and validating all of them. One malformed sibling no longer blocks a load.
  - `fileStore` stores a key segment whose encoded name would exceed a safe file-name length under a deterministic hashed name, so every valid id is storable.
  - Store rejections are `LiveframeFailure`s (R8).
- **R8 — Typed thrown errors.** A new root-exported class `LiveframeFailure extends Error` carries `errors: readonly LiveframeError[]`.
  - These throw it instead of `Error(JSON.stringify(errors))` or plain objects: `compileValidator`, `resolveRecipes`, `styleDeclarations`, `createRenderer` (its `RendererError` becomes a value-exported subclass) and store rejections.
- **R9 — Internal surface removed before the freeze.**
  - `CompiledValidator.build` is no longer part of the public type.
  - The root's `NodeCheck` and `NodeCheckSink` aliases are removed.
  - `PreviewSession` becomes an explicit interface rather than `ReturnType<typeof createPreview>`.
- **R10 — Error-kind growth.** `LiveframeError["kind"]` may gain kinds in minor releases. Consumers must handle unknown kinds, and spec §10 and the format guide say so.
- **R11 — JSON Schema identity.** Schema `$id`s become format-versioned URNs, `urn:liveframe:<format>:1`. The widget-package schema references `urn:liveframe:manifest:1`. Schemas load from the package; no domain is needed or claimed.
- **R12 — Names stay.** British spellings (`colours`, `colourRoles`, `colour-outside-theme`) and the `liveframe/1` tree id are kept as specified. DTCG field names (`colorSpace`, `colorScheme`, `color`) stay as DTCG spells them.
- **R13 — MCP shapes before the freeze.** The seven tools stay. `list_vocabulary` also returns the catalog id. `pack_draft` and `render_scenarios` return one error shape (`LiveframeError[]` with document pointers) for argument errors too. `render_scenarios` refuses a tree past a byte budget with a typed `limit-exceeded`. Tool calls that touch the session or the bound page are serialized, the page is bound exactly once, and capture errors carry their correct kinds.
- **R14 — Peer ranges.** The peer ranges widen to the oldest versions CI proves, for `react`/`react-dom`, `playwright` and `@modelcontextprotocol/server`.
- **R15 — Compatibility policy.**
  - 0.1.x patch releases never break the public API, the formats or the on-disk `fileStore` layout.
  - Any breaking change in 0.x comes at a minor version, with a deprecation in an earlier release where that is feasible.
  - A format's meaning never changes within its `/N` version.
- **R16 — Repository and CI.** The repository is public on GitHub. CI runs on GitHub Actions with Bun only.
- **R17 — Publishing.**
  - The publish job alone uses the npm CLI (≥ 11.5.1, with the Node it needs), for trusted publishing with automatic provenance. AGENTS.md records this as the only exception to "Bun is the only tool runner".
  - The owner holds the `@arnilo` npm scope with 2FA.
  - If a trusted publisher cannot be configured before the package exists, the first release candidate is published once with a short-lived granular token, and trusted publishing is configured before any further publish.
- **R18 — Release sequence.**
  1. `0.1.0-rc.N` is published under the `next` tag. npm also gives a package's first version `latest`.
  2. The demo host and the agent acceptance run are verified from the registry.
  3. The pre-release review (R19) produces a go.
  4. `0.1.0` is published as `latest`.
- **R19 — Pre-release review.** Just before 0.1.0 is published, a full review re-checks every item in `plans/evidence/012-release-readiness-review.md` and sweeps again for regressions. Every item must be fixed with evidence, or deferred with the owner's explicit approval, before the owner's go.
- **R20 — Demo host and G29.**
  - The demo host is an example in this repository (`examples/demo-host/`). It runs from the installed package and is not deployed.
  - G29 is deferred past 0.1.0. The roadmap's Phase 6 Done line is amended, the backlog entry stays open, and the release notes name the limitation.
  - Cognitive complexity is gated by Biome's `noExcessiveCognitiveComplexity`. Each exception documents its reason, and splitting a render-path function happens only under the bench gates.

## Context

Phases 0–5 and 8 were implemented, and a release-readiness review (2026-10-25) assessed implementation, tests, public surface, security, complexity and the MCP server. It found:

- The package cannot be consumed by Node, or by TypeScript projects with ordinary settings: 81 TS5097 errors.
- The worker runner accepts forged results: a widget answered 15 of 20 later renders of other packages.
- Widget-authored regex patterns backtrack exponentially on the host.
- Top-level `await` hangs the in-process runner.
- `fileStore` cannot store valid long ids.
- One malformed placement blocks every load.
- There are several MCP concurrency and error-kind defects.
- Several public surfaces would need breaking changes after release.

The findings, with their probes, are in `plans/evidence/012-release-readiness-review.md`.

## Approval

- Proposed by: agent (the review's recommendations).
- Approved by user: Yes.
- Approval evidence:
  - "Decisions: 1. MIT The rest as you recommended. Create the plan documents required … to release 0.1.0. Just before the release, another review should be done to see if all the items here have been covered" (2026-10-25).
  - Follow-up answers on 2026-10-25: publish with "npm in publish job"; `liveframe.dev` ownership "No / not sure", so URN `$id`s; G29 "Defer G29 past 0.1.0"; `@arnilo` scope with 2FA and a public repository "Yes to both".

## Alternatives Considered

1. **Apache-2.0** — not selected; the owner chose MIT.
2. **Ship raw TypeScript sources** — rejected. Node refuses type stripping under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). A `strict` NodeNext consumer gets 81 TS5097 errors because `.ts` sources are type-checked even with `skipLibCheck`. Bundlers would compile the library's `.tsx` with the consumer's JSX settings.
3. **Also restart the worker for every package change (R3)** — not selected, for latency. Re-validation and correlation make a forged tree harmless to law 2. The remaining cross-package spoofing of a *valid* tree is documented: the reference runners are not sandboxes.
4. **A heuristic safe-regex check instead of R5** — rejected. Heuristics miss cases, and ECMAScript has no time-bounded matching.
5. **Keep top-level `await` (R6)** — rejected. It contradicts §7.1 and hangs the in-process runner.
6. **Keep `liveframe.dev` `$id`s** — rejected. Ownership is not confirmed. A tool that fetches `$ref`s would trust whoever controls the domain.
7. **Normalise names (R12)** — rejected as churn. The spelling is deliberate in the spec.
8. **`bun publish`** — rejected. Bun documents that it "cannot generate provenance statements yet" (`--provenance` is an error).
9. **Publish manually from a local machine** — rejected. It gives no provenance and no reproducible pipeline.
10. **Run G29 before 0.1.0** — deferred by the owner. No Windows machine with a screen reader is available.

## Rationale and Evidence

- Readiness probes (`/tmp/…/scratchpad/probes.test.ts`, reproduced in the evidence file):
  - P1, a forged worker result: `ok: true`.
  - P2, cross-package hijack: 15 of 20.
  - P3, pattern backtracking: 2/21/79/313 ms at 18/22/24/26 characters.
  - P4, top-level `await`: pending after 1.5 s with `timeoutMs` 100.
  - P5, `fileStore`: `ENAMETOOLONG` on a 128-code-point id.
  - P6, one malformed placement: blocks `loadPlacement` of a good one.
- Packaging: a packed archive was installed into a consumer project. `node -e 'import("@arnilo/liveframe")'` failed with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, and a default-strictness `tsc -p .` reported 81 errors. The dry-run archive holds 234 files, 142 of them tests or fixtures.
- TypeScript 7.0.2's `tsc --help --all` lists `--declaration`, `--emitDeclarationOnly` and `--rewriteRelativeImportExtensions`. Context7 `/microsoft/typescript/v7.0.2` baselines show relative `.ts` specifiers rewritten on emit. No new tool is needed for R2.
- Bun docs (`/websites/bun_sh`, `bun publish`) say `bun publish` cannot generate provenance, and that a package's first version always also gets `latest`.
- npm docs (`/websites/npmjs`, trusted publishers) say:
  - trusted publishing requires npm CLI ≥ 11.5.1 and Node ≥ 22.14.0;
  - provenance is generated automatically from GitHub Actions for a public package from a public repository;
  - the workflow needs `id-token: write`.
- Every check passes today (590 tests). The validator bench passes at a worst case of 1.457 µs per node. The render bench's 5-node workload measured 3.006 µs per node against 3, a noise-dominated tiny tree. R20's bench work stabilises the measurement and never relaxes the threshold.

## References

- `plans/evidence/012-release-readiness-review.md` — every finding with an id, its evidence and its covering task.
- `plans/012-Phase-6-Part-A-Release-Hardening-And-API-Freeze.md`, `plans/013-Phase-6-Part-B-Packaging-Demo-And-Release.md` — the tasks that carry out R1–R20.
- `docs/spec.md` §5, §7.1, §7.3–§7.5, §10, §11, §13, §15 — updated by the tasks that implement each decision.
- `roadmap.md` Phase 6 — amended for R18–R20.
- `plans/backlog.md` — G29 (deferred), the installed-archive gate and the test-fixture exclusion (scheduled), and MCP and SDK entries pulled into Part A.
- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers); [bun publish](https://bun.sh/docs/pm/cli/publish).

## Consequences

- Positive:
  - Consumers on Bun, ESM bundlers and TypeScript can install and type-check 0.1.0.
  - The backend never returns an unchecked tree from a reference runner.
  - No widget author can stall the host with a pattern.
  - The public types no longer expose internals that would force a breaking change.
- Risks and follow-up:
  - Existing manifests with `pattern` stop installing. There are no adopters yet, and fixtures are updated in the same task.
  - `Store` implementers must add `getPlacement`.
  - G29 stays open.
  - The npm CLI is used in exactly one CI job.
- Revisit:
  - If Bun gains provenance support (R17).
  - If an adopter needs patterns in widget schemas and a linear-time matcher becomes available (R5).
  - If an adopter needs a Node backend (R2).
