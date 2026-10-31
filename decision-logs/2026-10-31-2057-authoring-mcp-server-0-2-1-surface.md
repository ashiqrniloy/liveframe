---
date: 2026-10-31 20:57
status: approved
decision_about: "The authoring MCP server's additive 0.2.1 surface (M1–M9)"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: The authoring MCP server's 0.2.1 surface

## Decision

Adopt M1–M9 below for 0.2.1, with eight MCP tools and eight matching `/authoring` operations. Directory reading is a CLI-only adapter. Preserve existing text results and defaults; the deliberate error fix replaces the SDK string for missing `pack_draft` keys with `LiveframeError[]`.

This record authorizes plan 021 Tasks 14.2–14.10. It amends D5's inline-only restriction for opted-in CLI hosts and replaces spec §13's prohibition on an intent tool with an offered, tier-2-only `set_state` path. Implementation tasks update the normative spec as their behavior ships; this task records the contract and release policy, not an implemented feature.

## Context

The 2026-10-31 review found a working server with passing suites, but gaps in advertised arguments, error envelopes, generation, interaction, disk input, tool metadata, structured results, capture limits and structural layout proof. `/authoring` already accepts `outcomes`; the MCP handler passes it through but does not advertise it. The review verified that `outcomes: "yes"` over stdio reaches Liveframe's `invalid-document` error at `/outcomes`.

The existing contract has seven tools, a 12-cell capture limit, inline drafts, no agent intent path and text-only results. The four laws remain binding: code stays on the backend, trees remain validated data, widget styling remains token-constrained, and authoring grants no application authority.

## Approval

- Proposed by: both; the owner's release scope and plan 021's recommended contracts.
- Approved by user: Yes.
- Scope instruction, 2026-10-31, verbatim: "I want fix all of the issues and ship with 0.2.1" (recorded in plan 021).
- Approval evidence, 2026-10-31: the user instructed, "Complete - [ ] Task 14.1: Record the authoring MCP server's 0.2.1 surface (decision log)from plans/021-Phase-7-Part-H-Release-0-2-1.md and update the plan once done". This explicitly authorizes recording the named task's recommendations, including each annotation row, rather than requesting another scope proposal. The concrete bounds and necessary plan corrections below complete that task's unresolved details.

## Alternatives Considered

1. **Defer M2–M9 to 0.3.0** — rejected by the owner's 0.2.1 scope instruction.
2. **Keep the existing tool surface** — rejected: it leaves the review's gaps unresolved. Per-decision alternatives and tradeoffs follow.

## Rationale and Evidence

### M1 — Advertise `outcomes`

Add the optional boolean to `render_scenarios`' advertised arguments and spec §13. Keep the existing library behavior: expansion returns statuses, uses a separate surface/revision sequence, and does not change the preview selection or state. Invalid values remain handler-validated `invalid-document` errors at `/outcomes`.

Rejected: leaving a supported argument undiscoverable, or introducing a separate expansion tool; neither keeps the library and adapter aligned as simply.

### M2 — Typed argument errors

Remove `pack_draft`'s top-level `required`. Each inline property's description says "Required" and explains the directory alternative when present. Retain permissive argument properties, published reference schemas in `$defs`, and handler validation. `{}` reports `/files`, `/entry`, `/manifest` and `/scenarios` errors. No nested document is made optional to the packer.

SDK 2.4.0's `CallToolRequestParamsSchema` defines `arguments` as an optional record. `null`, arrays, strings and numbers fail protocol parsing before a tool handler; omitted arguments or an empty object can reach it. This is the one non-object protocol exception to the typed *tool argument* error promise. The regeneration probe asserts those rejections and confirms that `fromJsonSchema` without `required` accepts `{}`. Task 14.3 also pins the wire behavior.

New optional arguments use descriptive, permissive envelopes and library validation where a restrictive SDK schema would otherwise return a bare string. Keep the established validation and error kinds of existing calls; this decision does not redesign unrelated legacy argument errors.

Rejected: SDK-required fields (bare strings), catching errors inside a handler the SDK never invokes, or weakening the manifest/scenario validators.

### M3 — All generated modules

