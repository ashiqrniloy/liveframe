---
date: 2026-11-08 23:10
status: approved
decision_about: "Isolated runner package, starter package, Bun workspace and Bun-only runtime for 0.3.0"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: QuickJS in a killable child process is the isolated runner; three lockstep packages in a Bun workspace; no Node runtime

## Decision

Ship the isolated runner as the separate optional package **`@arnilo/liveframe-runner-quickjs`**: QuickJS (`quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync`, each pinned to 0.32.0) running in a **Bun child process that the runner owns and can kill**, so the sandbox realm holds no host API and a hard deadline bounds CPU. Ship the reference catalog, React implementations, themes and design system as **`@arnilo/liveframe-starter`**. Build, gate and publish the three packages (`@arnilo/liveframe`, `@arnilo/liveframe-runner-quickjs`, `@arnilo/liveframe-starter`) from one Bun workspace (`packages/*`) with **lockstep versions** and a peer range `@arnilo/liveframe: ~0.3.0`. Spec §13 rule 3 ("No WebAssembly, no bundled isolation sandbox") is scoped to `@arnilo/liveframe`. **No Node runtime support is maintained**: the backend subpaths and both new packages declare `engines.bun >= 1.4.2`, and the archive gate's Node probe stays only as a portability check of host-API-free bundles.

Runner defaults and rules (measured, `plans/evidence/031-runner-options.md`):

- `stackBytes` 256 KiB (not 1 MiB), `memoryBytes` 32 MiB, `timeoutMs` 250 ms as the soft interrupt, with a hard `SIGKILL` of the child 100 ms later; a per-render `timeoutMs` overrides the default.
- `executePendingJobs()` is never called; a package whose top-level `await` leaves the module unsettled is `render-failed`.
- Any host-side throw from QuickJS, including from `dispose()`, marks the wasm instance tainted: it is dropped, never reused.
- Template packages render on the host through the existing template path: no author code runs, so nothing needs isolating, and the tree is the same function's output.
- `reuse: "none"` (default) gives every render a new runtime; `reuse: "package"` keeps a bounded number of runtimes per package hash for trusted-but-untested code.
- Performance budgets (re-baselined on a quiet host by Task 5 before they gate): `reuse: "none"` agent-home ≤ 110 ms and smallest proof surface ≤ 60 ms; `reuse: "package"` agent-home ≤ 60 ms and smallest ≤ 8 ms; child cold start ≤ 60 ms; hold, kill, recover and next render ≤ 300 ms.

## Context

The 0.3.0 scope (`decision-logs/2026-11-05-0238-release-0-3-0-scope.md`, items W1 and W7b) promised an isolated runner as a separate optional package and a starter, and the owner decided on 2026-11-05 that no Node runtime support is maintained. Plan 031 Task 1 asked whether `quickjs-emscripten` can meet the runner budget and which hosting gives a real boundary on Bun ≥ 1.4.2. The spike was run on one Linux machine with Bun 1.4.4; it also measured a Deno subprocess with every permission denied, bubblewrap, and a plain Bun child, and reasoned about `isolated-vm`.

The measurements changed the assumed design. Same-thread QuickJS cannot meet "limit-exceeded within `timeoutMs`" against hostile code: the interrupt handler is polled only every 10 000 opcodes, so one native call (`'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b')`) did not return in 60 s, ignoring the interrupt and the memory limit. Bun 1.4.4's `Worker.terminate()` did not stop a worker in that call, while `SIGKILL` of a child process ended it in 4.5–9.7 ms. The plan's 1 MiB stack default let the host stack overflow inside wasm and then abort on `dispose()`; 256 KiB gave QuickJS's own graceful "stack overflow" in every shape tested, with 6000 host frames already on the stack.

## Approval

- Proposed by: agent, from plan 031 Task 1 and the spike evidence.
- Approved by user: Yes.
- Approval evidence, 2026-11-08: asked to approve the exact decision text above (QuickJS hosted in a killable Bun child process; `stackBytes` 256 KiB, `memoryBytes` 32 MiB, `timeoutMs` 250 ms plus a hard kill 100 ms later; no `executePendingJobs`; tainted wasm instances dropped; template packages rendered on the host; the two new package names with lockstep versions and peer `~0.3.0`; spec §13 scoped to the core package; Bun-only with `engines.bun >= 1.4.2`; the budget table), the owner answered "Approve and log (Recommended)". The alternative offered, same-thread QuickJS with the residual documented, was not chosen.

## Alternatives Considered

