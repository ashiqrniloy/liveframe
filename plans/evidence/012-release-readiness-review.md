# Release readiness review for 0.1.0

Reviewed on 2026-10-25 at commit `f253c21`, with the plan 010/011 closing edits uncommitted. The review covered implementation and tests, the public surface, security, cognitive complexity and defects, including the MCP server. Decisions: `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R1–R20).

**This file is the checklist for the pre-release review** (plan 013, the "Review every readiness item" task). Each item has an id, evidence, and the task that covers it. Before 0.1.0 is published, the review fills the `Pre-release status` column for every row, either:

- `fixed — <test or evidence>`, or
- `deferred — <owner approval quote and backlog entry>`.

No row may stay empty.

## What was run

- `timeout 900 bun run check`: passed. Generation drift, both typechecks, lint (38 warnings, 3 infos), format, and 590 tests across 87 files with 0 failures (261 s, Bun 1.4.4).
- `bun test --coverage src/__tests__` (lines):
  - formats, validate, css, pack, store, preview runners and session: 95–100%;
  - `sdk/render.ts`: 86%;
  - `react/renderer.tsx`: 85% (the rest runs in Chromium);
  - `cli/mcp.ts`, `cli/capture.ts` and `conformance/react/page.tsx` run in subprocesses or the browser, which Bun coverage cannot see.
- `bun run bench`: **failed**.
  - The render workload `core-queue.small` (5 nodes) measured 3.006 µs per node against the ≤ 3 µs gate. Every other workload passed; agent-home measured 1.839 µs per node and 1.2488 ms.
  - The validator gate passed: worst case 1.457 µs per node, against ≤ 1.5.
- `bun audit`: no vulnerabilities in 94 packages. `bun outdated`: only dev patch updates.
- `bun pm pack --dry-run`: 234 files, 142 of them under `src/__tests__/`, 4.11 MB unpacked.
- Probes, a scratch Bun test outside the repo that imports `src/` by absolute path (source in the appendix):
  - P1: a widget's code calls `self.postMessage({ type: "result", result: { ok: true, value: { forged: "<script>" } } })` → `workerRunner().render()` resolved `{"ok":true,"value":{"forged":"<script>"}}`.
  - P2: a widget sets `setInterval(() => self.postMessage(<forged result>), 0)`. 15 of the next 20 renders of *other* packages resolved with the forged value.
  - P3: a manifest state property `{ type: "string", maxLength: 100, pattern: "^(a+)+$" }` with initial state `"a"×n + "!"`. `pack()` took 2/21/79/313 ms at n = 18/22/24/26.
  - P4: `files: { "w.tsx": "await new Promise(() => {});\nexport default () => null;" }`. `pack()` succeeded, and `inProcessRunner().render(pkg, inputs, { timeoutMs: 100 })` was still pending after 1.5 s.
  - P5: `fileStore(dir).putPlacement({ id: "配".repeat(128), … })` threw `ENAMETOOLONG`.
  - P6: a valid placement `good` plus a file `placements/zz.json` containing `{"id":"zz"}`. `loadPlacement(store, "good", …)` returned `invalid-document` at `/slot`.
- Packed-archive consumer: the archive was extracted into a project's `node_modules/@arnilo/liveframe`.
  - `node -e 'import("@arnilo/liveframe")'` (Node 26.11.1) → `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.
  - `tsc -p .` with `{ strict, module/moduleResolution: NodeNext, skipLibCheck }` → 81 errors, all TS5097 (`.ts` import paths).

## Findings

