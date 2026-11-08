# @arnilo/liveframe-runner-quickjs

An isolated [Liveframe](https://github.com/ashiqrniloy/liveframe) runner. Widget code runs in [QuickJS](https://bellard.org/quickjs/) (WebAssembly, via `quickjs-emscripten`) inside a Bun child process that the runner owns and can kill. A host gets a real isolation boundary for hostile widget code without building a sandbox.

Requires Bun ≥ 1.4.2 and `@arnilo/liveframe` `~0.3.0`. No Node runtime is supported.

```ts
import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";

const runner = await quickjsRunner({ memoryBytes: 32 << 20, stackBytes: 256 << 10, timeoutMs: 250 });
const result = await runner.render(pkg, inputs, { catalog, capabilities, surfaceId: "home", revision: 1 });
runner.close(); // kills the child
```

It is a `Runner` (spec §7.5): use it wherever the app passes one, for example `renderPlacement({ runner, … })` from `/host`, or `runner:` in the `liveframe mcp` config. Call `close()` when done.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `memoryBytes` | 32 MiB | QuickJS heap limit per runtime |
| `stackBytes` | 256 KiB | QuickJS stack limit. Not 1 MiB: QuickJS recurses on the host stack, and at 1 MiB some call shapes overflow it first, which aborts the engine |
| `timeoutMs` | 250 | Soft deadline: QuickJS's interrupt handler stops the render. A render's `options.timeoutMs` overrides it |
| `reuse` | `"none"` | `"none"`: every render gets a new runtime in a new wasm instance. `"package"`: one runtime per package hash is kept, so module state survives between renders. Faster; for code you trust to behave but have not tested, never for hostile code |
| `maxRuntimes` | 16 | Runtimes kept with `reuse: "package"`, least recently used evicted first |

## What it does

- **No host API in the realm.** Widget code sees only ECMAScript built-ins. `fetch`, `process`, `Bun`, `Deno`, `require`, `WebAssembly`, timers and `console` are `undefined`; `globalThis.constructor.constructor("return this")()`, `eval` and `new Function` reach only the sandbox; `import()` goes to a loader that serves only the Liveframe kit, the package and its pinned libraries.
- **A channel widget code cannot write to.** The parent–child channel is not reachable from the realm, so a widget cannot answer for another render.
- **Law 2 on the host.** The host verifies the package hash and the library pins before anything is loaded and validates every tree the child returns. A malformed or forged answer is `render-failed`.
- **Limits.** Heap, stack and time are `limit-exceeded`. A render stuck in one native call (QuickJS cannot interrupt those) is ended by killing the child 100 ms after the soft deadline; the next render starts a new child.
- **Templates run on the host.** A template package runs no author code, so it needs no sandbox and renders in the parent.
- **Pending jobs never run.** The runner never calls `executePendingJobs()`; a package whose top-level `await` does not settle is `render-failed`. A wasm instance whose engine throws to the host is dropped, never reused.

## What it does not protect against

- **The child runs with the host's privileges** (with an empty environment). Only QuickJS stands between widget code and the file system and network. A defect in QuickJS or in the wasm runtime is not covered. Run the child inside an OS sandbox (bubblewrap, a container) for defence in depth.
- **CPU side channels and timing.**
- **Memory pressure** on the host up to `memoryBytes` per runtime, plus the wasm instance and the child's baseline. With `reuse: "package"`, up to `maxRuntimes` runtimes at once.
- **Only Linux has been measured.** macOS and Windows are expected to work (WebAssembly and `Bun.spawn`) and are not claimed.

## Cost

Measured on one Linux machine (Bun 1.4.4), agent-home (679 nodes): a fresh render is about 70 ms, of which about 30 ms is the fixed cost of a runtime and the kit; the child starts in about 21 ms; killing a stuck child and rendering the next request takes about 140–190 ms. See `plans/evidence/031-runner-options.md` in the repository. Templates and trusted code are cheaper with `templateRunner()` and `workerRunner()`.

Prove a runner with `runnerSuite()` from `@arnilo/liveframe/conformance`; this package passes the contract and isolation cases.
