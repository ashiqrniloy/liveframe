# Plan 035 Task 1: Browser Renderer Baseline (`agent-home`, Production Build)

## 1. Environment and Command

- **Generated:** `2026-11-16T18:43:57.160Z`
- **Machine:** `linux 7.3.0-4-cachyos`; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics (16 logical CPUs)
- **Runtime and Browser:** Bun `1.4.4`; Playwright `1.64.1`; headless Chromium `156.0.8078.4`
- **Build:** React `19.3.1`, production (`process.env.NODE_ENV=production`; no `<Profiler>` instrumentation)
- **Host load average at end (`1 / 5 / 15 min`):** `12.04, 10.32, 10.45`
- **Command:**
  ```bash
  bun --conditions liveframe:source bench/streaming.bench.ts --production
  ```
- **Verification test:**
  ```bash
  bun test --conditions liveframe:source src/__tests__/bench-json.test.ts
  ```
- **Evidence isolation:** `bench/streaming.bench.ts` now writes its markdown report to `tmpdir()` (`/tmp/liveframe-streaming-production.md`) unless `--out <path>` is passed, so running the harness or `bun run bench` never dirties tracked files under `plans/evidence/`.

---

## 2. Scenario (a): Mount (`agent-home`, 679 nodes)

Runs: `2` warmup + `10` measured mounts per mode inside `flushSync`, measuring implementation call counts and wall time (`pass1Ms` up to the first `portal !== undefined` implementation render, `pass2Ms` from there through `flushSync` return).

| Mode | Renders (pass 1 + pass 2) | `flushSync` median ms | `flushSync` p95 ms | Pass 1 median ms | Pass 2 median ms | Second pass / first |
|---|---:|---:|---:|---:|---:|---:|
| `createRoot` | `1358` (`679` + `679`) | `23.800` | `39.200` | `19.000` | `4.900` | **`25.8%`** |
| `hydrateRoot` | `1358` (`679` + `679`) | `16.300` | `24.800` | `11.500` | `5.700` | `49.6%` |

---

## 3. Scenario (b): Update with Focus Inside the Surface (`agent-home`, 679 nodes)

Runs: `5` warmup + `20` measured whole-tree updates per configuration, with focus held on a button inside the surface and `0`, `1,000`, or `5,000` `<button type="button">` elements placed around the surface container in the host page. Each update awaits one `requestAnimationFrame` beforehand so layout is clean when `getSnapshotBeforeUpdate` runs, and reports `flushSync` wall time net of `validator.validateTree` (`commitMs`).

| Host tabbable elements | `focusContinuity=true` median ms | `focusContinuity=false` median ms | On − Off ms | `focusContinuity=true` p95 ms | `focusContinuity=false` p95 ms |
|---:|---:|---:|---:|---:|---:|
| `0` | `2.800` | `1.400` | `+1.400` | `5.800` | `3.000` |
| `1,000` | `7.000` | `1.500` | **`+5.500`** | `7.700` | `3.600` |
| `5,000` | `23.100` | `1.300` | `+21.800` | `37.700` | `1.700` |

---

## 4. Whole-Tree Streaming Summary (Reference, Same Run)

`100` revisions at `10/s` after `20` warmup revisions (`679` nodes, `50` rows, one row status changed per revision):

| Measure | median | p95 | max |
|---|---:|---:|---:|
| Whole-tree JSON bytes | `119825` | `119826` | `119826` |
| Gzip bytes | `5098` | `5100` | `5101` |
| JSON parse ms | `0.600` | `4.000` | `13.000` |
| Arrival validation ms | `2.500` | `23.800` | `33.700` |
| Reuse pass (`shareNodes`) ms | `0.500` | `5.500` | `83.600` |
| React work ms (`flushSync` wall, net of validation) | `1.600` | `14.100` | `45.800` |
| Arrival validation + React work ms | `5.100` | `35.000` | `49.800` |
| Layout plus paint, mean per update ms | `0.386` | — | — |

---

## 5. Thresholds Confirmed by Owner

No failing `budget()` gate is added in Task 1. The owner confirmed the two thresholds below on 2026-11-17 (`"Confirmed"`), so Tasks 2 and 3 both proceed to change code:

| Task | Confirmed threshold | Measured baseline | Outcome |
|---|---|---|---|
| **Task 2 (`FocusContinuity`, P4)** | Change code if `focusContinuity` on − off commit time at `1,000` host tabbable elements exceeds **`0.5 ms`**. | **`+5.500 ms`** at `1,000` elements (`7.000 ms` vs `1.500 ms`; `+21.800 ms` at `5,000` elements; `+1.400 ms` at `0` host elements). | **Threshold exceeded (`11.0×`).** Task 2 proceeds (starting with the `create-decision-log` candidate-scope decision). |
| **Task 3 (Client mount, P5)** | Change code if the second mount pass (`createRoot`) exceeds **`20%`** of the first pass. | **`25.8%`** (`4.900 ms` pass 2 vs `19.000 ms` pass 1; `1358` renders = `679 + 679`). | **Threshold exceeded.** Task 3 proceeds to draw each implementation once (`679` renders) on non-hydrating client mounts while preserving two passes on `hydrateRoot`. |

---

## 6. After Task 3 (Client Mount Draws Once)

Same command and machine, run 2026-11-17 with `--json` while unrelated work held the load average at `33–37` (two QEMU VMs, `rustc`, `podman`), so wall times are about 3× the section 2 baseline and are not comparable with it. The render counts are deterministic.

| Mode | Renders (portal undefined + set) | `flushSync` median ms | "Pass 1" ms | "Pass 2" ms |
|---|---:|---:|---:|---:|
| `createRoot` | **`679`** (`0 + 679`) | `69.500` | `29.600` | `48.700` |
| `hydrateRoot` | `1358` (`679 + 679`) | `69.700` | `48.200` | `15.900` |

- `createRoot` now renders each of the `679` implementations once, all with `portal` set (baseline `1358`). Its "pass 1" is now the commit of the wrapper and portal container plus arrival validation, with no implementation drawn, so the second-pass share (`164.5%`) no longer measures a redundant redraw.
- Under the same load, `createRoot` and `hydrateRoot` take the same wall time (`69.5` vs `69.7 ms`), where the baseline had `createRoot` `46%` slower (`23.8` vs `16.3 ms`). Hydration keeps its two passes, as spec §11 requires.
- `bench/streaming.bench.ts` now fails if a `createRoot` mount renders any implementation without the portal or renders more implementations than the tree has nodes (`hydrateRoot`'s first pass count). It holds in smoke runs too, since counts do not depend on load.
- The Task 2 focus gate failed in this loaded run (`+1.3 ms` at `1,000`, `+2.2 ms` at `5,000`); Task 3 does not touch the update path, and Task 2 notes the gate is load-sensitive. Re-run on a quiet machine before relying on the figure.
