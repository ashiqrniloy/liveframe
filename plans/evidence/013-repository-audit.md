# Plan 013 T7: repository audit before going public

Executed 2026-10-26.

## Files reviewed

- Every tracked file (`git ls-files`) and the full history: 136 commits.
- Name search for credential-shaped files (`.env`, `*.pem`, `*.key`, `id_rsa`, `credentials`): none tracked.
- `.claude/settings.local.json` holds only `enabledMcpjsonServers`; it is not tracked (`git ls-files .claude` lists the helpers, `settings.json` and skills only).
- `proof/references/**`: 25 text snapshots and 2 font binaries from two other projects (`synapta-core`, 452 KB; `clay`, 488 KB). See the decisions.
- Third-party-derived code outside `proof/references/`: `src/__tests__/fixtures/widgets/git-status/labels.ts` is a near-verbatim copy of Clay's `packages/git/src/status.ts` (header `@clay/git`). It stays; see Open items.

## Owner decisions (2026-10-26)

| Item | Decision |
| --- | --- |
| `proof/references/synapta-core/**` | Remove from tree and history. |
| `proof/references/clay/**` | Remove from tree and history. |
| `origin` remote (`github.com/ashiqrniloy/liveframe`) | Never pushed, so the rewrite is safe. |

`proof/references/SOURCES.md` stays: origin commit SHAs, line ranges and the SHA-256 and size of both fonts remain as evidence. It now says the files are not in the repository.

**Deviation from the task text.** The criterion "the OFL fonts keep their licence texts" assumed some of `synapta-core` stays. The owner removed all of it, so `OFL-MartianMono.txt`, `OFL-SchibstedGrotesk.txt` and both `.woff2` files left together. No shipped artifact contains the fonts (`git ls-files` lists no font file), so no licence text is owed in the package. `SOURCES.md` still records the licence (OFL 1.1) and hashes.

## History rewrite

Tool: `git filter-repo` (system package).

```sh
git filter-repo --force --path proof/references/synapta-core --path proof/references/clay --invert-paths
```

- Commits before and after: 136 and 136. HEAD `6a69e52` became `054a602`; every commit SHA changed.
- `git rev-list --objects --all | grep proof/references` lists only `SOURCES.md` blobs.
- `git log --all -- proof/references/synapta-core proof/references/clay` returns nothing.
- The pack went from the pre-rewrite size to 1.46 MiB after `git reflog expire --expire=now --all && git gc --prune=now`.
- `filter-repo` drops the `origin` remote and resets the working tree. The remote was re-added with the same URL; the uncommitted task work (T4 to T7 files) was restored from a pre-rewrite copy of the working tree.
- Local-only recovery: the snapshots can be re-created from the origin commits in `SOURCES.md` into `proof/references/` to run `proof/scripts/parity.ts`.

## Tests that read the removed files

| Test or script | Change |
| --- | --- |
| `proof/tests/catalog.test.ts` `references_are_all_attributed` | `test.skipIf` the snapshot directory is absent. |
| `proof/tests/styles.test.ts` `rack_preserves_all_247_source_recipes_and_values`, `themes_keep_reference_colour_authority` | `test.skipIf` the snapshot directory is absent. |
| `proof/tests/clay.test.ts` `git_status_matches_builder_output_structure` | Skipped likewise; the Clay module is a dynamic import. |
| `proof/tests/host.test.ts` | The font byte checks and `@font-face` assertions run only when the fonts exist. |
| `proof/widgets/clay/git-status.tsx` | Imports the label helpers from the `src` fixture `labels.ts`, not from the snapshot. |
| `proof/host/server.ts` | Declares and serves no fonts when the font files are absent (a 404 font logged a console error and failed browser tests). |
| `proof/scripts/parity.ts` | Stops with a message naming the local-only snapshots. |

With the snapshots absent: 635 pass, 4 skip, 0 fail (full `bun run check`, run on a loaded host). The 4 skips are the four tests above that need the Clay or Synapta files.

## Secret scan

Tool: gitleaks (system package, default ruleset). It scans every commit's diff.

```sh
gitleaks git --no-banner --redact --report-format json --report-path <report>.json .   # history
gitleaks dir --no-banner --redact .                                                       # working tree incl. untracked files
```

| Scan | Result |
| --- | --- |
| History before the rewrite | 136 commits, 8.28 MB scanned, no leaks found. |
| History after the rewrite | 136 commits, 7.46 MB scanned, no leaks found. |
| Working tree | 16.74 MB scanned, no leaks found. |

## `.gitignore`

Still excludes `/evidence/`, `/.local/` and `/graft/` (`git check-ignore -v` confirms all three).

## Open items

- `src/__tests__/fixtures/widgets/git-status/labels.ts` is derived from Clay source and keeps its `@clay/git` header. The owner removed the Clay snapshot but did not rule on this file; it is kept as the owner's own project code. Revisit if Clay's licence differs from this repository's.
- Many docs, plans and decision logs name Synapta and Clay as the migration targets. Not reviewed for sensitivity; they carry no source or credentials.
- The full-suite run on this host (load 9 to 45) times out intermittently in browser, MCP and conformance cases (`missing_browser_fixtures_fail_with_the_named_rule` and others). Each passes when run alone. Same environment record as Tasks 4 to 6; re-run `bun run check` on a quiet host before Task 12.
