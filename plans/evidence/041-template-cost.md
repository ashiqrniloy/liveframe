# LF-18 template budget evidence

## Before hardening

The [LF-18 request](../requests/synapta-0.4.0-requests.md#lf-18--bug-security--template-render-cost-is-not-bounded-by-limitssteps)
reported these fan-out measurements with `limits.steps: 1000` and the default node limit.

| Components | Template size | Time | Resident memory growth | Result |
|---:|---:|---:|---:|---|
| 6 | 1,229 bytes | 6 ms | 3 MiB | Error after expansion |
| 8 | 1,597 bytes | 29 ms | 26 MiB | Error after expansion |
| 10 | 1,965 bytes | 416 ms | 259 MiB | Error after expansion |
| 16 | — | — | — | Extrapolated in the request |

The request also reported about 0.5 s for 58 full slices of a 1 MiB string
under default limits. The after measurement uses the corpus workload, which
doubles a string to 1 MiB before slicing it.

## After Tasks 2–4

Run from the repository root:

```sh
timeout 300s bun --conditions liveframe:source bench/template.bench.ts
```

Measured on 2026-11-23 with Bun 1.4.5 on x86-64 Linux and an AMD Ryzen 9
PRO 7940HS. Sizes are compact JSON. The benchmark times direct
`renderTemplate` calls with default limits, including compilation of the
unfrozen document and the input checks. The fan-out fixtures add explicit
sibling keys to the request's shape. At install, both are refused at
`/root/children/0/$use` with `limit-exceeded`.

| Workload | Components | Template size | Time | Resident memory growth | Result |
|---|---:|---:|---:|---:|---|
| Four-way fan-out | 10 | 2,285 bytes | 1.295 ms | 0.375 MiB | `limit-exceeded` on nodes |
| Four-way fan-out | 16 | 3,611 bytes | 0.799 ms | 0.000 MiB | `limit-exceeded` on nodes |
| Nested maps over 1,000 items | 0 | 2,294 bytes | 5.157 ms | 0.000 MiB | `limit-exceeded` on steps |
| String doubling then slice | 0 | 1,566 bytes | 4.331 ms | 0.000 MiB | `limit-exceeded` at `$slice` |

Each row reports the median of nine calls after 30 warmup calls. Resident
growth is the positive change in process RSS across one call. The benchmark's
`--json <path>` output also records the maximum sampled RSS delta.

Both fan-out rows passed their 5 ms and 1 MiB gates. The slowest workload
in this set was the nested maps at 5.157 ms, leaving 44.843 ms of headroom in
the 50 ms gate. These are warm, host-specific regression measurements of
the listed workloads. The deterministic test `hostile_template_set_is_bounded`
asserts the exact error kind and which budget each workload exhausts.