`generated_types({ module? })` and `generatedTypes({ module? })` accept `"types"` (default), `"implementations"` and `"elementsSchema"`. Reuse `generate`, `generateDefinitions` and `generateElementsSchema`. All return `{ note, types }`, with `types` equal byte for byte to the corresponding CLI output, including its final newline. The default note and text result remain unchanged; other notes name the appropriate output file. An unknown selector is `invalid-document` at `/module`, with all three accepted values in `expected`.

Rejected: omitting `elementsSchema` (immediate CLI drift), returning an object for that mode (breaks the common result shape), or adding two tools for one output choice.

### M4 — Offered `setState` only

Add `set_state({ origin: { nodeId, event }, value? })` and async `setState()` in `/authoring`'s arrival-order draft queue. Only a successful, current single-scenario render establishes the origin tree. A successful repack clears it; a failed pack retains it. Checking all scenarios or expanding outcomes does not establish or replace a single-scenario selection. With none, return `not-found` and "Call render_scenarios with a scenario first".

Find the node and offered event in that tree. Unknown nodes and events use `checkOffered`'s `not-found` at `/origin/nodeId` and `undeclared-event` at `/origin/event`. Refuse an offered action as `invalid-prop` at `/origin/event` before calling `session.intent`; never log or dispatch it. Complete the offered `setState` using its literal value when present or the event-carried `value` otherwise. Fill `surfaceId` and `revision` from the served tree, then call `session.intent(completed, origin)` so `checkOffered` checks completion and the session validates state. Return the newly validated tree, retaining the existing 262144-byte JSON bound and `limit-exceeded` at `/scenario`. A rejected input changes neither state nor the intent log. No raw `{ key, value }` path is accepted.

The bound page and a subsequent capture of the selected scenario must see the changed state. Evidence exposes a prerequisite: `PreviewSession.render()` currently resets selection on every call, and both proof/demo page snapshot functions call it. Add an optional `preserveState?: boolean` render flag, default false. With true and the same selected scenario, retain current state/context unless explicitly overridden; changing scenario uses its normal initial selection. Proof/demo snapshot readers opt in. Existing render calls keep their reset behavior. Add a session regression and an end-to-end set-state-then-capture regression; sharing a session alone is insufficient evidence.

Spec §13's replacement law-4 sentence is: "its only intent path, `set_state`, applies an offered `setState`; no tool runs, logs or dispatches an action". Keep the no-store/resolver/installation/placement/approval text and the trees-only page rule.

Rejected: general `send_intent`, action logging, origin-free state mutation, a second preview session, changing existing render reset defaults, or claiming capture preserves state without checking the host's snapshot path.

### M5 — Opt-in draft directories

Only CLI `AuthoringConfig` gains `draftRoot?: string`. Resolve a relative root from the server's working directory at startup, canonicalize it, and require an existing directory; invalid configuration prints typed `invalid-document` at `/draftRoot` and exits 2. `pack_draft({ dir, entry? })` reads top-level `.ts`/`.tsx` sources, `manifest.json` and `scenarios.json`; `entry` defaults to `entry.tsx`. Convert to the existing inline `PackInput`, preserving hash equivalence and all packer validation. `/authoring` remains inline-only and host-API-free.

Require a non-empty relative `dir`. At `/dir`, reject absolute paths and any `..` segment as `invalid-document`; check canonical containment of the directory **and each selected file** beneath the root using path boundaries, so sibling-prefix paths and escaping file symlinks fail too. A missing directory/required JSON file/entry is `not-found`; malformed JSON, conflicting inline fields (`files`, `manifest` or `scenarios`) and non-regular selected files are `invalid-document`. `dir` without configured `draftRoot` is `not-found` naming `draftRoot`. Bound violations are `limit-exceeded`. Every reader rejection uses `/dir`; subsequent document validation keeps its existing document-root pointers.

Correct the plan's assumption about existing input bounds: `bundle()` has no source-file-count bound; `checkCodeSize()` limits **emitted code** to 1048576 UTF-8 bytes. The new CLI reader limits selected source files to 128 and aggregate bytes read (sources plus the two JSON documents) to 1048576. Check file sizes before allocating contents and enforce the aggregate bound during reading; emitted code still has its existing independent limit. Ignore unrelated files and do not recurse. This opt-in reader assumes host-controlled directories, not a sandbox against a local actor concurrently replacing files; untrusted draft execution still requires an isolated runner.

