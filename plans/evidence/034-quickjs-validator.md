# Plan 034 Task 6 (P6): QuickJS `reuse: "package"` Validator Cache — Measured and Fixed

**Question:** Under `quickjsRunner({ reuse: "package" })`, how much of a render inside QuickJS is spent in `compileValidator` because `request.options` re-parses `catalog` and `capabilities` on every call (missing `src/runner-kit/cache.ts`'s `WeakMap<Catalog, WeakMap<Capabilities, ...>>`), and does keeping that configuration stable eliminate the recompilation?

**Outcome:** **Fixed.** Inside QuickJS, `compileValidator` accounted for **`87.5%`** of a `reuse: "package"` render on `smallest` (`11.385 ms` of `13.018 ms` CPU; `95.7%` including `JSON.parse(config)`, dropping the render to `0.565 ms`) and **`15.0%`** on `agent-home` (`24.514 ms` of `163.822 ms` CPU; `17.5%` including `JSON.parse(config)`). Because `smallest` is well over the 20% threshold, `packages/runner-quickjs/src/` (`protocol.ts`, `runtime.ts`, `index.ts`) now sends `{ catalog, capabilities }` as a separate `config` string and parses it in the QuickJS entry only when `config !== lastConfig`.

---

## 1. Environment and Measurements

- **Date:** 2026-11-16
- **Machine:** Linux 7.3.0-4-cachyos x86_64; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics (16 logical CPUs)
- **Runtime:** Bun 1.4.4 (`38afee6c8`), `quickjs-emscripten-core` `0.32.0`, `@jitl/quickjs-wasmfile-release-sync` `0.32.0`
- **Host load average (`uptime`, 1 / 5 / 15 min):** `17.65–45.47, 15.81–28.07, 17.39–22.51` (heavy concurrent host load; CPU-time measurements isolate QuickJS work from scheduling noise, while wall-clock `bench/runner.bench.ts` runs reflect ~3× load inflation compared with Plan 031 Task 5 at load ~4).

### 1.1 Inside-QuickJS CPU Time per Render (`process.cpuUsage()`, median of 5 batches)

Measured in a kept `QuickJSRuntime` / `QuickJSContext` after warm-up (`batchSize = 10` for `agent-home`, `30` for `smallest`; `configBytes = 28,533`, `fullReqBytes = 64,071` / `29,052`, `slimReqBytes = 35,539` / `520`):

| Subject | Base (re-parse config every render) | Cached validator + full `JSON.parse` | Head (`config` parsed once + slim `request`) | `compileValidator` share (`Base - CachedFull`) | Total saved (`Base - Head`) |
|---|---:|---:|---:|---:|---:|
| `agent-home` (679 nodes) | 163.822 ms | 139.308 ms | **135.153 ms** | 24.514 ms (**15.0%**) | 28.670 ms (**17.5%**) |
| `smallest` (1 text node) | 13.018 ms | 1.634 ms | **0.565 ms** | 11.385 ms (**87.5%**) | 12.454 ms (**95.7%**, **23.0×**) |

Inside QuickJS wall-clock (`Date.now()` in-VM, load ~29, `n = 10` / `30`):
- `agent-home`: `155.600 ms` → `133.500 ms` cached full-parse (`22.100 ms` = `14.2%` `compileValidator` share).
- `smallest`: `12.533 ms` → `2.467 ms` cached full-parse (`10.067 ms` = `80.3%` `compileValidator` share) → **`0.567 ms`** with slim `request` (`95.5%` saved).

### 1.2 End-to-End `bench/runner.bench.ts` (`quickjsPackage`)

| Subject | Plan 031 T5 baseline (load ~4) | Pre-fix run (load 17.65) | Post-fix `bench/runner.bench.ts` (load 9.99) | Old budget | Tightened budget |
|---|---:|---:|---:|---:|---:|
| `quickjsPackage.agent-home` | 47.2 ms | 104.004 ms | **48.366 ms** (p95 `61.105 ms`) | ≤ 60 ms | **≤ 50 ms** |
| `quickjsPackage.smallest` | 4.2 ms | 8.908 ms | **1.311 ms** (p95 `1.758 ms`) | ≤ 8 ms | **≤ 4 ms** |

In the full `bun --conditions liveframe:source bench/runner.bench.ts` run at load `9.99, 13.16, 16.01`, **every** budget passed (`quickjs none` `93.441 ms` / `39.153 ms`, `quickjs package` `48.366 ms` / `1.311 ms`, `cold start` `20.4 ms`, `recovery` `271.2 ms`, `inProcessOverhead` `0.0386 ms`). Tightening `quickjsPackage.agent-home` from `60 ms` to `50 ms` (~17% reduction, matching the 15.0%–17.5% measured CPU share) and `quickjsPackage.smallest` from `8 ms` to `4 ms` matches the measured drop while retaining headroom for host load variance.

---

## 2. Implementation and Security Notes

- **Files changed:** `packages/runner-quickjs/src/protocol.ts` (`RenderRequest.config`), `packages/runner-quickjs/src/runtime.ts` (`Job.config`, two-argument `__render(config, text)` comparing `config !== lastConfig` and disposing the `config` handle), `packages/runner-quickjs/src/index.ts` (sending `config = JSON.stringify({ catalog, capabilities })` separately from `request`), `packages/runner-quickjs/README.md`, `bench/runner.bench.ts`.
- **`runner-kit` unchanged:** `src/runner-kit/cache.ts` keeps its identity-keyed `WeakMap<Catalog, WeakMap<Capabilities, Map<string, CompiledValidator>>>` cache with no content-keyed canonicalisation overhead on other runners.
- **Isolation (Law 1 & Law 2):** The sandbox still receives only strings (`config` and `request`), with no host object exposed. Each kept runtime in `kept` is already keyed by `pkg.hash`, so holding `lastConfig` and `parsed` adds no cross-package state channel. `reuse: "none"` disposes the runtime after every render and retains no configuration memory.
- **Tests added:**
  - `kept_runtime_compiles_the_validator_once` (`packages/runner-quickjs/src/__tests__/engine.test.ts`): two renders under `key: "kept"` record `1` validator compile and `cachedValidatorCount === 1`; changing `config` recompiles (`2/1`).
  - `changed_capabilities_recompile_in_a_kept_runtime` (`packages/runner-quickjs/src/__tests__/runner.test.ts`): changing `capabilities` in a kept runtime validates against the new action argument schema (`invalid-prop`) and succeeds again when restored.
  - `reuse_none_is_unchanged` (`packages/runner-quickjs/src/__tests__/runner.test.ts`): every `contract` `ok` fixture in `conformance/runner/fixtures.json` matches `inProcessRunner()` byte-for-byte under `reuse: "none"`.
