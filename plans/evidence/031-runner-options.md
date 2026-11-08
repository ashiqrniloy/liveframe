# Plan 031 Task 1: isolated runner options, measured

Question: which engine, and which hosting of it, gives `@arnilo/liveframe-runner-quickjs` a real isolation boundary for hostile widget code on Bun ≥ 1.4.2 with no Node runtime?

Method: a spike (`plans/evidence/031-spike/`, not shipped) renders the agent-home code package (679 nodes, the largest proof surface) and every other proof scenario through each candidate, runs hostile probes, and records cost. Regenerate every number with `bash plans/evidence/031-spike/run-all.sh` (raw output in `031-spike/outputs/`).

Machine and versions: Linux 7.3.0 (CachyOS), Bun 1.4.4 (repo floor 1.4.2), `quickjs-emscripten` 0.32.0 with the `@jitl/quickjs-wasmfile-release-sync` variant (bellard QuickJS 2025-09-13+f1139494), the `quickjs-ng` variant 0.32.0, Deno 2.9.6 (npm `deno` binary), bubblewrap 0.13.1. One machine, not a quiet-host proof; numbers are medians of 15–200 runs and are re-baselined by Task 5 before any gate.

## Findings

### F1. QuickJS renders every proof scenario identically

25 proof scenarios across five widgets: the tree from a QuickJS runtime that serves only the runner-kit bundle and the linked package equals `render()`'s tree under deep equality, with identical key order (`outputs/spike.txt`). The kit bundle (136 KiB) runs unmodified. The sandbox receives one JSON string (62.6 KiB: catalog, capabilities, manifest, inputs) and returns one (agent-home: 117 KiB).

### F2. The cost is interpretation plus start-up, and it is high

| Path (agent-home, 679 nodes) | Median | Notes |
|---|---|---|
| `inProcessRunner` warm | 1.9 ms | |
| `templateRunner` warm (template port) | 1.5–2.0 ms | executes no author code |
| `workerRunner` warm / cold | 5.8–6.3 ms / 49–55 ms | no isolation |
| QuickJS, same thread, `reuse: "none"` | 65–66 ms | new runtime, kit evaluated each time |
| QuickJS, same thread, runtime kept | 32–39 ms | kit loaded once |
| QuickJS in a child process (below), `reuse: "none"` | 69–71 ms (p95 76–83) | adds IPC of 62 KiB in, 117 KiB out |

Fixed cost per fresh render is 30 ms (`git-status/empty`, 3 nodes: 30.1 ms), of which 16 ms is creating the runtime and evaluating the kit. The marginal cost is about 50 µs per node (agent-home 66.6 ms, 12-node `failed` scenario 33.2 ms), against about 4 µs per node in process. A kept runtime with kept catalog objects costs 0.3 ms for the smallest surface (4.0 ms when the request is re-parsed) and 32 ms for agent-home. `reuse: "package"` is therefore worth keeping for small surfaces and buys about half for large ones. Peak memory is not the constraint: agent-home renders at a 4 MiB limit. The `quickjs-ng` build is 20–35 % slower on the same workloads (`outputs/reuse-floor-ng.txt`).

### F3. The plan's 1 MiB stack default is unsafe on Bun

`setMaxStackSize` counts QuickJS's own estimate, but QuickJS recurses on the host stack. At 512 KiB some call shapes (a recursive `map`, `toJSON`, a getter, a Proxy) exhaust the host stack first, and at 1 MiB every shape does: the host throws `RangeError: Maximum call stack size exceeded` from inside wasm, and the next `dispose()` aborts (F4). At 256 KiB every shape tested gives QuickJS's own graceful "stack overflow", also with 6000 host frames already on the stack (`outputs/stack-sizes.txt`, `stack-recovery.txt`). Default `stackBytes` becomes 256 KiB, not 1 MiB.

### F4. The engine can abort on `dispose()`; the module survives

`Aborted(Assertion failed: list_empty(&rt->gc_obj_list) … JS_FreeRuntime)` is thrown to the host after (a) a host stack `RangeError` inside wasm and (b) running `executePendingJobs()` on a self-perpetuating promise chain that was interrupted. Both QuickJS builds do it (`outputs/dispose-abort.txt`, `jobs-abort.txt`). After the abort the same wasm module still ran `1 + 1` (`outputs/after-abort.txt`), but its state is not trusted. Consequences for the design:

- Never call `executePendingJobs()`. Widgets are synchronous (`renderModule`), so nothing needs promise jobs, and a hostile microtask loop then never runs. A package with top-level `await` leaves `__out` unset and is reported as not settled (the in-process runner races such a module against the timeout; this is a documented difference).
- Wrap `dispose()`: any host-side throw marks the wasm instance tainted and it is dropped, never reused.
- A fresh wasm instance costs 0.3–2 ms when the compiled `WebAssembly.Module` is shared (`WebAssembly.compile` of the 503 KiB file is 1.9 ms; without sharing, 2–6 ms warm), so `reuse: "none"` can afford a new instance per render.

### F5. Native builtins ignore the interrupt handler

