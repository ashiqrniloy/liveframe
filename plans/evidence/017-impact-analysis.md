# Plan 017 — architectural impact analysis

Reviewed 2026-10-29 against delivered Tasks 1–7 (`0a2144f`, `0b61261`, `caa55fa`,
`9a712ea`, `361c1fc`, `580d7a8`, `03074e2`), spec §6.4, §7.2, §7.5, §8, §11 and §13,
the accepted [renderer and preview host contracts](../../decision-logs/2026-10-28-1756-renderer-and-preview-host-integration.md)
and [explicit `checkOffered` validator](../../decision-logs/2026-10-28-1935-check-offered-explicit-validator.md),
and all twelve impact areas in `.agents/skills/liveframe-execution/SKILL.md` and the
plan reference §5.

## Impact areas

1. **Spec.** §6.4 (the host-set `data-lf-transparency` attribute, its base-sheet
   forcing, the design-system attribute block and the switching sequence), §7.2
   (generated implementation definitions), §7.5 (`resultScenario`, controlled and
   keyed selection modes, published preview attributes, capture through `<urlKey>`),
   §8 (origin and offered-intent check), §11 (`transparency`, `wrapperProps`,
   `portalProps`, `events` metadata, `<Surface confirm>`, the fixed portal) and §13
   (the `--implementations` CLI form and the MCP tool set) describe what shipped. One
   mismatch remains: F1.

2. **Public API and formats.** No subpath, runtime dependency or schema version
   changed. Additions inside the existing identifiers:
   - root: `checkOffered` and the `IntentOrigin` type; `src/validate/complete.ts` is
     internal and shared by the renderer and the check;
   - `/react`: `SurfaceProps.{wrapperProps, portalProps, confirm, transparency}`,
     `ImplementationProps.events` and `Item.events` (required on an exported context
     type the renderer builds — additive for readers, a break only for code that
     constructs one by hand, which no host path does);
   - `/preview`: the `IntentOrigin` re-export; `/preview/react`: `resultScenario`
     (required, the registered 0.2.0 break), `selection` and `urlKey`;
   - `/sdk`: unchanged. `generateDefinitions` stays internal, like `generate` today
     (plan 018 Task 2 exports the subpath; F6);
   - formats: capabilities actions gain optional `irreversible` (additive), and
     `schemas/capabilities.json` was regenerated with it. `docs/compatibility.md`'s
     existing "optional fields may be added" covers it;
   - capture: `data-lf-preview` gains `urlKey`/`controlled`, reusing the existing
     `not-found` `CaptureError` kind. No new kind anywhere, so the closed
     `LiveframeError` union and its schema are untouched.

3. **The four laws.**
   - Law 1: `wrapperProps` and `portalProps` are host-only props on `<Surface>`; the
     renderer never reads them from a tree, and the preview still receives trees
     only. The generated definitions module is app-side data with a type-only import;
     it is never bundled into a widget's package.
   - Law 2: `checkOffered` fails closed — a tree that is not the served one, an
     unknown node or event, a changed literal, a marker that should have been
     removed, an unknown validator and a mutated tree all reject with a typed error
     and pointer. The only new install-time input is the optional
     `irreversible` boolean, validated with the rest of the capability action.
   - Law 3: no colour or CSS is authored. The only new CSS text is the
     reduced-transparency forcing rule and the re-scoped recovery block; both name
     theme role references, never a literal or system colour.
   - Law 4 — re-checked for this task: every path that reaches `onIntent` passes
     through `complete(intent, value)` first (`src/react/renderer.tsx:282` produces
     the intent handed to `raiseIntent` at `:222`/`:238`; there is no second call
     site). `origin` is built from the accepted tree, never from props, and
     `checkOffered` is the host-side check. `<Surface confirm>` is UI convenience
     gated on `confirm` only; `irreversible` is presentation, and both §11 and
     `docs/renderer.md` say the host still authorises on dispatch. `events` metadata
     exposes no action name, argument, host `meta` or authority — `offered.test.ts`'s
     `events_type_keyed_by_definition` and the renderer tests pin that.

4. **Validation.** The offered-intent check runs in a fixed order with existing
   kinds: surface and revision (`version-conflict`), node (`not-found`), event
   (`undeclared-event`), then the candidate against the compiled intent schema
   (`invalid-prop`), completion equality (`invalid-prop` at the first differing
   pointer) and the filled value against the event and state schemas. An explicit
   `setState` value is checked against the manifest state schema by the compiled
   intent schema before completion, so the decision log's rule 5 holds for both the
   explicit and the implicit form. Validation and the id map are cached per
   immutable tree object, so a mutated tree is unsupported by contract and the
   `check_offered_caches_validation_and_accepts_json_transport` test pins the reuse.
   `irreversible` is validated with the action's other fields and the regenerated
   schema agrees with the type (`capabilities.json`).