This amends D5 only for opted-in CLI hosts. Inline transport remains available without filesystem access.

Rejected: unrestricted paths, per-file path lists, directory reads in `/authoring`, checking only the directory while following escaping file symlinks, or relying on the emitted-code limit to bound filesystem reads.

### M6 — Titles and behavior annotations

Every tool gets the title below and all four explicit hints. All `openWorldHint` values are false: tools operate in the configured app's authoring environment. Hints do not enforce isolation or permissions; a host-supplied runner/backend retains its own authority.

| Tool | Title | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
| --- | --- | --- | --- | --- | --- |
| `list_primitives` | List primitives | true | false | true | false |
| `list_vocabulary` | List vocabulary | true | false | true | false |
| `list_capabilities` | List capabilities | true | false | true | false |
| `generated_types` | Generate catalog module | true | false | true | false |
| `pack_draft` | Pack draft | false | false | true | false |
| `render_scenarios` | Render scenarios | false | false | true | false |
| `capture_preview` | Capture preview | true | false | true | false |
| `set_state` | Apply offered state event | false | false | false | false |

Packing replaces in-memory draft state; failed packing retains the old draft. Rendering sets the current selection. Idempotence here describes repeating the same logical operation without intervening changes, not identical generated revisions or screenshot bytes. `set_state` is conservative because re-rendering may change the offered event.

Rejected: SDK defaults or marking all tools read-only; both conceal actual session mutation.

### M7 — Structured results without changing text

Every successful tool result carries `structuredContent` equal to the JSON value in its first existing text block and an advertised `outputSchema`. Error results use `isError: true`, retain their text and omit `structuredContent`; SDK 2.4.0 skips their output validation. Capture keeps ARIA text and PNG image blocks unchanged; structured output contains only first-block cell metadata, plus optional requested layout.

| Tool | Successful structured value / schema |
| --- | --- |
| `list_primitives` | Array of the published catalog definition schema |
| `list_vocabulary` | Object requiring `catalogId` and the catalog's published `vocabulary` schema |
| `list_capabilities` | Published capabilities document, still stripping `meta` unless opted in |
| `generated_types` | Object requiring string `note` and string `types` |
| `pack_draft` | Object requiring `hash`, `id`, `version`, string-array `scenarios`; optional `description` and opt-in `meta` |
| `render_scenarios` | Union of the published UI-tree schema and the existing scenario-status array |
| `set_state` | Published UI-tree schema |
| `capture_preview` | Array requiring `scenario`, `width`, `theme`, `designSystem`, `errors`; optional `layout` only when requested |

Status entries are `{ scenario, ok: true, nodes }` or `{ ok: false, kind, pointer, message, expected?, scenarios }`; errors use the existing `LiveframeError` fields. Reuse published property schemas for draft summaries and catalog output. Inline reachable definitions under `$defs`, rewriting references to their local targets; no absolute external `$ref` may remain. SDK 2.4.0 does not dereference external references.

For modern protocol 2026-07-28, array and union roots are returned directly. SDK 2.4.0's era codec wraps non-object-root schemas/results as `{ result: value }` for 2025-era clients (pin 2025-11-25 in Task 14.8's compatibility test). A tree/status union is also a non-object-root schema even when this call returns a tree. Existing text blocks are retained through the codec. Test negotiated versions and wire envelopes, not merely handler return values.

The regeneration probe validated the actual 679-node agent-home tree with SDK `fromJsonSchema(ui-tree.json)`: ten warm validations after ten warm-ups, upper-middle median **0.831 ms**. This is schema-only evidence, not a tool round-trip result. Task 14.8 must compare ten warm round trips before/after, with median added cost **≤ 5 ms**. If full validation exceeds it, use the lighter tree branch requiring `format`, `catalogId`, `surfaceId`, `revision`, and object `root`, reusing published top-level constraints. Runner validation remains mandatory; this fallback reduces duplicate output checking only.

