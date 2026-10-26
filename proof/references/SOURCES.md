# Phase 0 reference snapshots

> **Not in the public repository.** Per the Plan 013 T7 audit the snapshot files are removed from the tree and history; only this attribution table (paths, commit SHAs, line ranges, SHA-256s) remains. The proof tests that read them skip, and `proof/scripts/parity.ts` needs them restored locally from the origin commits below.

Captured 2026-10-21 for Plan 001 Task 1, plus 2026-10-22 for Plan 002 Task 2. These 25 files are verbatim, whole-file
copies of committed Git blobs, not the sibling repositories' working trees.
Paths below are relative to this directory; after the repository prefix they
retain the original source path. Line ranges are inclusive in both copies.
`SOURCES.md` is the only authored file in this directory.

Origin repositories (read-only):

- `synapta-core`: `/home/arn/Projects/synapta-core`
- `clay`: `/home/arn/Projects/clay`

| Snapshot path | Origin repo | Commit SHA | Copied lines |
| --- | --- | --- | --- |
| `synapta-core/design-artifacts/approved/agent-home-certified.html` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–2068 |
| `synapta-core/web/app/styles/certified.css` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–939 |
| `synapta-core/product-modules/ui/core/widgets/queue/widget.json` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–122 |
| `synapta-core/product-modules/ui/core/widgets/queue/widget.tsx` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–529 |
| `synapta-core/web/app/components/ui/queue.tsx` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–298 |
| `synapta-core/plans/200.4-SdkComponentsRendererAndQueue.md` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–392 |
| `synapta-core/design-artifacts/fonts/OFL-MartianMono.txt` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–93 |
| `synapta-core/design-artifacts/fonts/OFL-SchibstedGrotesk.txt` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–93 |
| `synapta-core/design-artifacts/fonts/SOURCES.md` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 1–29 |
| `clay/packages/git/src/status.ts` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–160 |
| `clay/packages/design-rack/package.json` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–2622 |
| `clay/packages/design-rack/docs/index.md` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–148 |
| `clay/packages/theme-modus-operandi/package.json` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–388 |
| `clay/crates/clay-server/src/shell/components.rs` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–665 |
| `clay/frontend/src/sdui/registry.tsx` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–844 |
| `clay/frontend/src/components/text.tsx` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–52 |
| `clay/design-artifacts/approved/apps-and-containers-rack/index.html` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–2105 |
| `clay/design-artifacts/approved/apps-and-containers-rack/theme.css` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–315 |
| `clay/design-artifacts/approved/apps-and-containers-rack/README.md` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–190 |
| `clay/design-artifacts/approved/rack-kit-and-pages/kit.html` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–312 |
| `clay/design-artifacts/approved/rack-kit-and-pages/kit.css` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–484 |
| `clay/design-artifacts/approved/rack-kit-and-pages/rack.css` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–679 |
| `clay/design-artifacts/approved/rack-kit-and-pages/theme.css` | `clay` | `7770d18cfa27d2c7c52417f95c40cd81f6228981` | 1–315 |

## Binary snapshots

The two font files are binary, so they are attributed by byte size and SHA-256
instead of a line range. Both hashes match the table in the origin's own
`design-artifacts/fonts/SOURCES.md`.

| Snapshot path | Origin repo | Commit SHA | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `synapta-core/design-artifacts/fonts/schibsted-grotesk/latin-wght-normal.woff2` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 46752 | `4c8b93f431d462c696e12b9d6a033feb3394d36e66e781357c496b95d8a75e05` |
| `synapta-core/design-artifacts/fonts/martian-mono/latin-wdth-normal.woff2` | `synapta-core` | `fc6df4b3a68e117c10120276193717e7213b07bf` | 38492 | `f9c1655c2c9d1ed5bb8b301a57d1169a1123ffef1a588dc50a7a487810f7d732` |

Both faces are variable, latin subset, `normal` style, OFL 1.1 and
redistributable with the two licence files above: Schibsted Grotesk covers
`wght` 400–900, Martian Mono `wght` 100–800 at `wdth` 75%–112.5%. Certified's
mono typography role names Martian Mono, and its width role asks for
`font-stretch: 87.5%`, the same value the artifact's `--mono-stretch` uses.

## Relevant anchors

- Synapta `agent-home-certified.html`: size rules 1036–1047; `core.queue`
  1137–1245; focus cards 1247–1320; home states 1324–1357; escalate dialog
  1368–1383. The whole self-contained artifact is preserved for comparison.
- Synapta Plan 200.4: T4 split at 21; T4b–T4e ruling at 179; T4b completion
  at 182; T4c completion at 196; T4d completion at 214. The whole plan is
  preserved so the surrounding criteria and deviations remain available.
- Clay `packages/git/src/status.ts`: `buildGitStatusTree` at 122–160.
- Clay `frontend/src/sdui/registry.tsx`: label rendering at 436–447, through
  `ClayText` in `frontend/src/components/text.tsx` (whole file).
- Clay `apps-and-containers-rack/index.html`: `agent-info` at 1279–1323.
- Clay `packages/design-rack/docs/index.md`: colour authority and user-owned
  typography at 31–40. The content theme is `@clay/theme-modus-operandi`.

## Relationship to the plan's original pins

All five non-plan Synapta files are byte-identical to `91de29ed`. Only Plan
200.4 differs: T5 and T6 were marked complete and gained completion notes;
the required T4 passages and their line numbers are unchanged. All 14 Clay
files are byte-identical to `adc7f64c`. The table records the actual full
HEAD SHAs used, rather than attributing newer bytes to an older commit.

## Data and execution review

The Certified artifact explicitly labels its data synthetic at lines 1115
and 1387, with no live operations. Clay's Rack artifact is a static prototype:
the `agent-info` panel uses example session labels, file names and composer
text, not a tenant export. The remaining snapshots are source code, package
data, styles or design documentation. Credential-pattern and data review
found no secret values or live tenant records; the Rust `token` field is a
theme-role identifier, not a credential.

These are inert references, never imported by Liveframe. The font files are
served by the proof host and by the parity script's reference server at
`/fonts/…`; nothing fetches them from the network at test time. Existing source
imports and documentation links are preserved as evidence, not resolved
against the sibling repositories. Biome excludes this directory so lint and
formatting cannot rewrite the snapshots. Runtime fixtures and proof tests
belong outside this directory.

## Verification

Task 1 checked the complete file inventory against this table, validated
each commit and inclusive line range, and compared every snapshot byte for
byte with `git show <commit>:<origin-path>`. Task 2 added the five font
snapshot rows the same way, and `references_are_all_attributed` now checks the
text rows and the binary size/hash rows on every run.

For example, from the Liveframe root, this command reproduces the approved
Synapta artifact on standard output without reading its working-tree copy:

```bash
timeout 10s git -C /home/arn/Projects/synapta-core show fc6df4b3a68e117c10120276193717e7213b07bf:design-artifacts/approved/agent-home-certified.html
```

For every other row, use its origin repository, commit SHA and the path
after the snapshot's repository prefix in the same command.