5. **Styling.** Two rule sets were added, both deterministic text:
   `:where([data-lf-transparency=reduced]) *{--lf-alpha:1 !important;backdrop-filter:none !important}`
   once in the base sheet, and the reduced-transparency recovery block emitted
   twice per design system (inside the media query and under the
   attribute-scoped `:where([data-lf-ds=…][data-lf-transparency=reduced])` selector)
   for slots that use a modifier only. `attribute_recovers_alpha_modifiers_like_the_media_query`
   asserts the attribute block carries the same declarations as the media block, so
   a modifier, shadow layer, placeholder or scrollbar colour — including alpha 0 —
   recovers identically under the attribute. The forcing selector is descendant-wide
   inside the scope: it also overrides host-authored descendant declarations under
   that surface, which is what "for a scope" means (CL-09). No colour, recipe
   property or cascade rule changed; sheet sizes below.

6. **Interaction tiers.** No tier changed. Confirmation runs before the tier-3 round
   trip inside the surface and adds no round trip of its own; `confirm` and
   `irreversible` stay independent, and neither grants authority. F1: §8's tier-3
   row still reads "authorises as the viewer, confirms if irreversible", which now
   reads as though irreversibility were the confirmation rule.

7. **Performance.** `checkOffered` is O(depth) after one validate/index pass per
   immutable tree and validator pair, pinned by its cache test. Measurements below.
   Sheet sizes grew only from the transparency rules: base 1,189 → 1,287 B,
   Certified system 146,938 → 150,656 B, Rack system 155,922 → 162,804 B (both
   systems use alpha modifiers; the delta is the re-scoped copy of their media
   block). Theme sheets, recipe resolution and render cost are unchanged.

8. **Portability.** `src/validate/offered.ts` and `src/validate/complete.ts` import
   only formats, the schema compiler and each other; no host API, no DOM. The
   archive gate's "host-API-free subpaths under node", "consumer types under strict
   NodeNext", "liveframe gen and gen --check" and "browser bundle from the installed
   package" steps pass, and the `/react`-imports-no-`/sdk` scan is unchanged. No
   dependency was added.

9. **Agent authoring.** The MCP tool list stays exactly seven; `list_capabilities`
   already returns whole action declarations, so `confirm` and `irreversible` reach
   an agent with no tool change, and `list_primitives` keeps returning definitions in
   full. `capture_preview` inherits the keyed/controlled behaviour because it calls
   `capture()`. F4: `docs/mcp.md` still calls `generated_types` "the `liveframe gen`
   output", which is now ambiguous, and there is no MCP route to the definitions
   module.