| Id | Area | Finding and evidence | Covered by | Pre-release status |
| --- | --- | --- | --- | --- |
| B1 | Packaging | The exports point at raw `.ts` with `.ts` relative imports. Node cannot load the package, and default-strictness TypeScript consumers get 81 TS5097 errors. Bundlers would compile the library's `.tsx` with consumer JSX settings. | 013 T1, T2 | |
| B2 | Packaging | The archive ships `src/__tests__` (142 of 234 files), including proof-derived catalogs and styles. Backlog: "Exclude test fixtures from the release package". | 013 T1, T2 | |
| B3 | Process | No CI (no `.github/`). No `LICENSE`, and spec §15 leaves the license open. | 012 T2 (license); 013 T8 (CI) | |
| B4 | Packaging | `package.json`: `private: true`, `UNLICENSED`, `0.0.0`, no `repository`/`homepage`/`bugs`, no `publishConfig.access: "public"` (scoped packages default to restricted). | 012 T2 (license); 013 T1, T13 | |
| B5 | Packaging | The peer ranges are narrower than needed: `react`/`react-dom` `^19.3.1`, `playwright` `^1.64.1`, `@modelcontextprotocol/server` exactly `2.4.0`. | 013 T3 | |
| S1 | Security (law 2) | `workerRunner()` accepts any `result` message while a render is pending (`src/preview/worker/index.ts:47-55`) and never re-validates on the host. Requests are not correlated (P1, P2). | 012 T3 | |
| S2 | Security | Widget-authored `pattern`s run on the host (pack, verify, load, render inputs, intents) and in the browser (arrival `setState` checks). Catastrophic backtracking (P3). `src/schema.ts:209`, `src/validate/schema.ts:52`, `src/formats/manifest.ts:97`, `src/pack/verify.ts:37-43`. | 012 T5 | |
| S3 | Security | `liveframe mcp` runs agent-written drafts on the default `workerRunner()` with the user's privileges (`Bun.spawn`, file system, network). The import ban is syntactic only. `docs/mcp.md` does not say so plainly. | 012 T11 (startup warning); 013 T4 (security guide) | |
| S4 | Security, robustness | The runner caches are keyed by an unverified `pkg.hash` (`src/preview/load.ts:11`, `src/preview/in-process.ts:35-39`). The module and validator caches are unbounded, and every `pack_draft` adds an unloadable module. | 012 T4 | |
| S5 | Security (docs) | URL-valued props in app catalogs (`link.href`, `image.src`) need catalog patterns or implementation sanitising. Nothing tells catalog authors. | 013 T4 | |
| D1 | Defect | Top-level `await` is accepted by `pack()` (`src/pack/bundle.ts:163-166,243`) and hangs `inProcessRunner` regardless of `timeoutMs` (P4). | 012 T6 | |
| D2 | Defect | The `fileStore` file name for a valid 128-code-point id exceeds `NAME_MAX` (`src/store/fs/index.ts:14-22,56`; P5). | 012 T8 | |
| D3 | Defect | `loadPlacement` scans and validates every placement. One malformed sibling blocks all loads, and each load is O(n) (`src/store/load.ts:17-21`; P6). | 012 T8 | |
| D4 | Defect (MCP) | Concurrent tool calls can bind `config.preview()` twice (`src/cli/mcp.ts:209`), share one capture directory, and repack during a capture. | 012 T11 | |
| D5 | Defect (MCP) | Every capture failure is `limit-exceeded`, including an unknown axis value and a missing Chromium (`src/cli/mcp.ts:341-346`, `src/cli/capture.ts:42-47`). | 012 T11 | |
| D6 | Defect (test) | `no-playwright.ts`'s preload never blocks Playwright, so `gen_runs_without_playwright` proves nothing (backlog P4). | 012 T13 | |
| D7 | Defect (test) | The render bench fails on the 5-node `core-queue.small` (3.006 against 3 µs per node), a noise-dominated tiny tree. | 012 T13 | |
| D8 | Defect | (a) Nested non-JSON composed-component props are not rejected (backlog P2, "Reject nested non-JSON composed props"). (b) A dialog that arrives already open in the proof primitives stays under an inert ancestor (plan 010 F1); the demo host reuses those primitives. | (a) 012 T12; (b) 012 T1 disposition, 013 T5 | |
| A1 | Public surface | `Store` lacks `getPlacement(id)`. Adding it later breaks every implementer. | 012 T8 | |
| A2 | Public surface | Thrown errors are inconsistent: `compileValidator`, `resolveRecipes` and `styleDeclarations` throw `Error(JSON.stringify(errors))`, and stores throw plain objects. | 012 T7 | |
| A3 | Public surface | Internals leak: `CompiledValidator.build` (`@internal`) is in the public type; the root exports `NodeCheck`/`NodeCheckSink`; `RendererError` is a type-only export. | 012 T7 | |
| A4 | Public surface | `PreviewSession = ReturnType<typeof createPreview>` (`src/preview/authoring.ts:6`) makes every implementation detail public. | 012 T7 | |
| A5 | Public surface | The runner result-trust contract is unstated (S1). There is no policy for growing `LiveframeError["kind"]`. | 012 T3 (runner); 012 T7 (kinds) | |
| A6 | Formats | Schema `$id`s and the package `$ref` use `https://liveframe.dev/…`, a domain whose ownership is unconfirmed, and are not format-versioned. | 012 T9 | |
| A7 | Formats | Naming freeze: British spellings next to DTCG `color*` fields; `liveframe/1` next to `liveframe-*/1`. | Decision R12 (kept); spec unchanged | |
| A8 | Agent contract | MCP results: no catalog id; two error shapes (backlog "Give the MCP tools one error shape"); unbounded `render_scenarios` trees (backlog "Bound the tree size"). | 012 T10 | |
| T1 | Tests | The composed-component error paths in `render()` are untested (`src/sdk/render.ts:270-361`): a component that throws, returns a promise, returns a non-element, or exceeds the expansion depth; a fragment with extra props; an invalid key; nested child-array depth. | 012 T12 | |
| T2 | Tests | Nothing tests S1–S4, D1–D5 or an installed archive. | Each covering task; 013 T2 | |
| T3 | Tests | Suite registration under Vitest/Jest and non-Chromium browsers is untested (plan 010 F2). | Plan 010 T10 disposition (backlog P3) | Deferred by owner 2026-10-25; plan 010 impact review F2 and backlog “Verify conformance registrations in other runners and browsers”. |
| C1 | Complexity | Biome cognitive complexity (rule not enabled). Hot paths: the tree walk 212 (`src/validate/tree.ts:136`), the render `emit` 190 (`src/sdk/render.ts:252`). | 012 T14 | |
| C2 | Complexity | Off the hot path: `prepareDesignSystem` 137, `validateTheme` 93, bundle `visit` 84, `validateCatalog` 76, `classifyCatalogChange` 75, intent check 79, `checkValue` 74, manifest source binding 70. | 012 T14 | |
| C3 | Duplication | `isRecord`, the JSON-pointer helper and `codePointsWithin` are each written 2–4 times. There are five JSON walkers (`formats/json.ts`, `validate/structure.ts`, `sdk/render.ts` `isJson`, `sdk/intents.ts` `assertJson`, `pack/hash.ts`). | 012 T14 | |
| P1 | Carry-over | Plan 010 Task 10 is awaiting the owner's disposition of F1–F4. Roadmap Phase 5 is not closed. | 012 T1 | Fixed 2026-10-25: `7f08a49`; owner approved F1–F4 backlog dispositions, recorded in plan 010 impact analysis and backlog; Phase 5 Done registrations and law controls pass in `bun run check`. |
| P2 | Carry-over | Plan 002 Task 9 (impact analysis) is open. | 012 T1 | Fixed 2026-10-25: `e9a760f`; historical review preserved, current closure and owner-approved handoffs recorded in plan 002 impact analysis/backlog; proof law rejection cases pass in `bun run check`. |
| P3 | Carry-over | The plan 011 closing edits (roadmap, backlog, docs/mcp.md, evidence) were uncommitted at review time. | Committed by the owner as `8aa813a` during planning; 012 T1 confirms | Fixed: verified `git show --stat 8aa813a` on 2026-10-25; all five closing files are in that commit. |
| P4 | Release gate | G29 needs a Windows machine with a screen reader. | Deferred past 0.1.0 by R20 (owner: "Defer G29 past 0.1.0") | |
| P5 | Release gate | Phase 6 Done: the demo host persists through `fileStore` and has a preview page; an agent using only the published docs authors, iterates (capture CLI and MCP), publishes and places a widget. | 013 T5, T6, T10, T11 | |
| P6 | Release gate (found while planning) | Making the repository public (R16) publishes `proof/references/` (948 KB: Synapta and Clay source and design snapshots; OFL fonts with their licence texts) and the whole git history. No secret scan has been run. | 013 T7 | |

