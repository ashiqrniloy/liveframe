---
date: 2026-11-24 15:50
status: approved
decision_about: "The peer range companion packages declare on @arnilo/liveframe"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: companions peer on the core at their own patch

## Decision

Each companion package (`@arnilo/liveframe-runner-quickjs`, `@arnilo/liveframe-starter`, `@arnilo/liveframe-a2ui`) at version `X.Y.Z` peers on `@arnilo/liveframe` at `~X.Y.Z`, and at `~X.Y.Z-0` while the version is a prerelease. For 0.4.1 that is `~0.4.1-0` for a release candidate and `~0.4.1` for the release. This amends the peer range in [the 2026-11-08 workspace decision](2026-11-08-2310-isolated-runner-starter-and-workspace.md), which was `~X.Y.0` (`~X.Y.0-0` for a prerelease). The rest of that decision, including lockstep versions, stands.

## Context

`0.4.1-rc.1` was published on 2026-11-24 with the companions peering on `~0.4.0-0`, as `scripts/release/versions.ts` required. Verification from the registry failed twice for the same reason ([release-candidate record](../plans/evidence/042-release-candidate.md)):

- `archive-gate.ts --package` installs the core from the peer range. It paired runner `0.4.1-rc.1` with core `0.4.0`, and `runner_isolation_deep_recursion` (§7.5) returned `render-failed` ("stack overflow") instead of `limit-exceeded`. Plan 041's LF-27 fix stopped the runner from classifying limits by message text, which a widget can forge. It reads the limit from the `debug` text that core 0.4.1's runner kit returns, and core 0.4.0's kit has no such text. With core `0.4.1-rc.1`, the same archive passed 16 of 16.
- npm 12.2.3 refused to install the four `0.4.1-rc.1` packages together (`ERESOLVE`), because `~0.4.0-0` does not match `0.4.1-rc.1`.

The final range `~0.4.0` would admit the same broken pairing: a host could upgrade the runner alone and keep core 0.4.0. A patch's companions can depend on core behaviour added in that patch, as the runner now does.

## Approval

- Proposed by: agent, after the registry verification of plan 042 Task 9.
- Approved by user: Yes.
- Approval evidence: on 2026-11-24 the owner chose "Peer floor = own patch (Recommended)". That option read: "Companions peer on ~X.Y.Z (~X.Y.Z-0 for a prerelease): ~0.4.1-0 for rc.2, ~0.4.1 for final. Update versions.ts, its tests, docs/compatibility.md and READMEs, log the decision (it amends 2026-11-08-2310), make archive-gate --package install the matching core version, then publish 0.4.1-rc.2." The owner did not choose the other two options offered.

## Alternatives Considered

1. **Keep `~X.Y.0`, and make the runner match message text when the kit returns no `debug` text.** Not chosen. On core 0.4.0 this reopens the forgeable-limit-text path that LF-27 closed, and the candidate range still fails npm's resolution.
2. **Keep `~X.Y.0` and document that runner 0.4.1 needs core 0.4.1.** Not chosen. Nothing enforces it, and npm's `ERESOLVE` on candidate installs remains.
3. **An exact pin (`X.Y.Z`).** Not offered. Lockstep already publishes all four packages together, and an exact pin would refuse a later core patch that keeps the 0.x.y promise.

## Rationale and Evidence

`Bun.semver.satisfies` on 2026-11-24 gave:

| Version | Range | Satisfies |
| --- | --- | --- |
| `0.4.1-rc.1` | `~0.4.0-0` | false |
| `0.4.0` | `~0.4.0-0` | true |
| `0.4.1-rc.1` | `~0.4.1-0` | true |
| `0.4.1` | `~0.4.1-0` | true |
| `0.4.2` | `~0.4.1-0` | true |
| `0.4.0` | `~0.4.1-0` | false |
| `0.4.1` | `~0.4.1` | true |
| `0.4.0` | `~0.4.1` | false |
| `0.4.2` | `~0.4.1` | true |
| `0.5.0` | `~0.4.1` | false |

A prerelease satisfies a range only when a comparator names its own `X.Y.Z` tuple, so a candidate's range must name its own patch. The floor at the release's own patch rejects the pairing that fails, and it admits every later patch of the same minor, which the 0.x.y promise covers. For `X.Y.0` the rule gives the same range as before, so a minor release is unchanged.

## References

- [`plans/evidence/042-release-candidate.md`](../plans/evidence/042-release-candidate.md): the failed checks and their outputs.
- `scripts/release/versions.ts`: `expectedPeerRange`, which enforces the rule.
- `scripts/release/archive-gate.ts:129`: the registry gate installs the core from the peer range.
- `packages/runner-quickjs/src/result.ts`: `sanitized` reads the limit only from the `debug` text.
- [`2026-11-08-2310-isolated-runner-starter-and-workspace.md`](2026-11-08-2310-isolated-runner-starter-and-workspace.md): the decision this amends.

## Consequences

- A host that installs a companion at `X.Y.Z` must also have core `X.Y.Z` or later within `X.Y`. Bun and npm enforce this, and the companion READMEs state it.
- `versions.ts`, `workspace.test.ts`, `docs/compatibility.md` and the companion READMEs change with it. The registry archive gate installs the core at the companion's own version, so a gate run tests the pairing that is being released.
- `0.4.1-rc.1` stays on npm with its broken range. `0.4.1-rc.2` replaces it under `next`.
- Revisit this if a companion patch must support an older core patch, for example to let a host upgrade companions alone.
