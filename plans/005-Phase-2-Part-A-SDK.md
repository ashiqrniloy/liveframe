# Phase 2 Part A: The SDK

## Objectives

- Ship `@arnilo/liveframe/sdk`: the JSX runtime, primitive tags, the `state.set` / `action` intent helpers and `render()`.
- `render()` runs a widget and builds a tree with key-path ids. It validates in the same pass, using Phase 1's compiled per-node checks, and returns every spec §7.2 error kind, bounded.
- Ship the `liveframe` CLI's `gen` command. It writes one typed component per catalog definition, and `--check` fails `bun run check` when the output drifts.
- Hold the render budget: **≤ 3 µs per node through `render()`**. That is 2 ms on the 679-node agent-home selection tree, and core-queue medium…full under 2 ms each.

## Expected Outcome

- `@arnilo/liveframe/sdk` exports `jsx`, `jsxs`, `Fragment`, `primitive`, `state`, `action`, `render` and their types. `/sdk/jsx-runtime` and `/sdk/jsx-dev-runtime` exist.
- A widget written in TSX renders in Bun to a tree that `validateTree` accepts. The runtime imports no host API.
- `render()` is deterministic: the same widget and inputs give a byte-identical tree. Input data is checked once per resolution, not on every render.
- `liveframe gen <catalog.json> --out <file>` writes a typed component module. `liveframe gen … --check` runs inside `bun run check` against the proof catalog fixture.
- The four proof UIs (agent-home with its composed components, core-queue, git-status and rack-module) are ported to the SDK as test fixtures, with new-format manifests and named scenarios.
- `bench/render.bench.ts` reports µs per node through `render()` and exits non-zero above 3 µs per node.
- `docs/sdk.md` is written for outsiders. The skill's `sdk.md` and `architecture.md` "Today" sections name what shipped.

This plan implements roadmap Phase 2 Part A: spec §7.1 (widget rules), §7.2 (the SDK), the intent rules of §8 and the build half of §10's single pass. It depends on plans 003 and 004. It uses their formats, `compileValidator`, `checkNode`, `validateTree` and the proof fixtures in `src/__tests__/fixtures/proof/`.

Task 1 records the contracts the owner approved on 2026-10-22, in answer to four questions asked while this plan was written, and writes them into the spec:
- `gen` writes a typed module that widgets import by relative path;
- `render()` takes a compiled validator and returns a bounded `Result`;
- the reference runners load package code with `import()` of a `data:` URL;
- `/pack` depends on sucrase and acorn.

**Not in this plan:** `pack()`, packages, scenarios as a stored format, the store, and the runners. Those are `plans/006-Phase-2-Part-B-Packages-Storage-Runners.md`. CSS projection and the renderer are Phases 3 and 4. Visual parity of the ported widgets needs the Phase 3 projection and stays in the backlog.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:**
  - `src/sdk/` is the `/sdk` subpath and is host-API-free. The existing `src_is_host_api_free` scan already covers it.
  - The CLI lives in `src/cli/` and may read and write files. Task 6 exempts it from the scan explicitly.
  - Shared structural checks stay in `src/validate/`.
- **Four laws:**
  - Law 1 is untouched: `render()` runs on the backend, and nothing here ships to a browser.
  - Law 2 is the subject. Every tree `render()` returns passes the compiled checks.
  - Law 3: style props are checked against the vocabulary, and a string `className` or `style` is rejected.
  - Law 4: every intent is checked against the manifest and capabilities while the tree is built.
- **Primitives only:** the SDK knows no kinds. Components come from the app's catalog through `gen`. The ported proof widgets are test fixtures under `src/__tests__/`, never exports.
- **Dependencies:** no new runtime dependency.
- **Reference hosts:** Synapta's SDK uses positional ids and a generated module inside its own SDK package. Liveframe uses key paths and a generated module in the app. Gaps are recorded, not accommodated.
- **Callers:** nothing outside this plan calls the new code. Task 2 changes `compileTree` internals; `graft callers compileTree --depth all` is run there.

## Tasks