Rejected: replacing text with an envelope (breaks old clients), external references (compile failure), wrapping arrays manually for all clients (unnecessary modern result change), or assuming schema-only timing proves the transport budget.

### M8 — Configurable capture cells, 12 by default and 48 maximum

`AuthoringConfig.maxCaptureCells?` and `AuthoringOptions.maxCaptureCells?` accept integers **1–48**, default **12**. Validate at construction/startup. The CLI prints `invalid-document` at `/maxCaptureCells` and exits 2; `createAuthoring()` throws the existing `LiveframeFailure` carrying that error, preserving its synchronous object-returning API. It does not change to `Result<Authoring>`.

Advertise the configured limit in the tool description. Refuse over-bound requests before capturing any cell with `limit-exceeded`, naming `maxCaptureCells`, its value and axis-narrowing arguments. This changes only the authoring cap, not the general `capture()` API's existing `maxCells` semantics.

Before fixing 48, the regeneration probe captured **48 real proof-host cells**: four scenarios (`ready`, `host-ready`, `loading`, `empty`) × three widths (360, 768, 1280) × two themes × two design systems, using the existing capture core with `maxCells: 48`. All cell error lists were empty. Wall time was **9341.8 ms**, PNG bytes **4845517**, existing MCP-shaped JSON **6576912 bytes**, or **6581786 bytes** with duplicated structured metadata. The tool's fixed 12-cell guard is not implemented around in this task: the probe measures the core and constructs the current adapter's result shape. No images are committed.

48 is a cell-count bound, not a universal byte bound: tall/dense app pages may produce larger PNGs or exceed a client's transport limit. Hosts opt in and may narrow axes or choose a lower cap. Task 14.9 remeasures the actual tool at its new maximum; the sample is evidence for the chosen ceiling, not a promise of identical timings or byte sizes.

Rejected: retaining an inflexible 12, changing its default, no maximum, or adding per-axis configuration. The recommended four-width/three-theme/four-system matrix is another possible 48-cell shape; the probe uses the proof host's actual declared axes.

### M9 — Structural layout alongside capture

Add `layout?: boolean`, default false, to MCP/library capture input and `CaptureOptions`, and an optional `CaptureSession.layout?(cell)` backend method. Add the CLI's matching valueless `--layout` flag. A requested layout is:

```ts
type CellLayout = {
  width: number;
  height: number;
  overflowX: boolean;
  overflowing: string[];
  nodes: { id: string; x: number; y: number; width: number; height: number }[];
};
```

Use the captured `[data-lf-cell]` border box as the coordinate origin and its width/height, in integer CSS pixels. For every `data-lf-node` wrapper in DOM order, union its child element border boxes, recursively traversing boxless `display: contents` children to the nearest boxed descendants. Hidden/no-box nodes remain as `{ id, x: 0, y: 0, width: 0, height: 0 }`. Round final coordinates and dimensions once. Determine right-edge crossing from unrounded boxes; `overflowing` lists those node ids in DOM order. `overflowX` is true if `scrollWidth > clientWidth` or a measured node crosses the right edge. The box/rounding rules are deterministic, not an assertion that geometry reads are free on deferred content.

`playwrightBackend` obtains this in one `evaluate` per cell. Preview already enables diagnostic wrappers, whose own `display: contents` boxes are empty; no renderer or Preview change is required. Return only geometry and node ids, never page text or unrelated attributes.

When requested, core capture writes `<cell>.layout.json` into its returned file map and sets optional `CapturedCell.layout` to that filename. A backend without the method (or returning no layout) uses `layout: null`, with no layout file. `/authoring` decodes the file into `layout: CellLayout | null`; MCP includes it in both first-block metadata and structured content. Without the option, omit the field/file entirely, preserving existing capture bytes. The CLI persists returned files as it already does.

Each serialized per-cell layout record is limited to **262144 UTF-8 bytes**, independently of the PNG/ARIA payload; fail as `limit-exceeded` naming that cell (MCP error pointer `/layout`). Do not silently truncate node lists. The custom-backend result must satisfy the same finite-number/field/byte constraints before it reaches structured output. Task 14.10 measures the added cost on the 679-node tree at 360 px: median over ten cells **≤ 100 ms/cell**.