The interrupt handler is polled every 10 000 opcodes, so a single long native call is never interrupted and the memory limit does not stop CPU use:

- `'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b')` did not return in 60 s (`outputs/uninterruptible2.txt`), with the interrupt deadline at 100 ms and a 64 MiB limit (bellard build; the `quickjs-ng` build was not run for this case).
- `(10n ** 200000n).toString()` held the thread for 1.1 s (grows quadratically with digits; not measured at the BigInt size cap).
- Allocating loops of `new Array(1e5).fill(1)` took 1.3–2.0 s to reach the memory limit at 8, 16, 32 and 64 MiB alike, and the 5 s deadline never fired.
- Interrupted correctly (about 100 ms): `while (true) {}`, catastrophic regular expressions, `sort` of 2 million items, `localeCompare` sorts, replace over 10 MB (`outputs/uninterruptible.txt`). Memory exhaustion is a catchable `out of memory`, `string too long`, `BigInt is too large`.

So a same-thread QuickJS cannot honour "limit-exceeded within `timeoutMs`" against hostile code; it honours it against accidents and ordinary loops.

### F6. Only killing a process bounds CPU

`Worker.terminate()` on Bun 1.4.4 did not stop a worker stuck in the `indexOf` call: no `close` event within 3 s, and the thread keeps spinning (`outputs/hold-worker.txt`). `SIGKILL` of a child process ended it in 4.5–9.7 ms. QuickJS hosted in a child process:

| Child-process QuickJS | Result |
|---|---|
| Cold start (spawn Bun, compile wasm, receive kit) | 20.5–21.7 ms |
| First render in the child | 110–119 ms |
| Warm round trip, new runtime per render | 69.4–70.7 ms, p95 75.8–82.7 |
| Warm round trip, new runtime and new wasm instance | 73.6–75.5 ms, p95 80–108 |
| Hold detected, `SIGKILL`, new child, next render ok | 138–194 ms |

A plain `bun -e 1` spawn is 6.4 ms. The IPC channel (`serialization: "json"`) is owned by the host; widget code inside QuickJS has no way to write to it.

### F7. Capability probes inside QuickJS

Widget code sees only ECMAScript built-ins (`Object.getOwnPropertyNames(globalThis)` has no host name; `SharedArrayBuffer` exists and is inert without threads). `fetch`, `process`, `Bun`, `Deno`, `require`, `module`, `exports`, `setTimeout`, `console`, `WebAssembly`, `TextEncoder`, `structuredClone`, `performance`, `Worker` are `undefined`. `globalThis.constructor.constructor("return this")()` is the sandbox's own global. `(0, eval)` and `new Function` reach only the sandbox. `import.meta` is `{}`. `import("node:fs")` goes to the module loader, which refuses it (`module not found`); only `liveframe:kit` and the linked package resolve. No native function other than ES built-ins is reachable. Stack overflow, `string too long`, `out of memory` and `interrupted` all arrive as `render-failed` messages from inside the kit or as an eval error, and must be mapped to `limit-exceeded` by message (`stack overflow`, `out of memory`, `interrupted`).

### F8. Deno with every permission denied

Deno 2.9.6 with `--no-prompt --deny-read --deny-write --deny-net --deny-env --deny-run --deny-ffi --deny-sys`, kit loaded as a `data:` module (`outputs/deno-host.txt`):

- Cold start 72–156 ms; first render 65–82 ms; warm round trip 57–63 ms (p95 67–72). Almost no faster than QuickJS here: the first-use cost of V8 and the validator dominates.
- File, env and subprocess access raised `NotCapable`. But `Deno` (115 keys), `fetch` and `Deno.exit` are present; `Deno.exit(7)` ended the child; a widget wrote a forged result line to the host's stdout channel and the host received it (`FORGED`), which is the worker runner's cross-render answer problem.
- A memory bomb stopped the child with a V8 fatal out-of-memory at the 512 MiB heap limit, contained by the process. The V8 `indexOf` is fast, so the F5 hold does not arise.
- Needs a 95 MB external binary; the attack surface is V8 and Deno's permission layer, not the absence of host APIs.

### F9. Other options

- **bubblewrap** (Linux only, 0.13.1): `bwrap --ro-bind / / --unshare-all --die-with-parent bun …` costs 11.8 ms against 6.4 ms for a bare spawn; network was unreachable and writes to the home directory failed (`EROFS`). It is strong OS isolation for a child process, not a runner: the code inside still has a full JavaScript runtime, there are no per-render memory or CPU limits, and Windows and macOS have no equivalent.
- **Bun subprocess**: `bun --help` lists no permission or sandbox flags. A child process bounds time and crashes only, as the worker does.
- **`isolated-vm`** 7.0.2: a native addon for V8 (`engines.node >= 24`, 21 MB). Bun runs on JavaScriptCore, so a V8-API addon cannot load; ruled out by the Bun-only decision. Not run here (reasoned from the package metadata and the engine difference).
- **Dependency weight and licence**: `quickjs-emscripten-core` 0.8 MB + `@jitl/quickjs-wasmfile-release-sync` 0.7 MB + `@jitl/quickjs-ffi-types` 0.1 MB, all MIT, 0.32.0. The umbrella package `quickjs-emscripten` adds debug and asyncify variants (2.4 MB) the runner does not need. Deno: 95 MB, MIT.