- [x] Task 1: Record the Phase 2 contract decisions and write them into the spec
  - Acceptance Criteria:
    - Functional:
      - A decision log `decision-logs/2026-10-22-<HHMM>-phase-2-sdk-and-package-contracts.md` records the four decisions, the alternatives offered and the approval evidence (the owner's answers on 2026-10-22).
      - **Components.** `liveframe gen <catalog> --out <file>` writes a typed TypeScript module, not a `.d.ts`. Each primitive is bound with `primitive("<kind>")` from the SDK. A widget imports that module by relative path, and `pack()` bundles it like a composed component.
      - **Render contract.**
        - The signature is `render(widget, inputs, { validator, surfaceId, revision, limits?, maxErrors? })`, where `validator` comes from `compileValidator`.
        - It returns `Result<UiTree>`. Failures are a bounded `WidgetError[]` (default 20); each is a `LiveframeError` whose `kind` is a §7.2 kind.
        - Input errors use `invalid-prop`, with a pointer into the inputs (`/state/filter`) and no `nodeId`.
        - `pack`, `verifyPackage` and `loadPlacement` take `{ catalog, capabilities }`.
        - `Runner.render` takes `{ catalog, capabilities, surfaceId, revision, limits?, timeoutMs? }`.
      - **Loading.**
        - The reference runners load `code` with `import()` of a `data:` URL. The bare SDK import resolves to the host's installed SDK.
        - Only the `/preview` loader may contain `import(`, and the scan names that exception.
        - A host whose sandbox cannot do this supplies its own `Runner`.
      - **Transpiler.** `/pack` depends on `sucrase` (TS/JSX) and `acorn` (import/export analysis for linking). Both are pure JavaScript with no WebAssembly. Plan 006 Task 4 adds and justifies them.
      - `docs/spec.md` changes in this same task:
        - §7.1: the example imports components from `./ui.gen`.
        - §7.2: the gen output and the `render` signature, with its `Result` and `WidgetError`.
        - §7.3 and §7.4: the `{ catalog, capabilities }` arguments. Scenario data is then always checked against the capabilities' source `result` schemas, replacing "when the app supplies them".
        - §7.5: the `Runner.render` options, the loader note under the reference runners, and `createPreview({ catalog, capabilities, runner, styles })` in place of `sourceSchemas?`.
        - §13: the CLI line.
        - §14: "generated `.d.ts`" becomes "generated typed component modules".
      - `docs/model.md` step A3 names the generated module.
    - Performance: n/a — documentation only.
    - Code Quality: the spec states each rule once, and the other sections link to it.
    - Security: law 4 wording is unchanged. The loader exception is limited to one file, so the scan still fails closed everywhere else.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the approval already exists, so write the log with that evidence.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - None. The library facts are recorded in plan 006 Task 4.
    - Documentation Reviewed:
      - Spec §7.1–§7.5, §10, §13, §14.
      - `src/formats/manifest.ts:83`: `validateManifest` needs `{ catalog, capabilities }`.
      - `src/validate/compile.ts:19`: `compileValidator`.
      - `proof/runtime/index.ts`: primitives bound from a fixed catalog.
      - Synapta `scripts/widgets/gen-sdk.ts`: its generated module lives inside its SDK package.
      - Spike, 2026-10-22, Bun 1.4.2: a `data:` URL `import()` resolved a bare package import in-process and inside a `Worker`.
    - Options Considered:
      - `.d.ts` plus a pack-time import rewrite — rejected by the owner: an unpacked widget can't run, and pack depends on a rewrite.
      - Passing documents to `render()` and caching the compile by identity — rejected: the caching would be hidden.
      - A single `WidgetError` — rejected: it breaks §10's "every error, up to a bound".
      - A host-supplied `load()` hook — rejected: every host and every test would need a loader.
      - `@babel/standalone` — rejected: about 6.5 MB.
      - sucrase alone — rejected: import detection would depend on its output shape.
    - Chosen Approach:
      - The owner's four answers, written once in the decision log and applied to the spec in the same change.
    - API Notes and Examples:
      ```ts
      import { Stack, Button } from "./ui.gen";                  // written by `liveframe gen`
      import { action, render, state, type WidgetProps } from "@arnilo/liveframe/sdk";
      const result = render(Queue, inputs, { validator, surfaceId: "home", revision: 3 });
      if (!result.ok) result.errors; // WidgetError[], each { kind, pointer, message, expected?, nodeId? }
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-22-<HHMM>-phase-2-sdk-and-package-contracts.md`: new.
      - `docs/spec.md`: §7.1, §7.2, §7.3, §7.4, §7.5, §13, §14.
      - `docs/model.md`: step A3.
  - Test Cases to Write:
    - n/a — documentation only. `bun run check` stays green, and later tasks test each contract.
  - Notes (executed 2026-10-22):
    - New log: `decision-logs/2026-10-22-2330-phase-2-sdk-and-package-contracts.md`. It records the four owner answers, the seven alternatives offered, the approval evidence (the task text above, the only written record of the 2026-10-22 answers) and the Bun 1.4.2 `data:` URL spike. The time in the name is the log's write time; the approval is dated 2026-10-22.
    - `docs/spec.md`: §7.1 imports primitives from `./ui.gen`; §7.2 states the gen output (typed source module, `primitive("<kind>")`, relative import, bundled by `pack()`) and the `render` signature with `Result<UiTree>`, the bounded `WidgetError` list and the `invalid-prop` input pointer; §7.3 `pack`/`verifyPackage` take `{ catalog, capabilities }` and scenario data is always checked against each named source's `result` schema; §7.4 `loadPlacement` takes the pair; §7.5 states the `Runner.render` options, the `data:` URL loader note and `createPreview({ catalog, capabilities, runner, styles })`; §13 names `gen`'s typed module and the single `/preview` `import(` exception; §14 says "generated typed component modules".
    - `docs/model.md`: A3 names `ui.gen.ts` and the relative import. Also updated C4, which still showed the old `{ catalog, actions }` signature and a single `WidgetError`; the plan did not list it, but leaving it would have contradicted the spec in the same page.
    - Left for later tasks by design: `.agents/skills/liveframe-execution/references/{sdk,storage,preview}.md` still describe the pre-contract API. Task 9 rebuilds `sdk.md`; plan 006's closing task rebuilds `storage.md` and the runner half of `preview.md`.
    - `bun run check` green (178 tests).

- [x] Task 2: Share the tree validator's structural checks with a builder
  - Acceptance Criteria:
    - Functional:
      - The checks that today live only inside `compileTree`'s walk (`src/validate/tree.ts:109-246`) move into compiled, reusable pieces in `src/validate/structure.ts`:
        - child placement (a parent's declared child kinds, and the `terms`/`term`/`detail` rule);
        - child counts (min and max per kind);
        - the key-path segment rule (`keyPath`, `src/validate/tree.ts:17`) and segment encoding;
        - JSON value checks with byte counting (plain objects only, acyclic, finite numbers, UTF-8 bytes counted with `stringBytes`).
      - `validateTree` uses these pieces and behaves exactly as before.
      - `CompiledValidator` gains an internal `build` member. It holds the per-kind facts the builder needs: style-prop names, event names, variants, and the child checks. It is not part of the root export's documented surface, and the export test marks it internal.
    - Performance: `bench/validator.bench.ts` still passes ≤ 1.5 µs per node. Record before and after numbers from the same machine; the after number must sit within run-to-run noise (≤ 5%) of the before number.
    - Code Quality:
      - A refactor only: no rule changes and no new error text.
      - One owner per rule, so the builder and `validateTree` can't drift apart.
    - Security: law 2. Every existing failing-case test still fails the same way.
  - Approach:
    - Skills to Use:
      - `safe-refactor` — behaviour preserved, with verification before and after.
      - `liveframe-execution` → `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - None. Read `src/validate/{tree,bytes,checks,compile}.ts`.
    - Documentation Reviewed:
      - Spec §10.
      - `src/validate/compile.ts:84-107`: `checkNode` checks one node and none of its children rules.
      - `src/validate/tree.ts:109-246`: ids, children, limits and bytes.
      - The plan 004 Task 2 approach.
    - Options Considered:
      - The builder emits a finished tree, then `validateTree` re-walks it — rejected: that is the proof's double pass, and it is ≈ 3.2 ms of the measured 5.6 ms (`decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`).
      - Copy the rules into the builder — rejected: two owners per rule would drift.
    - Chosen Approach:
      - Extract the pieces and keep `compileTree` as a thin walk over them. `graft callers compileTree --depth all` before editing.
    - API Notes and Examples:
      ```ts
      // internal
      const s = compileStructure(catalog);
      s.placed(parentKind, childKind, nodeId, sink); // invalid-children on violation
      s.counts(parentKind, kindCounts, nodeId, sink);
      s.jsonBytes(value, remaining, nodeId, sink);    // returns bytes, or fails closed
      ```
    - Files to Create/Edit:
      - `src/validate/structure.ts`: new.
      - `src/validate/tree.ts`: use the shared pieces.
      - `src/validate/compile.ts`: expose the internal `build` facts.
      - `src/__tests__/exports.test.ts`: assert that the internal member is not a documented export.
  - Test Cases to Write:
    - All existing `validator-*.test.ts`, `compiled-schema.test.ts` and `exports.test.ts` tests pass unchanged. They fail if a rule moved incorrectly.
    - `structure_pieces_match_tree_walk`: for every proof tree fixture and every failing-case fixture, the errors from `validateTree` equal those before the refactor (snapshot taken at the start of the task). Fails on any behavioural drift.
  - Notes (executed 2026-10-22):
    - `src/validate/structure.ts` (new) owns four pieces: `keyPath` and `encodeSegment` (no encoder existed in `src/`; the proof used `encodeURIComponent` directly), `compileStructure(catalog)`, `jsonScalarBytes`, and `walkJson`. Failure text for placement and required children is compiled once per kind.
    - `validateTree` is unchanged in behaviour: the same errors, in the same order, with the same pointers and text. `src/__tests__/fixtures/validator-baseline.json` was captured by running `validateTree` over all 40 failing-case rows and the 7 proof trees *before* the edit; `structure_pieces_match_tree_walk` (in `validator-rules.test.ts`, where the rows live) now compares every error array against it.
    - `CompiledValidator` gained `build: { kinds, structure }`. `KindFacts` holds the kind's variants, declared style-prop names, event names and child rules; `KindFacts`/`CompiledBuild` are exported from `src/validate/compile.ts` but not from the root export. `build_facts_are_internal` pins `Object.keys(validator)` to `["build", "checkNode", "validateTree"]` and asserts no root export names them.
    - API differs from the sketch above, for two measured reasons:
      - The three one-rule methods (`placed`, `counts`, `missing`) became one `structure.node(parentKind, childKind, depth, hasChildren, sink)` plus `structure.counts` and `structure.forbidsChildren`, so a valid node costs one call instead of three. Messages reach the caller through `StructureSink.reject(expected, pointer?)`, so nothing is built unless a rule breaks.
      - `s.jsonBytes(...)` cannot be per-value and stay in budget: a per-value scanner cost ~37% per node. `walkJson(value, ctx)` now takes a shared `JsonWalk` (the validator's own `ancestors`, `path` and byte counter), so there is one cycle set and no per-value setup; the caller reads `ctx.bytes` back. Task 4 uses the same pair.
    - Performance, paired runs on the same machine under the same load (`bun bench/validator.bench.ts`):

      | Fixture | Before | After |
      | --- | --- | --- |
      | agent-home (679) | 1.087 µs/node (0.7380 ms) | 1.134 µs/node (0.7698 ms), +4.3% |
      | core-queue.medium (414) | 1.061 | 1.112 |
      | core-queue.large (446) | 1.150 | 1.242 |
      | core-queue.full (473) | 1.171 | 1.251 |
      | core-queue.small (5) | 1.096 | 1.294 |

      The generic control moved from 0.719 to 0.672 µs/node in the same pair, so run-to-run variance is larger than the delta. Every size passes the ≤ 1.5 µs/node gate, and agent-home's equal-work props check rose to 13.3×. Small (5 nodes) pays the one-per-validate `JsonWalk` setup across few nodes; still under the gate.
    - `graft callers compileTree --depth all` before editing: only `src/validate/compile.ts` and two tests import it; `compileTree` keeps its two-argument form with the structure defaulted.
    - `bun run check` green (180 tests).

- [x] Task 3: Add the JSX runtime, primitive tags and intent helpers
  - Acceptance Criteria:
    - Functional:
      - `jsx`, `jsxs`, `Fragment` and `jsxDEV` return frozen elements: instances of an SDK-private class with `type`, `props` and `key`, so `render()` can reject look-alike objects.
      - `primitive<Props>(kind)` returns a frozen tag that `jsx` turns into a primitive element. A function `type` is recorded as a composed component and is never called by `jsx`, because components expand inside `render()`. A string `type` is kept so `render()` can report `host-element`.
      - `state.set(key, value?)` returns frozen `{ type: "setState", key, value? }`.
      - `action(name, args, { bind }?)` returns frozen `{ type: "action", name, args, bind? }`.
      - Both helpers reject non-JSON values at once, with a `TypeError` that names the key.
      - `WidgetProps<P, S, D, C>` gives readonly, deeply frozen input types.
      - The JSX namespace has no intrinsic elements, so `<div>` fails to compile. `key` is accepted on every element.
      - `package.json` `exports` gains `./sdk`, `./sdk/jsx-runtime` and `./sdk/jsx-dev-runtime`. `tsconfig.json` sets `"jsx": "react-jsx"` so TSX tests typecheck with `/** @jsxImportSource @arnilo/liveframe/sdk */`.
    - Performance: creating one element allocates a single frozen object, with no per-element `WeakSet`. The proof's `elements` `WeakSet` (`proof/runtime/jsx-runtime.ts:3`) is replaced by a class check.
    - Code Quality:
      - Host-API-free.
      - Intents are plain frozen data; nothing brands them. `render()` tells events apart by the definition's event names, not by the value.
    - Security:
      - Law 4: intents carry no authority, only names and JSON args.
      - Law 1 is untouched.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/sdk.md`.
      - `typescript-advanced-types` — the JSX namespace and `WidgetProps`.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - TypeScript 7.0 JSX handbook: `jsx: react-jsx`, `jsxImportSource`, the `JSX` namespace lookup through `<source>/jsx-runtime`, `IntrinsicElements`, `ElementChildrenAttribute`, `IntrinsicAttributes`. Use `find-docs`; Context7 was over quota when this plan was drafted, so check at execution.
    - Documentation Reviewed:
      - Spec §7.1, §7.2, §8, §9.
      - `proof/runtime/{jsx-runtime,intents,types}.ts`, the shapes being replaced.
      - `src/formats/tree.ts`: the `Intent` type.
    - Options Considered:
      - Brand elements with a `WeakSet` as the proof does — rejected: it adds a hash insert per element, and a private class gives the same check with `instanceof`.
      - Expand composed components inside `jsx` — rejected: a component could then run before `render()` set up its limits.
    - Chosen Approach:
      - A minimal runtime: a private element class, primitive tags and frozen intents, matching the proof's behaviour with less work per element.
    - API Notes and Examples:
      ```tsx
      /** @jsxImportSource @arnilo/liveframe/sdk */
      import { action, primitive, state } from "@arnilo/liveframe/sdk";
      const Button = primitive<{ label: string; onPress?: Intent }>("button");
      <Button key="claim" label="Claim" onPress={action("tasks.claim", { id: "t1" })} />;
      state.set("filter"); // { type: "setState", key: "filter" }, frozen
      ```
    - Files to Create/Edit:
      - `src/sdk/element.ts`: new (element class, `primitive`).
      - `src/sdk/jsx-runtime.ts`, `src/sdk/jsx-dev-runtime.ts`, `src/sdk/intents.ts`, `src/sdk/types.ts`, `src/sdk/index.ts`: new.
      - `package.json`: `exports`.
      - `tsconfig.json`: `jsx`.
      - `src/__tests__/sdk-jsx.test.tsx`, `src/__tests__/sdk-types.test.tsx`: new.
  - Test Cases to Write:
    - `elements_and_intents_are_frozen`: writing to an element, its props, its children array or an intent throws. Fails if a freeze is dropped.
    - `intent_helpers_reject_non_json`: `state.set("k", () => 1)`, `action("a", { x: new Date() })` and `action("a", { x: Number.NaN })` each throw naming the key. Fails if bad data reaches the tree.
    - `jsx_does_not_call_components`: a spy component is not called by `jsx`. Fails if expansion happens early.
    - `host_elements_fail_to_compile` (type test): `// @ts-expect-error` on `<div />`, and on a wrong prop type for a `primitive<…>` tag. Fails if the JSX namespace allows intrinsics.
  - Notes (executed 2026-10-22):
    - Files: `src/sdk/{element,types,intents,index,jsx-runtime,jsx-dev-runtime}.ts` (all new), `package.json` (`./sdk`, `./sdk/jsx-runtime`, `./sdk/jsx-dev-runtime`), `tsconfig.json` (`"jsx": "react-jsx"`), `src/__tests__/sdk-{jsx,types}.test.tsx`.
    - Element shape is the proof's, with the WeakSet replaced: a private `Element` class, so `isElement` is `instanceof` (one allocation per element, no hash insert). `element.type` is one of three things, which is how `render()` tells them apart: a frozen `{ kind }` record for a primitive, the component function for a composed component, the tag string for a host element.
    - A primitive tag is a frozen function carrying the frozen `{ kind }` record under a module-private `Symbol`, so `jsx` resolves a tag with one property read and no `WeakMap`. The tag calls through to `jsx` if an author calls it directly.
    - `jsx`/`jsxs`/`jsxDEV` freeze the element, its props and its `children` array, and strip `props.key` into the element's `key` (an explicit third argument wins). Nested props stay unfrozen as in the proof; intents are deep-frozen because they are the whole value.
    - Intents: `state.set(key, value?)` reports a bad value at the key's path (`k`, `k.x`), `action(name, args, { bind }?)` at `args.x`. Rejections are `TypeError`s: functions, promises, non-finite numbers, class instances, cycles, and nesting past 128. `action`'s `bind` is checked as a bounded name and kept as a plain field.
    - `src/sdk/index.ts` exports `primitive`, `action`, `state` and the types `Component`, `Element`, `DeepReadonly`, `Intent`, `Json`, `WidgetProps`. `isElement`/`createElement` stay internal for Task 4; Task 9 pins the final export list.
    - Self-referencing imports work in both Bun and `tsc`: the tests import `@arnilo/liveframe/sdk` and `@arnilo/liveframe/sdk/jsx-dev-runtime` and set the JSX source per file with `/** @jsxImportSource @arnilo/liveframe/sdk */`. `IntrinsicElements` is empty, so `<div />` and a wrong `primitive<Props>` prop each fail to compile (`@ts-expect-error` in `sdk-types.test.tsx` proves it).
    - `bun run check` green (187 tests).

- [x] Task 4: Build and validate in one pass with `render()`
  - Acceptance Criteria:
    - Functional:
      - `render(widget, inputs, { validator, surfaceId, revision, limits?, maxErrors? })` follows the Task 1 contract.
      - It calls the widget once and expands composed components and fragments. Arrays, `null`, `undefined` and booleans are handled as the proof does (`proof/runtime/render.ts:20-130`).
      - It splits each element's props by the kind's definition: `variant`, declared style props into `style`, declared events into `events`, and the rest into `props`.
      - It assigns key-path ids. The root is `root`. Each segment is the element's `key`, or else its kind, encoded by Task 2's rule. A fragment adds no segment.
      - It calls `checkNode` and the Task 2 structural pieces as each node is emitted. Nodes, depth and bytes are counted during the build.
      - Each spec §7.2 kind is produced:

        | Kind | Raised when |
        | --- | --- |
        | `host-element` | a string type |
        | `unknown-component` | a tag whose kind isn't in the catalog, or a component that returns a non-element |
        | `invalid-prop` | from `checkNode`, or a string `className`/`style` |
        | `invalid-children` | from the structure checks, a non-element child, or a root that is not exactly one element |
        | `missing-key` | a list item without a key, or unkeyed siblings of the same kind |
        | `duplicate-key` | two siblings with the same key |
        | `undeclared-event` | from `checkNode` |
        | `undeclared-action` | from `checkNode` |
        | `function-prop` | a function prop value anywhere other than a component's own JSX-free props |
        | `async-render` | a promise, thenable or async function result |
        | `render-failed` | the widget throws; the message keeps the thrown message, never the stack |
        | `limit-exceeded` | nodes, depth, bytes or component expansion over budget |

      - Errors are collected up to `maxErrors`, with the bound marker that `validateTree` uses.
      - Every tree `render()` returns passes `validator.validateTree`.
    - Performance: no second walk over the finished tree. The full budget is measured in Task 8; this task must not call `validateTree` on its own output, except in tests.
    - Code Quality:
      - One recursive builder in `src/sdk/render.ts`.
      - Plain objects for the emitted nodes, with fields in the spec §9 order.
      - Optional fields only when present.
    - Security:
      - Law 2: no tree leaves `render()` without per-node and structural checks.
      - Law 3: string `className` and `style`, and undeclared style props, are rejected.
      - Law 4: an intent outside the manifest or capabilities is rejected.
      - Each rejection has a test.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/sdk.md`.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - None. Read `proof/runtime/render.ts` and `src/validate/`.
    - Documentation Reviewed:
      - Spec §7.1, §7.2, §9, §10.
      - `proof/runtime/render.ts:19-153`: the proof builder, which throws one error and re-validates.
      - `src/validate/compile.ts:84-107` and the Task 2 pieces.
      - `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`.
    - Options Considered:
      - Throw on the first error as the proof does — rejected by Task 1, because §10 bounds a list.
      - Build first, then call `validateTree` — rejected in Task 2.
    - Chosen Approach:
      - One builder that emits fresh nodes and validates each one as it is emitted, sharing the sink and limits with the structure pieces.
    - API Notes and Examples:
      ```ts
      const validator = compileValidator({ catalog, capabilities, manifest });
      const r = render(AgentHome, inputs, { validator, surfaceId: "agent-home", revision: 1 });
      // r.ok ? r.value.root.id === "root" : r.errors[0].kind
      ```
    - Files to Create/Edit:
      - `src/sdk/render.ts`: new.
      - `src/sdk/index.ts`: export `render`.
      - `src/__tests__/sdk-render.test.tsx`: new, using the proof catalog, capabilities and agent-home manifest fixtures.
  - Test Cases to Write:
    - `render_error_kinds` with 12 cases, one per §7.2 kind. Each asserts `kind`, `nodeId` and `pointer`, and fails if that kind is missing or misattributed.
    - `ids_are_key_paths`: keyed rows give `root/…/row:4812/claim`; reordering rows keeps every id; a fragment adds no segment. Fails on positional ids.
    - `errors_are_bounded`: a widget with 30 bad props returns 20 errors plus the bound marker. Fails if collection is unbounded or stops at one.
    - `rendered_trees_pass_validate_tree`: every output from these tests is accepted by `validateTree`. Fails if the builder and the validator disagree.
    - `class_name_and_style_strings_rejected`: law 3.
  - Notes (executed 2026-10-22):
    - Files: `src/sdk/render.ts` (new), `src/sdk/index.ts` (exports `render`), `src/errors.ts` (`DEFAULT_MAX_ERRORS` and `addBoundMarker`, now shared with the tree walker), `src/validate/tree.ts` (exports `DEFAULT_LIMITS`, uses both), `src/validate/compile.ts` (`build.catalogId`), `src/validate/structure.ts` (`encodeSegment` keeps `:` readable), `src/__tests__/sdk-render.test.tsx` (new).
    - One builder over the compiled validator: `checkNode` per emitted node, `structure.node`/`counts`/`forbidsChildren` for child rules, `walkJson` for each props/style/events value, `encodeSegment` for ids. No second walk; only tests call `validateTree` on the output.
    - Byte accounting matches `validateTree` exactly: the tree prefix is counted field by field, each node by walking its skeleton (without `children`), then `,"children":[`, the child separators and `]` are added and `}` closes. `rendered_trees_pass_validate_tree` renders three trees (one with unicode keys and values) and asserts `limits.bytes` equal to `Buffer.byteLength(JSON.stringify(tree))` passes, one less fails, and `validateTree` agrees on both. That test is the drift alarm for both counters.
    - Error pointers are node-id paths (`/root/stack/row:4812/props/label`), not child indices: a fragment has no index in the tree, and ids are stable across reorders. Unattributed failures (a thrown widget, a non-element root, bad options) point at the document root.
    - All 12 §7.2 kinds are produced and tested in one table, each asserting its kind plus a `nodeId` and `pointer`; the same test pins that a thrown `boom` reaches `message` unchanged. The widget runs exactly once, and a fragment that yields two roots is `invalid-children`.
    - Limits enforced while building: nodes, depth (root is level 1), bytes, component expansions, and nested child arrays. A cyclic children array hits the nesting guard instead of the stack.
    - Deviation: top-level function and promise prop values are classified as `function-prop`/`async-render` for primitives and composed components alike; a function nested *inside* a JSON object reaches the node as `invalid-prop`. The value is still rejected before it leaves `render()`, only the kind differs, because the shared byte walker has a single failure kind. Revisit if a caller needs the nested kind.
    - `encodeSegment` changed: `encodeURIComponent` escaped `:` to `%3A`, which contradicted the spec's `row:4812` example and the key-path grammar. One `replaceAll("%3A", ":")` keeps the colon readable; `/`, spaces and CJK still encode.
    - `bun run check` green (194 tests).

- [ ] Task 5: Check inputs once per resolution, and prove `render()` deterministic
  - Acceptance Criteria:
    - Functional:
      - `compileValidator` also compiles:
        - the manifest's `params`, `state` and `context` schemas;
        - for each manifest data key, its capability source's `result` schema.
      - `render()` checks `params`, `state` and `context` on each call. These are small and change per re-run.
      - It checks `data` and deep-freezes it only when that exact data object hasn't been checked before (a `WeakSet` of checked data objects). A host that re-runs with the same resolved data skips the walk.
      - Failures are `invalid-prop` with input pointers, as Task 1 decided.
      - All four inputs reach the widget frozen.
      - The same widget, inputs and options give byte-identical `JSON.stringify` output across runs and across fresh validators.
    - Performance: a re-render with unchanged data does no data walk. A test asserts this with a getter spy that counts reads during checking.
    - Code Quality:
      - The check-once cache is a module-private `WeakSet`, with no public API.
      - Frozen inputs are never copied.
    - Security: law 2 for inputs. Mutated data can't slip through, because frozen data can't be mutated, and new data is a new object that gets checked.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §7.1 (frozen inputs) and §8 (re-runs are cacheable).
      - `proof/runtime/data.ts`: `assertJson` and `freeze` on every render, 0.19 ms per render in the 1540 measurement.
      - `src/formats/capabilities.ts`: source `result` schemas.
    - Options Considered:
      - A public `prepareInputs()` API — rejected: it would add an API to learn, and identity caching gives the same result with nothing new.
      - Check data on every render — rejected: the roadmap requires once per resolution.
    - Chosen Approach:
      - Compile the input schemas with the validator, and cache checked data by object identity.
    - API Notes and Examples:
      ```ts
      const data = await host.resolve(manifest.sources, inputs); // one resolution
      render(W, { params, state: s1, data, context }, opts);      // checks data, freezes it
      render(W, { params, state: s2, data, context }, opts);      // same data: no data walk
      ```
    - Files to Create/Edit:
      - `src/validate/compile.ts`: compile the input checks.
      - `src/sdk/render.ts`: check and freeze inputs.
      - `src/__tests__/sdk-inputs.test.tsx`: new.
  - Test Cases to Write:
    - `inputs_fail_their_schemas`: a bad state field, a missing param, bad context and data that violates a source's result schema each give `invalid-prop` with the right pointer.
    - `data_checked_once_per_object`: the second render with the same data object reads no data properties during checking; a new data object is checked again. Fails if the cache is missing or keyed wrongly.
    - `inputs_reach_widget_frozen`: the widget's attempt to mutate any input throws.
    - `render_is_deterministic`: 100 renders across two fresh validators give one distinct serialised string. Fails if order or ids depend on anything but the inputs.
  - Notes (executed <date>):

- [ ] Task 6: Generate typed component modules with `liveframe gen` and check drift
  - Acceptance Criteria:
    - Functional:
      - `generate(catalog): string` in `src/sdk/gen.ts` is host-API-free and deterministic. It emits one module that:
        - imports `primitive` (and types) from `@arnilo/liveframe/sdk`;
        - exports one `PascalCase` component per definition, bound with `primitive<Props>("<kind>")`.
      - The generated props:
        - are readonly and derived from the definition's schema language (strings, enums as literal unions, numbers, booleans, arrays and objects);
        - include `variant` as a union of the definition's variants;
        - include each declared style prop, typed from the vocabulary's declared names (`space.*`, `size.*`, `radius.*`, roles, breakpoints for responsive values);
        - make each declared event an optional event prop typed as the intents its `carries` allows;
        - have no `children` prop when children are `none`;
        - carry the definition's description as a doc comment.
      - The `liveframe` CLI (`src/cli/liveframe.ts`, `package.json` `bin`):
        - `gen <catalog.json> --out <file>` validates the catalog first and writes the file.
        - `--check` exits non-zero with a diff summary when the file differs.
        - A malformed catalog prints the `LiveframeError`s and exits 2.
      - The generated module for the proof catalog is committed at `src/__tests__/fixtures/widgets/ui.gen.ts`.
      - `package.json` gains `"gen:check": "bun src/cli/liveframe.ts gen src/__tests__/fixtures/proof/catalog.json --out src/__tests__/fixtures/widgets/ui.gen.ts --check"`, and `check` runs it.
      - The generated file passes `biome format` as emitted.
    - Performance: n/a — build time only.
    - Code Quality:
      - The emitter lives in `/sdk` and the file I/O in the CLI.
      - `src_is_host_api_free` exempts exactly `src/cli/`. The exemption is written in the test with its reason.
    - Security: law 3 at compile time. `gap="13px"` fails to compile against the generated types.
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types` — emitted prop and event types.
      - `liveframe-execution` → `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 `Bun.file` / `Bun.write` and `process.argv` for the CLI (`node_modules/bun-types/docs/runtime/`).
      - `find-docs` for Biome 2.6 formatting of generated code.
    - Documentation Reviewed:
      - Spec §7.2, §13.
      - Synapta `scripts/widgets/gen-sdk.ts` (`tsType`, doc escaping, `--check`).
      - `proof/runtime/index.ts`: the type-level binding from catalog literals.
      - `src/formats/catalog.ts:47-60`.
    - Options Considered:
      - Type-level only, inferring from `defineComponent` literals — rejected: a catalog arrives as JSON at runtime, so an app needs emitted source.
      - Emit `.d.ts` — superseded by the Task 1 decision.
    - Chosen Approach:
      - A string emitter over the validated catalog with a fixed emission order, plus a thin Bun CLI.
    - API Notes and Examples:
      ```bash
      liveframe gen catalog.json --out src/widgets/ui.gen.ts
      liveframe gen catalog.json --out src/widgets/ui.gen.ts --check   # exit 1 on drift
      ```
    - Files to Create/Edit:
      - `src/sdk/gen.ts`, `src/cli/liveframe.ts`: new.
      - `src/__tests__/fixtures/widgets/ui.gen.ts`: generated.
      - `package.json`: `bin`, `gen:check` script, and `check`.
      - `src/__tests__/portability.test.ts`: the `src/cli/` exemption.
      - `src/__tests__/sdk-gen.test.ts`, `src/__tests__/sdk-gen-types.test.tsx`: new.
  - Test Cases to Write:
    - `gen_is_deterministic_and_formatted`: two runs are byte-equal, and the output equals the committed fixture. Fails on unstable ordering.
    - `gen_check_detects_drift`: the CLI with `--check` against an edited copy exits 1; against the fixture it exits 0. Fails if drift goes unreported.
    - `gen_rejects_malformed_catalog`: exits 2 and prints a pointed error.
    - `generated_types_reject_wrong_props` (type test): `@ts-expect-error` on `gap="13px"`, an unknown variant, a wrong event intent type, and children on a `none` kind. Fails if typing is loose.
  - Notes (executed <date>):

- [ ] Task 7: Port the proof widgets to the SDK, with manifests and scenarios
  - Acceptance Criteria:
    - Functional:
      - Agent-home (queue plus its composed `task-card`, `queue-row`, `alert-card`, `decision-card` and `facts`), core-queue (with `metric`), git-status and rack-module are copied to `src/__tests__/fixtures/widgets/<name>/`.
      - The copies import `./ui.gen.ts` (or `../ui.gen.ts`) and `@arnilo/liveframe/sdk`, never `proof/`.
      - Proof-only APIs are replaced:
        - the grid track `"fit"` in `queue-row` (`proof/widgets/agent-home/queue-row.tsx:30`) becomes spec-§6.3-valid composition, per the backlog's "Reconcile proof grid tracks" entry;
        - any other proof-only prop found while porting is listed in Notes.
      - New-format manifests, valid under `validateManifest`, exist for core-queue, git-status and rack-module. Agent-home reuses `fixtures/proof/agent-home.manifest.json`.
      - Each widget has a `scenarios.json` of named `{ name, params, context, state?, data }` cases taken from the proof host's fixtures:
        - agent-home: `ready`, `loading`, `empty`, `failed`, `read-only`, `no-alerts`, `no-escalate` (`proof/host/pages.ts:21`);
        - core-queue: `small`, `medium`, `large`, `full`;
        - git-status and rack-module: their host fixtures.
      - Every scenario renders through `render()` to a valid tree.
      - Agent-home `ready` gives 679 nodes. Core-queue sizes match the node counts of `fixtures/proof/core-queue.*.tree.json`.
      - Each rendered tree equals its exported proof tree, except where the `fit` replacement changes the structure. The test names those nodes.
    - Performance: n/a here; Task 8 benches these fixtures.
    - Code Quality: fixtures stay under `src/__tests__/`, never exported. The release exclusion is already in the backlog for Phase 6.
    - Security: n/a — fixtures. Their rendering is law-checked by Task 4's tests.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md` and `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - `proof/widgets/**` (781 lines in total).
      - `proof/widgets/*/manifest.ts`.
      - `proof/host/pages.ts`: the scenarios.
      - `proof/scripts/export-formats.ts:263-267`: the `fit` → `0fr` substitution.
      - The backlog entry "Reconcile proof grid tracks before SDK and CSS integration".
    - Options Considered:
      - Import the proof widgets directly — rejected: `src/` never imports `proof/`, and they target the proof runtime.
      - Keep `0fr` — rejected by the backlog: it proves validity, not look.
    - Chosen Approach:
      - Port by copying with mechanical import changes, plus one composition change for `fit`.
      - Visual parity of that change needs the Phase 3 CSS projection. Keep the backlog entry open for that and record it in Further Actions.
    - API Notes and Examples:
      ```ts
      // src/__tests__/fixtures/widgets/agent-home/scenarios.json
      [{ "name": "ready", "params": {}, "context": { "size": "full" }, "data": { "queue": { … } } }]
      ```
    - Files to Create/Edit:
      - `src/__tests__/fixtures/widgets/{agent-home,core-queue,git-status,rack-module}/**`: new.
      - `src/__tests__/fixtures/proof/{core-queue,git-status,rack-module}.manifest.json`: new (tentative path, matching the agent-home manifest).
      - `src/__tests__/sdk-proof-widgets.test.ts`: new.
      - `plans/backlog.md`: update the grid-track entry's status.
  - Test Cases to Write:
    - `proof_scenarios_render`: every scenario of every widget renders to a tree that `validateTree` accepts. Fails on any porting error.
    - `proof_node_counts_hold`: agent-home `ready` is 679 nodes, and core-queue sizes match the fixtures. Fails if the port changes the benchmark's shape.
    - `proof_trees_match_exports`: structural equality with `fixtures/proof/*.tree.json`, except for the listed `fit` nodes.
    - `ported_manifests_validate`.
  - Notes (executed <date>):

- [ ] Task 8: Hold 3 µs per node through `render()`
  - Acceptance Criteria:
    - Functional:
      - `bench/render.bench.ts` runs the Task 7 widgets through `render()`:
        - agent-home: the 50-row selection re-render at 679 nodes (the `proof/tests/agent-home.bench.ts` workload);
        - core-queue: small, medium, large and full (`proof/tests/core-queue.bench.ts`);
        - clay: git-status and rack-module (`proof/tests/clay.bench.ts`);
        - the runtime micro-workloads of `proof/tests/runtime.bench.ts`.
      - It uses 200 warm-ups and 1,000 runs. It prints Bun, OS, CPU and load as `bench/validator.bench.ts` does.
      - It reports total ms, µs per node and the validator's share.
      - It exits non-zero when agent-home is above 2 ms (≈ 3 µs per node), or any core-queue size medium…full is above 2 ms.
      - `package.json` `bench` runs both benches.
    - Performance:
      - ≤ 3 µs per node in total.
      - Report the split against the reserved ≤ 1.5 µs validation / ≤ 1.5 µs other.
      - If it misses, profile before optimising, and remove only measured redundant work (the 1540 decision's route).
    - Code Quality: the bench imports only `src/` and its fixtures, never `proof/runtime`.
    - Security: n/a — measurement.
  - Approach:
    - Skills to Use:
      - `investigate-first` if the gate misses.
      - `liveframe-execution` → `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - None. Follow `bench/validator.bench.ts`.
    - Documentation Reviewed:
      - `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`.
      - `plans/evidence/004-impact-analysis.md`: validator at 1.231 µs/node.
      - The backlog's "Phase 1 performance gate" entry.
    - Options Considered:
      - Run the historical proof benches unchanged — rejected: they measure `proof/runtime`.
    - Chosen Approach:
      - Equivalent workloads on the new SDK, gated in the bench script.
    - API Notes and Examples:
      ```bash
      timeout 300s bun bench/render.bench.ts
      ```
    - Files to Create/Edit:
      - `bench/render.bench.ts`: new.
      - `package.json`: `bench`.
      - `src/__tests__/sdk-smoke.test.ts`: a loose regression guard, under 10 µs per node on agent-home, so `bun run check` catches a gross regression without timing flakiness.
      - `plans/backlog.md`: close or update the P1 gate entry with the numbers.
  - Test Cases to Write:
    - `render_smoke_budget`: the loose guard above. Fails on an order-of-magnitude regression.
    - The bench itself is the gate. Record its full output in Notes.
  - Notes (executed <date>):

- [ ] Task 9: Publish the SDK surface and its documentation
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/exports.test.ts` asserts the exact `/sdk`, `/sdk/jsx-runtime` and `/sdk/jsx-dev-runtime` export lists, and their type exports.
      - The portability test bundles `src/sdk/index.ts` and `src/sdk/jsx-runtime.ts` for `target: "browser"` and scans them.
      - `docs/sdk.md` explains, for outsiders: writing a widget, `gen`, intents, `render()` and its errors (with an example of each kind), ids, determinism and the input-check cache.
      - `README.md` links it.
      - `.claude/skills/liveframe-execution/references/sdk.md` and `references/architecture.md` "Today" name the shipped API and files.
    - Performance: n/a.
    - Code Quality: the docs match the code; every example in `docs/sdk.md` is exercised by a test or the fixtures.
    - Security: the docs state laws 1–4 as they apply to authors.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - `docs/formats.md` (style).
      - Plan 004 Task 6 (the same task for the validator).
    - Options Considered:
      - Docs in the spec only — rejected: the spec is normative, not a guide.
    - Chosen Approach:
      - One guide page, plus the skill "Today" sections.
    - API Notes and Examples:
      ```ts
      import * as sdk from "@arnilo/liveframe/sdk";
      ```
    - Files to Create/Edit:
      - `docs/sdk.md`: new.
      - `README.md`.
      - `src/__tests__/exports.test.ts`, `src/__tests__/portability.test.ts`.
      - `.claude/skills/liveframe-execution/references/{sdk,architecture}.md`.
  - Test Cases to Write:
    - `sdk_export_surface`: exact export lists. Fails on an accidental export.
    - `sdk_bundles_for_browser_without_host_apis`: the scan of the bundled SDK.
  - Notes (executed <date>):

- [ ] Task 10: Analyze architectural impact and dispose of every finding
  - Sweep the twelve impact areas of `.agents/skills/create-plan/references/liveframe.md` §5 against what was delivered. Record each, or `None — <reason>`, in `plans/evidence/005-impact-analysis.md`.
  - List every finding, present them to the owner in one table with a recommended disposition (`execute` or `backlog`), and record the answer.
  - `execute`: add a task above this one and do it. `backlog`: add the item to `plans/backlog.md` and list it under Further Actions.
  - Known areas to confirm:
    - Synapta's positional ids and in-SDK generated module are reference-host gaps.
    - Visual parity of the `fit` replacement is Phase 3.
    - Plan 006 consumes the Task 1 contracts unchanged.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 600s bun run check` (typecheck, lint, format, tests, `gen:check`)
- `timeout 300s bun bench/validator.bench.ts`
- `timeout 300s bun bench/render.bench.ts`
- `timeout 60s bun src/cli/liveframe.ts gen src/__tests__/fixtures/proof/catalog.json --out src/__tests__/fixtures/widgets/ui.gen.ts --check`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