Replace the proof loop's 133-pixel image-height test: Inline buttons share a `y`, Stack button `y` values increase, and neither cell overflows at 360 px. Geometry proves the intended layout while ARIA and images retain their existing roles.

Rejected: a separate measurement tool (reopens the same cells), overflow alone (cannot distinguish row and stack), screenshot-height inference, measuring empty wrapper boxes, or making every backend implement a new required method.

## Draft spec edits and release reading

- §13: advertise eight tools/operations; add M1/M3 arguments, M4 and its law-4 sentence, the M2 protocol exception, opt-in CLI `draftRoot`, `maxCaptureCells` in CLI/library config, annotations and M7 structured results alongside unchanged text. Replace "at most 12 per call" with default 12, configured maximum 48. Add optional capture `layout` and `--layout`.
- §7.5: document opt-in `preserveState` for same-scenario host snapshots and capture's optional layout file/backend method; existing render defaults and capture output remain unchanged.
- §13 runtime matrix: `/authoring` and `/preview/capture` remain host-API-free; filesystem reading stays in the CLI, browser geometry in the injected backend.
- Compatibility: one new tool, optional arguments/config fields and render flag, titles/annotations, output schemas and structured output are additive. Existing 0.2.0 text results and error kinds remain unchanged except the documented missing-`pack_draft`-key fix. Default capture still caps at 12. No existing format, corpus expectation, hash vector or on-disk store layout changes.

## References

- [Plan 021](../plans/021-Phase-7-Part-H-Release-0-2-1.md), Task 14.1 and implementation Tasks 14.2–14.10 — reviewed scope, alternatives, gates and tests.
- [D1–D6](2026-10-24-2330-authoring-mcp-server-contract.md) and [authoring-library decision](2026-10-29-1244-runner-kit-capture-and-authoring-library.md) — amended D5, backend injection and the session queue.
- [Spec](../docs/spec.md), §2, §7.5 and §13; [compatibility](../docs/compatibility.md), §0.2.1; [MCP guide](../docs/mcp.md); [backlog](../plans/backlog.md) — current authority and follow-up ownership.
- `src/cli/mcp.ts:75–245`, `src/authoring/index.ts:79–311`, `src/preview/session.ts:106–134`, `proof/host/preview.ts:15–23`, `examples/demo-host/preview.ts:26–29` — existing schemas, operations and reset-on-render behavior.
- `src/pack/bundle.ts:198–244`, `src/formats/package.ts:65–76`, `examples/demo-host/widgets/draft.ts:5–16` — actual input behavior and emitted-code byte bound.
- `src/preview/capture/index.ts:20–153`, `src/preview/capture/playwright.ts:46–56`, `src/preview/react/preview.tsx:154–174` — optional-backend extension point, capture loop and diagnostic wrappers.
- [Regeneration probe](../plans/evidence/021-task-14-1-mcp-surface.ts) — protocol assertions, SDK schema timing and real 48-cell capture; run its header command. Bun 1.4.4, SDK 2.4.0, Playwright 1.64.1; local measurements on 2026-10-31. No screenshot artifacts are retained.
- Context7 `/modelcontextprotocol/typescript-sdk/v2.4.0`, fetched 2026-10-31: [tools](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/servers/tools.md), [errors](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/servers/errors.md), [migration](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/migration/upgrade-to-v2.md), [era codecs](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/migration/support-2026-07-28.md). Installed core 2.4.0 `CallToolRequestParamsSchema` confirms object-only protocol arguments.

## Consequences

- Tasks 14.2–14.10 implement these contracts and close the six named MCP backlog entries only when their behavior and tests ship. This decision task closes none prematurely.
- Task 14.5 must cover the host snapshot path as well as the authoring method; Task 14.6 adds explicit bounded reads instead of assuming nonexistent source-input limits.
- Full output validation and larger capture payloads add work. The measured schema cost supports trying full schemas first; later task budgets remain binding.
- Opt-in disk input is host authority, and MCP annotations are hints. Neither the file root nor the default runner is an execution sandbox.
- Revisit the ceiling or schema fallback only with actual client/host measurements; wider intent authority or unrestricted filesystem access requires a separate decision.
