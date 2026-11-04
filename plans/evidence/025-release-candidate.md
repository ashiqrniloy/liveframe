# 0.2.3 release candidate

## Status

Prepared `0.2.3-rc.1`; publication and registry verification are pending. Task 9 stays unchecked until every required check passes.

## Owner authorization

On 2026-11-04 the owner requested: “Complete - [ ] Task 9: Publish 0.2.3-rc.1 under `next` and verify it from the registry … and update the plan once done”. This authorizes the RC publication and its tag push after the pre-publish requirements pass. It does not close Task 8's quiet-host proof or authorize the final 0.2.3 release.

## Pre-publish protection checks

Checked 2026-11-04 using the authenticated repository administrator `ashiqrniloy`:

- `gh api repos/ashiqrniloy/liveframe/environments` returned `{"total_count":0,"environments":[]}`.
- `gh api repos/ashiqrniloy/liveframe/environments/release` returned HTTP 404. There is no protected `release` environment yet; the workflow declaration alone does not establish reviewers or tag rules.
- Owner chose “Reviewer ashiqrniloy + v* tags”. Created the environment with required reviewer user ID `104660512` (`ashiqrniloy`), then created a deployment policy of type `tag`, name `v*`. The environment API returns required-reviewer and branch-policy protections; its deployment policy list returns exactly that one tag rule, ID `65499502`. Branch dry runs are blocked; dispatch dry runs on a tag. Self-review is allowed so the sole owner can approve the release; administrators retain GitHub's default bypass setting.
- Owner answered “Confirmed” to the npm trusted-publisher configuration: repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release` if supported. This is owner-attested configuration; authenticated npm settings are unavailable here.

## Registry before publication

`curl -fsSL https://registry.npmjs.org/@arnilo%2fliveframe`, parsed with Bun, returned `latest: 0.2.2`, `next: 0.2.2-rc.2`; `0.2.3-rc.1` does not exist. No tag was pushed and no publish was attempted during this check.

## Verification

Local pre-tag gates passed on the RC checkout. Logs are local-only in `/evidence/025-task-9/`; regenerate with the release checklist commands in `docs/compatibility.md`.

- `timeout 900s bun run check`: build, generated files, types, lint, format and tests pass; 1,063 pass, four skip, zero fail, 120 files, 382.33 s of tests.
- `timeout 900s bun run release:gate`: all 14 steps pass (5.7 s).
- `timeout 900s bun scripts/release/peer-floors.ts`: React 19.0.0 (117), Playwright 1.49.0 (23) and MCP server 2.0.0 (78), all pass.
- `timeout 600s bun run demo:test`: 53 pass, zero fail.

Pending after publication: workflow URL and environment approval, registry dist-tags, signature and provenance verification, registry-mode archive gate, installed API comparison against `scripts/release/api/0.2.2.json` with `register-0.2.3.json` (`[]`), and the workflow SBOM artifact.
