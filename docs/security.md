# Security model

Liveframe is built for UI that arrives at runtime, so its trust boundaries are part of its design. This guide states what the library checks, and what it does not. The normative rules are [spec §2](spec.md#2-the-model) (the four laws) and [spec §14](spec.md#14-non-goals-for-v1) (non-goals).

A widget is untrusted input. It runs on your backend, produces data, and never holds authority. The library applies that in four places:

1. **Install.** `pack()` and `verifyPackage()` validate the manifest, every scenario and the bundled module against the published formats, then hash the package canonically. A package that does not match its format is rejected before anything is stored or executed.
2. **Load.** `loadPlacement()` validates the stored records and re-checks the package hash against its `(id, version)`. Stored data is input, not truth: a corrupt record is a typed `LiveframeError`, and one malformed sibling does not block the others.
3. **Run.** Every tree a runner returns is validated on the host with that widget's compiled validator before anyone sees it. `workerRunner()` accepts only the result whose request id is pending and terminates a worker that answers without being asked; a rejected tree is not reused. A package's hash is verified once per object before its code is loaded.
4. **Arrival.** `<Surface>` and `<Preview>` validate again in the browser before the renderer reads the tree, so the renderer never receives a node that skipped a check — even if the transport or a caller was wrong.

Widget-authored schemas may not use `pattern` (`params`, `state` and `context` in a manifest), so an agent cannot ship a regular expression that stalls the host or the browser. Catalogs and capabilities belong to the app and keep the full schema language, including `pattern`.

## What is not protected

- **The reference runners are not sandboxes.** `inProcessRunner()` shares the host's realm, so widget code can reach anything the process can, and a synchronous loop cannot be interrupted (its timeout covers the return, not the loop). `workerRunner()` bounds time and crashes, but it does not restrict what code can access, and one worker serves every package: a draft that keeps running can answer a later render of a package it did not author. The host re-validates that tree against the later widget's manifest, and a worker that answers out of turn is terminated — but the answer still came from code you did not run. Verify packages, run only code you trust, and plug your own isolated runner into both preview and production for anything hostile. The preview, package and MCP guides repeat this where it applies.
- **`liveframe mcp` runs agent drafts with the process's permissions** unless the config names a runner. The module import ban is syntactic: a draft can still reach the file system, the network and `Bun.spawn` through what it is allowed to import. The server says so on stderr once at startup; give an untrusted agent an isolated `config.runner`. See the [agent guide](mcp.md).
- **Stores are untrusted input.** The `Store` interface and `fileStore(dir)` keep records for you; they do not encrypt them, enforce tenancy, take transactions or guarantee durability under crashes. Validate what you read, as `loadPlacement()` does. See the [package guide](packages.md).
- **A hash is integrity, not authorship.** Anyone who changes a package can calculate a new hash. Provenance, review and approval are yours.
- **URL-valued props are the catalog's problem.** The library passes prop values through. A `link.href` or `image.src` that takes a URL must be constrained by a catalog `pattern` or sanitised by the implementation that renders it; nothing in the renderer interprets a string as a URL.
- **Passing the conformance kit does not prove isolation or authorisation** ([spec §14](spec.md#14-non-goals-for-v1)). The kit tests the app's side of the catalog, styling, renderer and store contracts — not sandboxing, approval flows or tenancy. See the [conformance guide](conformance.md).

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md) for the private reporting route.
