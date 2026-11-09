# What 0.3.0 gives adopters

0.3.0 closes the weaknesses found in the 2026-11-05 evaluation (W1–W9, L1–L2), the items queued for this release (Q1–Q10) and the release proofs carried over from 0.2.3 (O1–O2). Each row states the general problem first, then what shipped, the [spec](spec.md) section and the limitation. Where a row names a limitation, it is part of the release, not a to-do: it is what you can rely on today. The breaking entries have their own checklists in the [migration guide](migration-0.3.md); this page does not repeat them.

## Open requests this release closes

### Synapta

Synapta's LF-01 to LF-17 shipped in 0.2.0 ([adopter notes](adopters-0.2.md)). Three of Synapta's standing hand-offs move with 0.3.0:

| Standing item | What 0.3.0 gives | What stays with Synapta |
| --- | --- | --- |
| Provide an isolated backend `Runner`, used for preview and production. | `runnerSuite({ …, isolation: true })` proves any runner against the contract and the isolation probes (host globals, state between renders, loops, memory, recursion, a native hold, forged answers). `quickjsRunner()` is an optional, measured alternative. | Choosing the runner, tenant scoping, data resolution, approval and the OS sandbox around it. Passing the suite is evidence, not authorisation. |
| Hand-rolled request-time orchestration (bind sources, check the offered intent, diff, cache). | `renderPlacement()`, `handleIntent()` and `dependents()` from `/host`. | Injecting `store`, `runner`, `resolve`, `authorize` and `dispatch`; serialising calls per placement and scope; storing `Served`. |
| Reading `renderKey` and package immutability as a convention. | Frozen packages and caller-owned inputs; `actions` in the render key. | Recomputing cached keys (every 0.2 key differs). |

### Clay

Clay's CL-01 to CL-16 shipped in 0.2.0 and 0.2.1. 0.3.0 closes two items from Clay's release review:

| Item | What 0.3.0 gives | Limitation |
| --- | --- | --- |
| **CL-17** Foreign-realm inputs are handled three different ways. | One rule: every public document validator rejects a foreign-realm plain object with `invalid-document` and the instruction to parse inside the sandbox ([migration](migration-0.3.md#foreign-realm-documents-are-rejected-everywhere)). `compileValidator` throws `LiveframeFailure`; a compiled validator's `validateTree` names the realm. | Patch bases and diff inputs still require previously validated, immutable trees. |
| **CL-14** The `next` dist-tag is older than `latest`. | The publish workflow moves `next` after every stable release, for all three packages. | Needs **Allow npm dist-tag** on each package's trusted publisher (owner setting). The release record states whether the step ran or the owner repaired it. |

Clay's remaining standing items are unchanged: a Vitest/Jest registration of the conformance suites (the kit runs under Bun), and the WebKitGTK measurement of theme switching, which Clay runs in its own plans.

## Weaknesses and queued items

### Interaction, hosts and runners

| ID | Problem, in general | Shipped in 0.3.0 | Spec | Limitation |
| --- | --- | --- | --- | --- |
| W1 | A typical app adopting Liveframe from npm faces a steep security cliff: neither reference runner is a sandbox, so everyone builds an isolate. | `@arnilo/liveframe-runner-quickjs`: `quickjsRunner({ memoryBytes?, stackBytes?, timeoutMs?, reuse?, maxRuntimes? })` runs widget code in QuickJS (WebAssembly) in a Bun child process the runner owns and kills; `runnerSuite()` proves any runner. | §7.5, §13 | Agent-home takes about 82 ms fresh (47 ms with `reuse: "package"`) against 1.7 ms in process; one child renders one widget at a time, so a held render delays the queue by up to `timeoutMs` + 100 ms plus the restart; Linux only; a defect in QuickJS or an orphaned child after a host `SIGKILL` is not covered. See [what the QuickJS runner isolates](security.md#what-the-quickjs-runner-isolates). |
| W2a | Many widgets only read data, filter and lay it out, yet each needs author code and so a sandbox. | Template widgets: `liveframe-template/1`, `validateTemplate`, `renderTemplate`, `templateRunner()`; packages hold `template` in place of `code`; `pack_draft`, preview and `generated_types({ module: "templateSchema" })` author them. | §7.6, §7.3 | No loops beyond input arrays, no recursion, no regular expressions, no locale-dependent operator; work is bounded by `limits.steps` and `templateRunner()` has no wall-clock timeout. |
| W2b | An agent's answer arrives as text over seconds, but a tree can be drawn only when complete. | `streamElements({ validator, surfaceId, revision?, limits?, maxErrors? })` returns a new valid tree each time completed nodes change; successive trees are valid `diffTrees` inputs. | §7.2 | Only completed nodes draw; malformed JSON is `invalid-document` at `/$stream/<offset>` and reads no further. |
| W3a | A widget cannot tell "saving", "failed" or "refused" without the host improvising a convention. | `actions: Record<string, ActionStatus>` as a render input, keyed by action name or an intent's `resultKey`; capability `result` types an `ok` value; `renderKey` hashes it. | §8, §7.1 | A result only changes what the widget draws; it grants nothing. At most 64 entries, a 500-character `reason`. |
| W3b | An interaction that spans two nodes (a live filter, a disclosure) costs a backend round trip. | `local` state in the manifest, `when` and `bind` expressions on nodes, `setLocal` events; `local`, `self` and `ex` in `/sdk`. | §8, §9 | Browser-evaluated expressions are data with two roots and 27 operators; state is per surface and never sent to the host, so a widget that wants the host to know a value commits it with `setState`. |
| W4 | Every host hand-rolls bind, resolve-as-the-viewer, skip, run, validate and diff, and gets the order wrong in a different way. | `renderPlacement()`, `handleIntent()` and `dependents()` from `/host`; the demo host and [getting-started guide](getting-started.md) use them. | §7.7 | Stateless: you serialise calls per placement and scope, keep `Served`, and supply `authorize` and `dispatch`. Overhead is 0.13–0.16 ms beyond the load, the runner and the resolver. |
| W5a | Nobody knows which stored packages a catalog change breaks. | `checkPackages(packages, { catalog, capabilities, runner? })` and `liveframe check-packages <store-dir>`. | §7.3 | The CLI renders only template packages, since it never runs widget code; a code package is verified only. |
| W5b | Two catalog majors cannot share a page. | `createRenderer({ catalogs: [{ catalog, implementations }, …] })`; each `<Surface>` uses the catalog its validator was compiled for. | §11 | A tree for a catalog the renderer does not hold falls back and is reported as `catalog-mismatch`. |
| W5c | A state schema change resets every stored state. | `migrateState` in a manifest: per key, a template expression over `previous`; results carry `migrated`. | §7.4 | A failed or non-fitting migration still resets; expressions read `previous` only. |
| W6a | Widgets duplicate shared components, and a fix must be repeated in each. | Library packages (`exports`) and `libraries` for `pack()` and `verifyPackage()`; `liveframe:lib/<id>@<version>` imports; `rebindDependencies`; runners and `loadPlacement` load pins by hash. | §7.3, §7.4 | At most 16 direct, 32 in the graph, 4 deep, no cycle; template packages declare neither field. A runner with its own `resolve` must map `liveframe:lib/…` itself. |
| W6b | One widget's action should refresh another's view. | `dependents(placements, { source, params? })` names the placements that read a changed source. | §7.7 | A linear scan over `Served.bound`; no subscription registry or push channel (supply `publish` to `handleIntent` if you push). |
| W7a | The renderer is React only. | `createSurfaceCore()` from `/surface`: validation, revisions, node contexts, intents, confirmation, local state and bindings with no framework; `/react` is rebuilt on it, API unchanged. | §11 | No second renderer ships; `/surface` is the core a second renderer needs. |
| W7b | First contact needs a catalog, primitives, themes and styles that each adopter must write. | `@arnilo/liveframe-starter` and the CI-executed [getting-started guide](getting-started.md). | §13 | Generic primitives only; `react-aria-components` is a required peer; no `bun create` template. |
| W7c | Node support was never decided. | Bun ≥ 1.4.2 is the only supported runtime ([compatibility](compatibility.md#030)). | §13 | Pure subpaths keep their listed globals and run in isolates; backend subpaths and the new packages need Bun. |

### Formats and styling

| ID | Problem, in general | Shipped in 0.3.0 | Spec | Limitation |
| --- | --- | --- | --- | --- |
| Q1 | A label, an `aria-describedby` target or a `for` link needs an id the author cannot know. | Node references: `ref("hint")`, `$anchor`, catalog `refProps`; `<Surface>` rewrites them to `domId`. | §5, §11 | At most eight reference props per catalog; the target's implementation must render `domId` as its `id`. |
| Q2 | An app needs a recipe property the library does not name (a highlight, a shadow). | `vocabulary.extensions` and a recipe's `extensions`; projected as `--lf-p-<name>`. | §6.2, §6.5 | `auditContrast` ignores extensions; colours come from theme roles only. |
| Q3 | Tone × emphasis needs product variants (`primary-critical`), which multiply. | Variant axes: `axes`, `kind.axis:value` recipe overlays and `roles` aliases. | §6.4, §6.5 | At most three axes per kind and 512 combinations per catalog; a kind that adopts an axis changes its slot classes. |
| Q4 | A package or a render input could be changed after it was checked. | `pack()` and `verifyPackage()` return deeply frozen packages; `render()` leaves caller objects writable and gives the widget a frozen copy. | §7.1, §7.3 | A render checks mutable inputs again each time; do not depend on identity. |
| Q5 | `width="2fr"` was accepted but meaningless. | Dimension props reject `fr`; use `grow` and `basis`, or grid tracks. | §6.3 | Grid `columns` and `rows` still accept fractions. |
| Q6 | Every `loadPlacement` re-verifies the same package. | An opt-in host-owned `verifiedPackages({ max? })` passed as `{ verified }`. | §7.4 | Structure, hashes, params and state are checked on every load; only the verification is reused. |
| Q7 | Preview and authoring cannot raise tree limits for a large catalog. | `limits: { nodes, depth, bytes }` on `createPreview()`, `createAuthoring()` and the MCP config. | §7.5 | Authoring response and capture bounds are unchanged. |
| Q8 | Validators disagreed about objects from another realm. | One rule: reject with the realm message (CL-17 above). | §10 | Transport text and parse it inside the receiving realm. |
| Q9 | A checker and its published JSON Schema could drift. | One definition per format derives both. | §10 | Install-time references, recipe completeness and contrast remain separate checks. |
| Q10 | Keyboard focus is lost when an update removes the focused row. | `focusContinuity` defaults to `true`. | §11 | Pass `focusContinuity={false}` if the host owns recovery. |
| W8a | A state or a landmark role the library does not know forces a library release. | `vocabulary.states` and `vocabulary.semantics`; `ariaRoles` is exported. | §6.5 | A `role` must be in `ariaRoles`; a state's attribute is `data-` plus the kebab-case name; `rendererBrowserSuite` needs a fixture per styled state. |
| W8b | Every host hand-writes `javascript:` blocking for URL props. | A `url: { schemes, relative? }` rule on string schemas; `catalogSuite` flags URL-named props without it. | §5, §10 | A prop that does not declare it is a plain string; the renderer interprets no string as a URL. |
| W9 | The spec mixed contracts with release history. | `docs/spec.md` is normative; history moved to [compatibility](compatibility.md). | all | None. |

### Localisation, observability and release proofs

| ID | Problem, in general | Shipped in 0.3.0 | Spec | Limitation |
| --- | --- | --- | --- | --- |
| L1 | Widgets format dates and numbers, and a cached tree then depends on the runtime that rendered it. | The determinism rule: locale, direction and time zone arrive only through `context` (`locale`, `direction`, `timeZone`); a widget calling `Intl` is deterministic only within one runtime build. See [localisation](localisation.md). | §7.1 | A cross-runtime `renderKey` cache is unsafe for a widget that calls `Intl`; templates have no locale-dependent operator. |
| L2 | The renderer and the host drop invalid input silently. | `<Surface onEvent>` and `createSurfaceCore({ onEvent })` (six `SurfaceEvent` kinds); ten `HostEvent`s from `renderPlacement` and `handleIntent`. | §11, §7.7 | Events carry ids, kinds, revisions and errors, never prop values or host error text; a throwing handler is contained. |
| O1 | The performance budgets were last measured on a loaded host. | The release runs one sequential `bun run bench` on a quiet host with the load recorded (release task 3). | §12 | A run on a loaded host is called loaded in the record. |
| O2 | `next` could trail `latest` after a release. | The workflow moves `next` for every package after a stable publish; the release record shows the registry state. | [compatibility](compatibility.md#release-process) | Needs **Allow npm dist-tag** on each package's trusted publisher. |

## Not delivered, and why

| Item | Reason |
| --- | --- |
| Nested surfaces | The analysis proposed composition through dependencies and coordination instead; lifting the no-nesting rule changes every sheet. |
| A second renderer | `/surface` is the core one needs; none ships. |
| Node runtime support | Owner decision: Bun is the only runtime. |
| macOS and Windows runs of the new packages | Only Linux was measured; both are backlog items. |
| A pool of QuickJS children | One child serialises renders; head-of-line blocking is documented and a pool is a backlog item. |
| Vitest and Jest registration of the conformance suites | The kit runs under Bun; the backlog keeps the item open. |