## Not findings (checked)

- The CSS projection escapes installed strings. `cssString` escapes `"`, `\`, control characters and `<` (`src/css/names.ts:8-14`), so sheets are safe inside `<style>`.
- `fileStore` path segments percent-encode everything except `[a-z0-9_-]`, so ids cannot traverse directories.
- The bench's "compiled vs generic 0.6×" compares full validation against a props-only baseline. The equal-work gate is the separate line and passes.
- Dependencies: no known vulnerabilities.

## Appendix: probe source

Copy this block to a scratch file outside the repository, set `R` to the checkout's `src` directory, and run `timeout 120 bun test <file>`. After the fixes in plan 012 the probes must report the rejected behaviour (P3 and P4 fail fast; P1, P2, P5 and P6 no longer reproduce).

```ts
import { expect, test } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const R = "/home/arn/Projects/liveframe/src";
const { validateCatalog, validateCapabilities } = await import(`${R}/index.ts`);
const { packageHash } = await import(`${R}/pack/hash.ts`);
const { pack } = await import(`${R}/pack/index.ts`);
const { workerRunner } = await import(`${R}/preview/worker/index.ts`);
const { inProcessRunner } = await import(`${R}/preview/index.ts`);
const { fileStore } = await import(`${R}/store/fs/index.ts`);
const { memoryStore, loadPlacement } = await import(`${R}/store/index.ts`);
const catalogDoc = await Bun.file(`${R}/__tests__/fixtures/proof/catalog.json`).json();
const capabilitiesDoc = await Bun.file(`${R}/__tests__/fixtures/widgets/capabilities.json`).json();
const { drafts } = await import(`${R}/__tests__/fixtures/widgets/drafts.ts`);
const { proofWidgets } = await import(`${R}/__tests__/fixtures/widgets/index.ts`);

