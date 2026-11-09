# Security model

Liveframe is built for UI that arrives at runtime, so its trust boundaries are part of its design. This guide states what the library checks, and what it does not. The normative rules are [spec §2](spec.md#2-the-model) (the four laws) and [spec §14](spec.md#14-non-goals-for-v1) (non-goals).

A widget is untrusted input. It runs on your backend, produces data, and never holds authority. The library applies that in four places:

1. **Install.** `pack()` and `verifyPackage()` validate the manifest, every scenario and the bundled module against the published formats, then hash the package canonically. A package that does not match its format is rejected before anything is stored or executed.
2. **Load.** `loadPlacement()` validates the stored records and re-checks the package hash against its `(id, version)`. Stored data is input, not truth: a corrupt record is a typed `LiveframeError`, and one malformed sibling does not block the others.
3. **Run.** `createPreview()` and `createAuthoring()` validate every successful runner tree on the host with that widget's compiled validator before storing or reporting it, including trees from custom runners. They use the default validation limits; a custom runner's larger limits do not raise these. A production host calling a custom runner directly must perform the same host check. `workerRunner()` accepts only the result whose request id is pending and terminates a worker that answers without being asked; malformed results or error lists produce `render-failed` and recycle the worker. A rejected tree is not reused. The reference runners verify package hashes before loading code. Only deeply frozen packages can reuse hash verification; mutable transport packages are rehashed on every call. Packing and verification return deeply frozen owned copies.
4. **Arrival.** `<Surface>` and `<Preview>` validate again in the browser before the renderer reads the tree, so the renderer never receives a node that skipped a check — even if the transport or a caller was wrong. When a surface streams `liveframe/tree-patch/1` patches, `applyPatch()` is a structural step only: a patched tree is validated whole before render (with `validateTree` and by `<Surface>` on arrival), and a stale or malformed patch fails closed so the host can re-send a whole tree. When an intent comes back from the browser, `checkOffered(servedTree, origin, intent, validator)` is still the host's dispatch check against the current served tree and revision before the app authorises and runs the operation.

Widget-authored schemas may not use `pattern` (`params`, `state` and `context` in a manifest), so an agent cannot ship a regular expression that stalls the host or the browser. Catalogs and capabilities belong to the app and keep the full schema language, including `pattern`.

`meta` on a manifest, capability action or capability source is the host's annotation. The library bounds it (8 levels, 4096 bytes), validates it on install and on every load, and never reads it: it grants nothing, so a host must not treat a `meta` value as authorisation. `liveframe mcp` hides it from the agent unless the config sets `exposeMeta`.

## Template packages need no isolation runner

A template widget (`package.template`, [spec §7.6](spec.md#76-template-widgets)) is data: element JSON plus a closed table of expression operators. The library evaluates it, so it holds no host access, no regular expressions, no recursion and no loops beyond input arrays, and its work is counted against `limits.steps`. `pack()` validates it against the manifest at install, `verifyPackage()` again on load, and the tree it renders passes the same compiled validator as a TSX widget's (law 2). Its intents are data that the host re-checks (law 4).

So `templateRunner()` executes no author code and is the recommended production runner for authors you do not trust who only need templates. It refuses code packages. A host that accepts both kinds still needs an isolated runner for the code packages and should route each package to the runner for its kind. A template still cannot make the host trust its output: size, depth and node limits, the manifest's schemas and the catalog all apply.

`limits.steps` (default 1,000,000) is the only bound on a template's running time; `templateRunner()` has no wall-clock timeout. On the reference machine a hostile template that nests two `$map`s over 1,000-item arrays spends the whole default budget and stops with `limit-exceeded` after about 25 ms, and a string-doubling `$let` chain stops at the string cap in about 2 ms. A real widget needs about 10⁴ steps, so a host that accepts templates from untrusted authors can pass a much lower `limits.steps` (100,000 is ten times the proof widgets' need) to cap the cost of one render at about 2.5 ms. Run a template in `workerRunner()` when the host also wants a wall-clock timeout.

## What the QuickJS runner isolates

`quickjsRunner()` from `@arnilo/liveframe-runner-quickjs` is the isolated runner ([choosing a runner](packages.md#choosing-a-runner)). Widget code runs in QuickJS (WebAssembly) in a Bun child process that the runner owns.

**It isolates**

- Host capabilities: the realm holds only ECMAScript built-ins. `fetch`, `process`, `Bun`, `Deno`, `require`, `WebAssembly`, timers and `console` are `undefined`; `eval`, `new Function` and `globalThis.constructor.constructor("return this")()` reach only the sandbox; `import()` of anything but the linked package and `liveframe:kit` is refused.
- Time: a soft interrupt at `timeoutMs`, and a `SIGKILL` of the child 100 ms later for code stuck in one native call that QuickJS cannot interrupt. Both are `limit-exceeded`, and the next render starts a new child.
- Memory and stack: a heap limit (`memoryBytes`, default 32 MiB) and a stack limit (`stackBytes`, default 256 KiB), each `limit-exceeded`.
- State: a fresh runtime per render by default, so module state does not leak between renders or packages.
- The answer channel: the parent–child channel is not reachable from the realm, so widget code cannot forge a result or answer another render. The host still re-validates every tree (law 2).

**It does not protect against**

- A defect in QuickJS or in the WebAssembly runtime. The child runs with the host's privileges (an empty environment, ignored stdio), so only QuickJS stands between widget code and the file system and network. Run the child inside an OS sandbox (bubblewrap, a container, a restricted user) for defence in depth.
- CPU side channels, and CPU contention: a render uses up to `timeoutMs` plus 100 ms of one core.
- Head-of-line blocking: one child renders one widget at a time, so a widget that holds its render delays every render queued behind it by up to `timeoutMs` + 100 ms plus about 250 ms to start the replacement child. Use a separate runner for authors you do not trust.
- Host memory pressure up to `memoryBytes` per render (the wasm heap plus the child's own). Measured on Linux: 52 MiB resident at start, 74 MiB steady, about 90 MiB with `reuse: "package"`, no growth over 500 and 1000 renders, and 15 kills left no process behind.
- `reuse: "package"`: module state survives between renders of one package. Use it only for code you trust to behave.
- A child orphaned by a host that is killed while the child is in a native call; it spins until killed by hand.
- Platforms it was not run on: only Linux has been measured.

`templateRunner()` executes no author code at all, so it has nothing to isolate; the template's step limit bounds it ([above](#template-packages-need-no-isolation-runner)).

## Local bindings run in the browser

A node's `when` and `bind` are expressions evaluated by the renderer ([spec §8](spec.md#8-interaction-synaptas-three-tiers)), so this is the one place the browser computes anything from tree data. They are data, not code: the evaluator is the template language's fixed table of library closures cut down to an operator list with no iteration, binding or collection builders. Their only inputs are `local` (the surface's own local state) and `self` (the node's own props), so an expression cannot reach data the widget did not put in the tree. Each is limited to 16 levels, 64 expression nodes and 256 evaluation steps, a node to 16 `bind` entries and a tree to 10,000 expression nodes. The validator checks every expression against the manifest's `local` schema and the kind's prop schema before the tree arrives, and the renderer checks each bound value again before an implementation reads it; a failure draws the node fallback and reports `binding-failed`.

`setLocal` carries no authority: the renderer applies it, checks the value against the local schema, and never calls `onIntent` or `confirm`. `checkOffered` rejects it on the host side, so no host dispatches it. Local state is never sent anywhere; a widget that wants the host to know a value commits it with a `setState` event. Action results (`actions`) are host facts the widget reads, and a result's `value` must match the capability's `result` schema.

At the largest tree the validator accepts (about 1,200 rows each with a `when` and a `bind`), a keystroke costs under 15 ms in the core and the first arrival about 130 ms, both measured under load, so the bounds also bound the browser's work.

## Streamed element JSON

`streamElements()` parses text that an agent is still writing, so it treats the text as hostile. It does linear work (open containers and long strings cost the same per character as closed ones), stops at 1,024 levels of nesting (`limit-exceeded` at `/$stream/<offset>`), refuses text longer than four times `limits.bytes` characters, and draws only trees that pass the compiled validator. After a fatal failure it reads no further.

## The host pipeline validates on the host

`renderPlacement()` and `handleIntent()` ([spec §7.7](spec.md#77-the-host-pipeline)) put the checks above in one fixed order, so a host that uses them cannot skip one:

- **Render.** The placement is loaded and re-verified (`loadPlacement`), sources are resolved as the viewer with your `resolve`, and the runner's tree is validated on the host with the widget's compiled validator before it can be served (law 2), whichever runner produced it. A failed source becomes the widget's `sourceOutcome` envelope or fails the render; the resolver's error text is never copied into the tree. A render with unchanged inputs is skipped, and a changed tree is diffed against the last accepted one.
- **Intent.** `checkOffered` runs first, against the tree you served. Then your `authorize` runs, for a `setState` write as for an action, and only then does the library persist the write or call your `dispatch` as the viewer (law 4). A stale revision is refused, never rewritten; a throwing `authorize` refuses; a throwing `dispatch` is recorded `failed` with a fixed reason, so host error text never reaches the widget. The recorded `actions` are host facts the widget reads and grant nothing.
- **What it does not do.** It holds no state between calls, so serialising calls per placement and scope, and storing the `Served` you pass back as `previous`, are yours. `authorize` is your policy: the library calls it but cannot decide it. `HostEvent`s carry ids, kinds and reasons, never values.

## Packages are frozen and libraries are pinned

`pack()` and `verifyPackage()` return deeply frozen copies, and `render()` hands the widget a frozen structural copy of its inputs while leaving yours writable, so neither side can change what the other has checked. A widget's library dependencies are exact `{ id, version, hash }` pins covered by the package hash; a runner loads each library by hash and a hash that differs is `hash-mismatch`. As with any hash, this is integrity, not authorship ([below](#what-is-not-protected)). Every public document validator rejects an object created in another realm with `invalid-document`, so a crafted cross-realm prototype cannot reach a validator through its shape: transport text and parse it inside the receiving realm.

## What is not protected

- **The reference runners are not sandboxes.** `inProcessRunner()` shares the host's realm, so widget code can reach anything the process can, and a synchronous loop cannot be interrupted (its timeout covers the return, not the loop). `workerRunner()` bounds time and crashes, but it does not restrict what code can access, and one worker serves every package: a draft that keeps running can answer a later render of a package it did not author. The host re-validates that tree against the later widget's manifest, and a worker that answers out of turn is terminated — but the answer still came from code you did not run. Verify packages, run only code you trust, and plug an isolated runner ([`quickjsRunner()`](#what-the-quickjs-runner-isolates) or your own) into both preview and production for anything hostile. The preview, package and MCP guides repeat this where it applies.
- **The runner kit is not an isolation boundary.** `renderModule()`, `linkPackage()` and the single-file `runner-kit.bundle.js` that contains them run in whatever realm calls them and never bound time or reach. Use them inside a sandbox you trust, validate every tree the sandbox returns on the host, and keep them out of the browser. See the [package guide](packages.md#build-a-runner-with-the-kit).
- **`liveframe mcp` runs agent drafts with the process's permissions** unless the config names a runner. The module import ban is syntactic: a draft can still reach the file system, the network and `Bun.spawn` through what it is allowed to import. The server says so on stderr once at startup; give an untrusted agent an isolated `config.runner`. See the [agent guide](mcp.md).
- **Stores are untrusted input.** The `Store` interface and `fileStore(dir)` keep records for you; they do not encrypt them, enforce tenancy, take transactions or guarantee durability under crashes. Validate what you read, as `loadPlacement()` does. See the [package guide](packages.md).
- **A hash is integrity, not authorship.** Anyone who changes a package can calculate a new hash. Provenance, review and approval are yours.
- **URL-valued props: declare `url`.** A `link.href` or `image.src` that takes a URL should declare `url: { schemes: [...], relative? }`; the tree validator then rejects `javascript:`, `data:`, mixed-case and control-character-split schemes, and protocol-relative values with `invalid-prop`. A prop that does not declare it is passed through as a plain string, and nothing in the renderer interprets a string as a URL, so a URL-valued prop without `url` is still yours to constrain.
- **Passing the conformance kit does not prove isolation or authorisation** ([spec §14](spec.md#14-non-goals-for-v1)). The kit tests the app's side of the catalog, styling, renderer and store contracts — not sandboxing, approval flows or tenancy. See the [conformance guide](conformance.md).

The authoring `set_state` tool applies only an offered `setState` event from
the current single-scenario render, checked by `checkOffered` with its current
surface and revision. It refuses action events before logging or dispatch.
The bound preview page receives trees only.

## 0.2.2 audit

The 0.2.2 performance and accessibility additions do not alter Liveframe's security posture:
- Client-side validation remains strict on arrival: `<Surface>` and `<Preview>` validate every whole-tree and streamed patch arrival before rendering.
- Reference runner boundaries are unchanged: `inProcessRunner()` and `workerRunner()` retain their documented contracts and non-isolation scope.
- Media axes for preview capture (`textScale`, `forcedColors`, `reducedMotion`) multiply cells strictly within the existing capture cell bounds (`maxCells`, default 12, or configured `maxCaptureCells`); calls exceeding the bound fail closed.

## 0.3.0 audit

Each new surface was reviewed against the four laws ([spec §2](spec.md#2-the-model)); none moves a boundary:

- **Law 1 (widget code never runs in the browser).** Template widgets are data evaluated on the host. The browser evaluates only `when` and `bind`, which are expressions over `local` and the node's own props with a fixed operator list and counted bounds; they are not widget code and read nothing the tree did not carry. `quickjsRunner()` runs widget code on the backend, in a child process.
- **Law 2 (the tree is validated data).** `renderPlacement()` validates every runner tree on the host; `<Surface>` and `createSurfaceCore()` validate every arrival and re-validate every bound value; `streamElements()` draws only trees that pass the compiled validator; `validateTemplate()` and the host both check a template.
- **Law 3 (widget code never sets colours or raw CSS).** Extension properties are set in recipes by the design system, with colours from theme roles only; a widget cannot name one. App-declared states and axes are catalog and design-system data. `url` rules constrain values, they do not add a style channel.
- **Law 4 (a widget never holds authority).** `setLocal` is applied by the renderer and never reaches `onIntent`; `checkOffered` rejects it. `actions` results and `HostEvent`s are host facts the widget reads. `handleIntent()` calls your `authorize` before any write or dispatch. `meta`, `local` and `migrateState` expressions grant nothing.

The remaining exposures are the ones named above: a hash is not authorship; the reference runners, the runner kit and `liveframe mcp`'s default runner are not isolation boundaries; the QuickJS runner has the limits listed for it; and a prop that does not declare `url` is a string you constrain yourself.

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md) for the private reporting route.
