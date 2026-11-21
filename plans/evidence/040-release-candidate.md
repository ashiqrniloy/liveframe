# 0.4.0-rc.1 release verification

## Local candidate

All four packages are at `0.4.0-rc.1`. The three companions peer on `~0.4.0-0`.

```sh
bun install --lockfile-only
bun run build
for pair in .: packages/runner-quickjs:-runner-quickjs packages/starter:-starter packages/a2ui:-a2ui; do
  bun scripts/release/api-surface.ts "${pair%:*}" \
    --out "scripts/release/api/0.4.0${pair#*:}.json" --from "v0.4.0-rc.1 checkout"
done
```

| Command | Result |
| --- | --- |
| `bun run release:versions --tag v0.4.0-rc.1` | `4 packages at 0.4.0-rc.1` |
| `bun test src/__tests__/api-stability.test.ts src/__tests__/workspace.test.ts` | 26 passed, zero failures. All four built APIs match their baselines. |
| `bun run check` | 2,129 passed, six skipped, zero failures. |
| `bun run release:gate` | Core passed 15 steps. A2UI, QuickJS and starter each passed two steps. All four local archives installed outside the checkout. |
| `bun run guide:test` | Getting-started guide passed in 3.3 s against local archives. |
| `bun run demo:test` | 78 passed, zero failures against the local core archive. |

## Registry preflight

On 2026-11-21, public npm registry metadata requests for the four package names returned the following results. The exact A2UI request, `curl -fsS https://registry.npmjs.org/@arnilo%2Fliveframe-a2ui/0.0.0-stage`, returned HTTP 404.

| Package | `latest` | `next` | `0.4.0-rc.1` |
| --- | --- | --- | --- |
| `@arnilo/liveframe` | `0.3.0` | `0.3.0` | Absent |
| `@arnilo/liveframe-runner-quickjs` | `0.3.0` | `0.3.0` | Absent |
| `@arnilo/liveframe-starter` | `0.3.0` | `0.3.0` | Absent |
| `@arnilo/liveframe-a2ui` | Package absent | Package absent | Absent |

The tag push is pending the owner's A2UI staging claim and trusted publisher configuration for `ashiqrniloy/liveframe`, `publish.yml`, environment `release`, together with confirmation of the other three packages' publish and dist-tag permissions. Protected publication and the fresh registry archive, API, guide, demo, signature and tag checks are pending.