const v = (r: any) => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const catalog = v(validateCatalog(catalogDoc));
const capabilities = v(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities, surfaceId: "probe", revision: 1 };
const base = v(pack(drafts[0], options));
const inputs = proofWidgets[0].scenarios[0];
const withCode = (code: string) => {
  const pkg = { ...base, code };
  return { ...pkg, hash: packageHash(pkg) };
};
const ok = (text: string) => `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: ${JSON.stringify(text)} });`;

test("P1 worker: widget forges its own validated result", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  try {
    const forged = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => { self.postMessage({ type: "result", result: { ok: true, value: { forged: "<script>" } } });
  return __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" }); };`;
    const result = await runner.render(withCode(forged), inputs, options);
    console.log("P1", JSON.stringify(result).slice(0, 200));
  } finally {
    runner.close();
  }
});

test("P2 worker: one widget answers later renders of other packages", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  try {
    const spy = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
setInterval(() => self.postMessage({ type: "result", result: { ok: true, value: { hijacked: true } } }), 0);
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "spy" });`;
    await runner.render(withCode(spy), inputs, options);
    let hijacked = 0;
    for (let i = 0; i < 20; i++) {
      const r = await runner.render(withCode(ok(`victim ${i}`)), inputs, options);
      if (r.ok && (r.value as any).hijacked) hijacked++;
    }
    console.log("P2 hijacked renders of other packages:", hijacked, "/ 20");
  } finally {
    runner.close();
  }
});

test("P3 pack: widget manifest pattern is a ReDoS on the host", () => {
  for (const n of [18, 22, 24, 26]) {
    const manifest = structuredClone(drafts[0].manifest);
    manifest.state.properties.evil = { type: "string", maxLength: 100, pattern: "^(a+)+$" };
    manifest.initialState = { ...manifest.initialState, evil: `${"a".repeat(n)}!` };
    const start = performance.now();
    const r = pack({ ...drafts[0], manifest }, options);
    console.log(`P3 n=${n} pack ok=${r.ok} ${(performance.now() - start).toFixed(0)} ms`);
  }
});

test("P4 pack accepts top-level await; inProcessRunner never settles", async () => {
  const files = { "w.tsx": `await new Promise(() => {});\nexport default () => null;` };
  const r = pack({ ...drafts[0], files, entry: "w.tsx" }, options);
  console.log("P4 pack ok:", r.ok);
  if (!r.ok) return;
  const runner = inProcessRunner();
  const outcome = await Promise.race([
    runner.render(r.value, inputs, { ...options, timeoutMs: 100 }).then(() => "settled"),
    Bun.sleep(1500).then(() => "still pending after 1.5 s (timeoutMs 100)"),
  ]);
  console.log("P4", outcome);
});

test("P5 fileStore: a valid 128-code-point placement id", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lf-probe-"));
  const store = fileStore(dir);
  const id = "配".repeat(128);
  try {
    await store.putPlacement({ id, slot: "s", widget: { id: "a", version: "1" }, params: {} });
    console.log("P5 stored");
  } catch (e) {
    console.log("P5", (e as Error).message ?? e);
  }
});

test("P6 one malformed placement blocks loading every placement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lf-probe-"));
  const store = fileStore(dir);
  await store.putPackage(base);
  await store.putPlacement({ id: "good", slot: "s", widget: { id: base.manifest.id, version: base.manifest.version }, params: inputs.params });
  await mkdir(join(dir, "placements"), { recursive: true });
  await writeFile(join(dir, "placements", "zz.json"), JSON.stringify({ id: "zz" }));
  const r = await loadPlacement(store, "good", { catalog, capabilities });
  console.log("P6 load good ->", JSON.stringify(r).slice(0, 160));
});
```