## Comparison

| Criterion | QuickJS in a child process | QuickJS same thread | Deno, permissions denied | Bun child | bubblewrap + Bun | `isolated-vm` |
|---|---|---|---|---|---|---|
| Isolation strength | No host API exists in the realm; separate wasm memory; killable | Same, but cannot be killed | Permission checks in front of a full V8 + `Deno` API | None (full host APIs) | Namespaces and read-only filesystem around a full runtime | V8 isolate (reasoned) |
| Hard CPU bound | Yes, `SIGKILL` 5–10 ms | No (F5) | Yes, by kill | Yes, by kill | Yes, by kill | Not measured |
| Memory limit | `setMemoryLimit` per render | same | V8 heap flag, process dies | none | cgroups only if configured | isolate limit |
| Channel forging by widget | Not possible | Not possible | Possible (stdout, F8) | Possible | Possible | n/a |
| Linux / macOS / Windows | Wasm + `Bun.spawn`: yes (only Linux measured) | yes | Deno binary on all three | yes | Linux only | cannot load on Bun |
| Cold start / per render (agent-home) | 21 ms / 70 ms | 12 ms / 65 ms | 72–156 ms / 57–63 ms | 6 ms spawn / n/a | +5 ms spawn | n/a |
| Dependency weight | 1.6 MB npm, MIT | same | 95 MB binary | none | system package | 21 MB native |

## What each option does not isolate

- **QuickJS in a child process:** CPU side channels and timing; the host's memory pressure up to `memoryBytes` per render plus the wasm instance and child baseline; a defect in QuickJS or in the wasm runtime (the child runs with the host's own privileges, so only QuickJS stands between widget code and the file system and network; an OS sandbox around the child is the defence in depth); the 117 KiB result channel is host-owned, but a widget can emit a valid tree for its own render, which the host revalidates (law 2).
- **Deno:** V8 or permission-layer defects; the `Deno` namespace is reachable; stdout forging; `Deno.exit`.
- **Bun child:** everything except time and crash recovery.
- **bubblewrap:** a defect in the full runtime inside it; CPU and memory unless cgroups are configured.

## Conclusion

QuickJS is confirmed as the engine, with two refinements the measurement forces:

1. **Host it in a killable child process.** A same-thread QuickJS cannot meet "terminates hostile code within `timeoutMs`" (F5), and a Bun worker cannot be terminated while in a native call (F6). The parent process owns verification, the validator, the channel and the deadline; the child owns the wasm module.
2. **Defaults from the measurements:** `stackBytes` 256 KiB (F3), `memoryBytes` 32 MiB, `timeoutMs` 250 ms (3.5× the largest proof surface fresh, soft interrupt) with a hard kill 100 ms after it, no `executePendingJobs()`, drop a tainted wasm instance (F4).

Budget proposed for Task 5, to be re-baselined on a quiet host before it gates: each is about 1.5× the measured median.

| Gate (agent-home unless stated, median) | Measured | Budget |
|---|---|---|
| `reuse: "none"` warm round trip | 69–71 ms | ≤ 110 ms |
| `reuse: "none"`, smallest proof surface | about 38 ms (30 ms same thread + IPC) | ≤ 60 ms |
| `reuse: "package"` warm round trip | 32–39 ms same thread, + IPC | ≤ 60 ms |
| `reuse: "package"`, smallest proof surface | 0.3–4 ms same thread, + IPC | ≤ 8 ms |
| Child cold start | 20.5–21.7 ms | ≤ 60 ms |
| Hold, kill, recover, next render | 138–194 ms | ≤ 300 ms |

Not measured, so not claimed: macOS and Windows behaviour, `reuse: "package"` through the child process, resident memory growth of a long-lived child, and `isolated-vm` itself.

## Effects on later tasks of plan 031

- **Task 2:** the runner package ships the wasm file and a child entry `.js`; its archive gate checks both and checks the core archive still has no wasm.
- **Task 3:** the isolation cases add the uninterruptible native hold (F5), the forged-answer probe (a widget cannot write to the host channel), and recovery after a kill; the stack-overflow case uses the 256 KiB default.
- **Task 4:** `index.ts` (host: verify, validate, deadline, child lifecycle), `child.ts` (the child entry), `runtime.ts` (QuickJS render), `load.ts` (linking, module sources); `quickjsRunner(options?)` still returns `Promise<Runner & { close(): void }>`; options `memoryBytes`, `stackBytes`, `timeoutMs`, `reuse`, `maxRuntimes`. Template packages render on the host through `renderTemplateRun`: no author code runs, so nothing needs isolating, the tree is the same function's output, and it costs no IPC. Dependencies: `quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync`, each pinned to 0.32.0, not the umbrella package.
- **Task 5:** the budget above replaces the single-figure budget; docs name the child process, the defaults and the limits of the claim.
