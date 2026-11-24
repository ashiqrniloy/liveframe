# 0.4.1-rc.1 release verification

## Local candidate

All four packages are at `0.4.1-rc.1`. The three companions peer on `~0.4.0-0`. No `0.4.1*.json` baseline is generated: the API gate still compares the checkout against the four `0.4.0*.json` baselines through the `register-0.4.1*.json` registers, and plan 043 generates the 0.4.1 baselines from the `v0.4.1` tag.

```sh
bun install --lockfile-only
bun run build
```

| Command | Result |
| --- | --- |
| `bun scripts/release/versions.ts --tag v0.4.1-rc.1` | `4 packages at 0.4.1-rc.1` |
| `bun test --conditions liveframe:source src/__tests__/workspace.test.ts src/__tests__/api-stability.test.ts` | 26 passed, zero failures. |
| `bun run check` | 2,196 passed, six skipped, zero failures (892 s, load about 3–5). |
| `bun run release:gate` | Core passed 15 steps. A2UI, QuickJS and starter each passed two steps. All four local archives installed outside the checkout. |
| `bun run guide:test` | Getting-started guide passed in 4.1 s against local archives. |
| `bun run demo:test` | 78 passed, zero failures in 43 s against the local core archive. |
| `bun pm pack`, then `tar tzf` | The core archive holds `package/docs/security-checklist.md` and `package/docs/security.md`. |

## Registry preflight

On 2026-11-24, `npm view <package> dist-tags --json --prefer-online` returned `latest` `0.4.0` and `next` `0.4.0` for all four packages, and `npm view <package>@0.4.1-rc.1 version` returned nothing for each.