1. **Same-thread QuickJS** (the plan's original design). Not selected: cannot bound CPU against hostile native calls (F5), and Bun's worker termination cannot rescue it (F6). It is about 5 ms cheaper per render; the claim "bounded in time" would have had to be dropped.
2. **QuickJS in a Bun `Worker`.** Not selected: `terminate()` did not stop a worker in a native call on Bun 1.4.4 (no `close` event within 3 s; the thread kept spinning).
3. **Deno subprocess with `--deny-*` permissions.** Not selected: 72–156 ms cold start and 57–63 ms warm render, no faster than QuickJS here; needs a 95 MB external binary; the realm still has the `Deno` namespace, `fetch` and `Deno.exit`; a widget wrote a forged result line to the host's stdout channel and the host accepted it. Its permission model works (`NotCapable` for file, env and subprocess).
4. **`isolated-vm`.** Not selected: a native addon for V8 (`engines.node >= 24`); Bun runs JavaScriptCore, so it cannot load, and the owner excluded a Node runtime. Reasoned from package metadata, not run.
5. **A Bun subprocess alone.** Not selected: Bun has no permission or sandbox flags; it bounds time and crashes only, as `workerRunner()` does.
6. **bubblewrap/seccomp.** Not selected as the runner: Linux only, no per-render memory or CPU limits, and the code inside keeps a full JavaScript runtime. Measured as a useful outer layer: +5 ms spawn, network unreachable, read-only filesystem. Documented as defence in depth for the child.
7. **The `quickjs-ng` build.** Not selected: behaves the same in every probe and is 20–35 % slower on the same render workloads.
8. **The umbrella `quickjs-emscripten` package.** Not selected: it adds debug and asyncify variants (2.4 MB) the runner does not use.
9. **The runner inside `@arnilo/liveframe`, or independent package versions.** Not selected: §13 keeps the core free of WebAssembly and of a bundled sandbox; lockstep versions and shared tests are simpler in one repository, and an independent cadence is revisited only if a package needs one (§13's split rule).
10. **A `bun create` template instead of a starter package.** Not selected for 0.3.0: a package is conformance-tested and versioned with the core; the getting-started guide shows copying it.

## Rationale and Evidence

- **Correctness.** 25 proof scenarios render through QuickJS deep-equal to `render()`, with identical key order, using the unmodified 136 KiB runner-kit bundle.
- **Capability isolation.** Widget code sees only ECMAScript built-ins; `fetch`, `process`, `Bun`, `Deno`, `require`, `WebAssembly`, timers and `console` are `undefined`; `globalThis.constructor.constructor("return this")()`, `eval` and `new Function` reach only the sandbox; `import("node:fs")` is refused by the module loader, which serves only `liveframe:kit` and the linked package. The parent–child channel is not reachable from the realm, so a widget cannot forge an answer (the Deno child could).
- **Hard bound.** Detecting a hold, killing the child and rendering the next request took 138–194 ms.
- **Cost.** Child cold start 21 ms; agent-home 69–71 ms per fresh render (p95 76–83), of which 30 ms is the fixed cost of a runtime and the kit and about 50 µs per node is interpretation (about 4 µs in process); the smallest surface with a kept runtime costs 0.3–4 ms. `reuse: "package"` therefore stays, defaulting off.
- **Engine hazards that fix rules.** Host stack exhaustion and an interrupted promise-job chain both abort QuickJS's `JS_FreeRuntime` assertion on `dispose()` (both builds). After an abort the same module ran again, but its state is not trusted; a fresh instance costs 0.3–2 ms with a shared compiled `WebAssembly.Module`.
- **Not measured, so not claimed:** macOS and Windows; `reuse: "package"` through the child; resident memory growth of a long-lived child; `isolated-vm`. CI for the new packages runs on Linux until a matrix is added.

## References

- `plans/evidence/031-runner-options.md` — findings F1–F9, comparison, budget and effects on later tasks.
- `plans/evidence/031-spike/` and `plans/evidence/031-spike/outputs/` — the spike, `run-all.sh` and raw output (not shipped).
- `decision-logs/2026-11-05-0238-release-0-3-0-scope.md` — W1, W7b and the owner's runtime decisions.
- `decision-logs/2026-10-22-1600-preview-and-runners.md` — runner contract and the reference runners' non-isolation.
- `docs/spec.md` §7.5, §13, §14; `docs/security.md` "What is not protected".
- `src/runner-kit/*`, `scripts/runner-kit-bundle.ts`, `dist/runner-kit.bundle.js` — the self-contained kit the sandbox loads.
- quickjs-emscripten (`/justjake/quickjs-emscripten`, 0.32.0, MIT; QuickJS 2025-09-13+f1139494) — `setMemoryLimit`, `setMaxStackSize`, `setInterruptHandler`, `setModuleLoader`, `evalCode(…, { type: "module" })`.

## Consequences

- Positive: a host gets hostile-code execution with no host API in the realm, per-render memory and stack limits, a hard CPU bound and a recoverable runner, and `runnerSuite()` (Task 3) can state each of those as a test.
- Costs: about 70 ms per fresh agent-home render, so the runner's default `timeoutMs` is 250 ms, not the runtime's 100 ms; a long-lived child process to supervise; Bun-only.
- Risks: the child runs with the host's privileges, so only QuickJS stands between widget code and the file system and network; the runner README and `docs/security.md` say so and recommend an OS sandbox around the child. CPU side channels and memory pressure up to `memoryBytes` per render are not protected. A defect in QuickJS or the wasm runtime is not covered.
- Spec changes owed by later tasks: §13 rule 3 and the packages table (scoped to the core package, the two new packages listed), §14 non-goals (an isolation sandbox is a non-goal of the core only), §7.5 (the runner and its limits).
- Task changes recorded in plan 031: Task 3 gains the uninterruptible-native, forged-answer and recovery cases; Task 4 is process-hosted with the defaults above; Task 5 carries the budget table.
- Revisit if: Bun's `Worker.terminate()` can stop native wasm calls (a worker would then replace the child); a measured need appears for a faster engine than an interpreter (for example a V8 isolate API on Bun); or a package needs its own release cadence.