10. **Docs and examples.** `docs/spec.md`, `docs/renderer.md`, `docs/styling.md`,
    `docs/preview.md` (with an "Upgrading from 0.1.0" note), `docs/sdk.md` and
    `CHANGELOG.md` describe the shipped contracts. The proof and demo hosts pass
    `resultScenario` and `origin`, and the demo host calls `checkOffered` at its
    dispatch boundary. F2 (the preview guide claims `onSelect` runs on mount for both
    modes) and F3 (two places describe implementation definitions as something "a
    widget" implements) are wording defects from these tasks.

11. **Conformance.** The renderer page host records `{ intent, origin }` and the
    browser suite calls `checkOffered` on every recorded emission
    (`src/conformance/react/page.tsx:82`, `browser.tsx:98`), so the suites prove the
    check against the fixture tree. No suite rule changed; styled-state reachability
    and app-sheet colour scanning are untouched. Plan 019's corpus covers the format
    validators, which gained only the optional `irreversible` field, so it needs no
    new case; its Task 6 browser verification inherits the existing suites.

12. **Reference hosts.** Clay: CL-01 (controlled and keyed previews, labelled
    results), CL-02 (host classes and styles on both containers, a portal that takes
    no grid track) and CL-09 (host-set reduced transparency) are delivered with
    library tests, including two previews side by side and the migration note.
    Synapta: LF-01 (`origin` plus `checkOffered`) and LF-08 (`irreversible` plus
    `events` metadata and the confirmation hook) are delivered. The proof host and
    demo host exercise both. This is checkout and fixture evidence, not production
    adoption; no product component or authority was added for an adopter.

## Findings and disposition (owner-approved 2026-10-29)

| ID | Finding and evidence | Recorded outcome |
| --- | --- | --- |
| F1 | Spec §8's tier-3 row said the dispatcher "confirms if irreversible". Since LF-08, `confirm` gates the renderer's optional hook and `irreversible` is presentation only, with policy left to the host (§7.3, §11). | executed: row now reads "confirms per its policy", and §8's rules gained "Confirmation is UI, authorisation is the host's" |
| F2 | `docs/preview.md` said `onSelect(cell)` "runs on mount and on every selection change". A controlled preview (`selection` supplied) deliberately does not call it on mount, only for user selections (`src/preview/react/preview.tsx:100-109`, `:111-114`). | executed: the sentence now names the uncontrolled preview and points at the controlled section |
| F3 | `docs/sdk.md` and spec §7.2 described `--implementations` as for "a widget that implements a primitive itself", and sdk.md said to keep the file "out of the widget bundle". Primitives are the app's implementations (§5, §11). | executed: both now say the app implements a primitive itself; the widget-bundle clause became an app-side statement; sdk.md now tells CI to check both generated files |
| F4 | `docs/mcp.md` called `generated_types` "the `liveframe gen` output", ambiguous now that the command has two outputs. The MCP server also has no route to the definitions module. | executed the wording ("the typed component module, byte-identical"); backlog P4 "Offer generated implementation definitions to MCP clients" records the absent route and the spec §13 cost of adding it |
| F5 | Under the VM's load the standalone validator gate failed once: `core-queue.full` 1.552 µs/node against 1.5 at load 4.57–4.88, then passed at 1.436 µs/node on the same code at load 2.97–3.23. Render, CSS, check, release gate and demo test passed in both states. | executed: recorded on the existing P1 validator entry; thresholds and tests unchanged |
| F6 | Plan 018 Task 2's `/sdk/gen` subpath exports `generate()` only, though Task 7 added `generateDefinitions()` and the CLI already uses both. | executed: plan 018 Task 2 now requires both modes, byte-identical to the CLI, with a test per mode |

No code defect was found in the delivered tasks. The two implementation
subtleties checked directly were the `setState` value check (the compiled intent
schema validates an explicit value against the manifest state schema before
completion, so rule 5 of the decision log holds) and the completion path into
`onIntent` (single call site, always completed).

## Verification and measurements

Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS (16 logical CPUs). A QEMU
virtual machine on the host held the load at 3–5 through most of the sequence. Logs
are text evidence in [`017-task-8/`](017-task-8/); no images were produced.

| Run | Load (1 min) | Result |
| --- | --- | --- |
| `bun run bench`, first (`bench-under-load.log`) | 4.57 → 4.88 | **failed** the standalone validator gate: `core-queue.full` 1.552 µs/node against 1.5. Every other fixture ≤ 1.485. The script stopped before render and CSS (`&&`). |
| `bun run bench`, second (`bench.log`) | 2.97 → 3.23 | passed: validator 0.887–1.436 µs/node, render 1.649–2.518 µs/node, agent-home 1.2716 ms, CSS below. |
| `bun run check` (`check.log`) | ~3.2–4.8 | passed: 792 pass, 4 existing reference-dependent skips, 0 fail, 796 tests across 98 files (274.12 s). |
| `bun run release:gate` (`release-gate.log`) | ~3.2 | passed, all 8 steps in 5.1 s. |
| `bun run demo:test` (`demo-test.log`) | ~3.2 | passed, 52 tests, 0 fail (31.36 s), against the packed archive. |

Final-tree numbers (second `bun run bench`):

| Workload | Validation (µs/node) | Render (µs/node) | Render (ms/tree) |
| --- | --- | --- | --- |
| agent-home | 1.296 | 1.873 | 1.2716 |
| core-queue.small | 1.260 | 2.223 | 0.0111 |
| core-queue.medium | 1.268 | 2.084 | 0.8627 |
| core-queue.large | 1.412 | 2.125 | 0.9477 |
| core-queue.full | 1.436 | 2.518 | 1.1911 |
| git-status | 0.887 | 1.833 | 0.2659 |
| rack-module | 0.898 | 1.649 | 0.3892 |
| synthetic-queue | 1.222 | 1.765 | 0.6230 |

Every standalone validator fixture is ≤ 1.5 µs/node, every render fixture ≤ 3 µs/node
and the required trees ≤ 2 ms. Render's separate validation diagnostic exceeds the
reserved 1.5 µs/node on medium, large and full (1.534 / 1.748 / 1.674); it is the
same non-in-render subtraction recorded under plan 015 F1, not a gate.

CSS: declarations 0.423 µs/node (0.287 ms per 679-node tree); base 0.467 ms /
1,287 B; Certified theme 0.965 ms / 7,010 B; Certified system 8.634 ms / 150,656 B;
Rack theme 0.983 ms / 8,257 B; Rack system 12.012 ms / 162,804 B. Against the
pre-plan baseline (Task 5's before-run): base 1,189 → 1,287 B, Certified system
146,938 → 150,656 B, Rack system 155,922 → 162,804 B; themes and declaration cost
unchanged.

Warm switching from the same check run: agent-home CSS switch cold 7.90 ms, max
6.80 ms; git-status cold 4.00 ms, max 3.30 ms, against the 16.67 ms frame budget.
The transparency switching test (`transparency_switch_suppresses_transitions`) and
the root/portal sequence test pass in the same run.

No parity capture was taken: Tasks 5–7 changed no proof output — Task 5 changed CSS
text that the browser tests compare against computed styles, and Tasks 6 and 7 touch
the preview host and codegen only.
