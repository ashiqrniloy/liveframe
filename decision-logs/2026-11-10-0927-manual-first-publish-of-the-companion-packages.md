---
date: 2026-11-10 09:27
status: approved
decision_about: "Publish the two new companion packages once by hand, then hand them back to CI"
proposed_by: both
explicitly_approved_by_user: true
---

# Decision: One manual first publish for the companion packages

## Decision

`@arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-starter` were published at `0.3.0-rc.1` by hand, once each, from the same `release:stage` staging the publish workflow uses. Plan 032 Task 5's Code Quality criterion "no manual publish; CI only" is waived for this one release candidate; it applies unchanged from `0.3.0` on.

## Context

Task 5 required the protected publish workflow to publish all three packages under `next` with provenance. The workflow published the core, then stopped on the first companion with `npm error code ENEEDAUTH`: npm can only authenticate a trusted publisher for a package that already exists, so the workflow cannot be the first publisher of a new name (`npm/cli#8544`, still open). Neither companion had ever been published; the npmjs.com settings page that holds the trusted publisher does not exist until the first publish.

The alternatives were to skip the companions in this release candidate, or to create the names some other way first. `npm stage publish` can create a new name from a granular token, but the staged version then enters a review queue and would consume `0.3.0-rc.1`, leaving the three packages on different versions.

## Approval

- Proposed by: both.
- Approved by user: Yes.
- Approval evidence: the agent laid out the two paths (trusted publisher configured before a first publish, versus one token publish per package). The owner ran the publish commands in the "step by step" list, and answered "Give me step by step what I need to do clearly" before doing so.

## Alternatives Considered

1. **Wait for npm to support an initial publish through OIDC** — unbounded; the release candidate would stay unpublished.
2. **Claim each name with `0.0.0-stage` and let CI publish the rc** — the names were claimed that way, but the rc still needed authentication: a claimed name with no trusted publisher configured does not let the workflow publish either.
3. **Publish the rc companions by token and accept no provenance for them** — chosen. Provenance returns for all three at `0.3.0`, which publishes from CI.
4. **Stage-publish the companions and promote them by hand on npmjs.com** — rejected: it consumes the version and splits the release across two version numbers.

## Rationale and Evidence

- The published bits are the ones the gates proved: both packages were staged with `bun run release:stage` (the script the workflow runs) and packed by `npm publish` from that directory. File counts match the workflow's own staging in run 42778663441 (15 for the runner, 20 for the starter).
- Registry verification on the published versions, in `plans/evidence/032-release-candidate.md`: archive gates pass (15 / 2 / 2 steps); the installed API matches both the baselines and the checkout for all three packages; `getting-started-test.ts --registry` passes installing all three from the registry; `demo-test.ts --registry` 67 pass; `npm audit signatures` reports `invalid: []` and `missing: []`.
- Provenance is the one gap: `registry.npmjs.org/-/npm/v1/attestations/<package>@0.3.0-rc.1` returns 404 for both companions, and `npm audit signatures` lists only the core. A token publish cannot attest.
- The workflow's publish step now skips a version the registry already holds (`.github/workflows/publish.yml`), so a re-run completes a partial release instead of failing on the published package.
- `latest` on both new packages points at the rc, because npm sets `latest` on a package's first publish; `0.3.0` moves it.

## Consequences

- `0.3.0-rc.1` is the only version of the two companions without provenance. Later releases need the trusted publisher configured for each name (repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release`, allowing `npm publish` and `npm dist-tag`), and are otherwise CI-only.
- `docs/compatibility.md` keeps "no manual publish" as the rule for every release from `0.3.0`.
- The two packages carry a `0.0.0-stage` version from the name claim, as the core has since 2026-10-26.
