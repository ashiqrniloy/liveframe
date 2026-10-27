# How a surface gets from code to the browser

This page explains the Liveframe model step by step: what happens between someone writing widget code and a user seeing and clicking it, and who is responsible for each step. It is explanatory. [`spec.md`](spec.md) is the normative design, and each step names its spec section.

The running example is an agent home page that shows a task queue widget, as in the Phase 0 proof.

## The four roles

| Role | Who it is | What it contributes |
|---|---|---|
| **Liveframe (LF)** | This library | Formats, the SDK, the validator, widget packaging, the record formats and reference stores, the style resolver and CSS projection, the React renderer and its interaction plumbing |
| **Host** | The app that adopts Liveframe | Its primitives (definitions and React code), its declared vocabulary, page shell, sandbox, data, state, actions, storage backend, approval and transport |
| **Author** | A person or an AI agent, at runtime | Widget code and manifests. A theme or design system may also come from an author rather than the host |
| **Browser** | The user's browser or webview | Runs only the host's compiled primitives plus Liveframe's renderer, and the projected CSS. It never runs widget code |

## Surfaces, not pages

Liveframe never renders a page. It renders **surfaces**. A surface is one widget placed in one slot of the app. The page itself (routes, header, navigation, the layout shell, which widgets are placed where) belongs to the host. A page is the host's shell plus any number of surfaces.

## The pipeline at a glance

```
 BUILD TIME (deploy)          INSTALL TIME (no deploy)          REQUEST TIME (every render)
 ───────────────────          ────────────────────────          ───────────────────────────
 Host: definitions            Author: widget TSX + manifest     Host: route → placements
       React primitives               + fixture scenarios        LF:   load, verify package + state
       declared vocabulary    LF:     preview via host runner    Host: resolve data, context
 LF:   typed SDK (gen)                ⟲ look, capture, change          → run widget in its runner
                              LF:     pack → package (hashed)    LF:   build tree, validate
                              Host:   approve, place, store      Host: send tree to the browser
                              Author/Host: theme + design system
                              LF:     validate, project 3 sheets
                              Host:   cache and load CSS         LF:   scope, style, draw the tree
                                                                 Browser: host primitives → DOM
                                                                 ⟲ intents back to the host
```

## Phase A — build time (once per deploy)

**A1. Host: define the catalog** (spec §5). One definition per primitive (`box`, `text`, `button`, `menu`…): props schema, children, events, variants, slots, style props and accessibility. Together they form a versioned catalog such as `acme.ui@1`. Liveframe supplies the definition format; the host decides which primitives exist.

**A2. Host: implement each primitive in React** (spec §11). Liveframe's `implement(definition, Component)` binds the primitive. The implementation receives validated `props`, `slot(name)` (one stable class for the slot in its current variant), `emit(event)`, and already-rendered children. The primitive exposes state through native semantics or state attributes and supplies its own structural CSS. This is the only app code that runs in the browser, and it ships compiled with the app.

**A3. LF: generate typed SDK components** (spec §7.2). `liveframe gen catalog.json --out src/widgets/ui.gen.ts` emits a typed component module — `<Button>`, `<Stack>`… — that widgets import by relative path, so `gap="13px"` fails to compile.

**A4. Host: declare the vocabulary** (spec §6.5). These are the colour roles, typography roles, tones and design-value names (`space.*`, `radius.*`, `size.*`, breakpoints) that every theme and design system must provide. The catalog carries it.

**A5. Host: declare its capabilities** (spec §7.1). Each action and data source the host offers, with a description and schemas. Authors and agents read them to learn what a widget may ask for, and the validator checks action arguments against them. They grant nothing: the host still authorises every read and action as the viewer.

Nothing after this point needs a deployment.

## Phase B — install time (runtime, no deploy)

**B1. Author: write the widget** (spec §7.1). A pure function `(params, state, data, context) → element tree`, which may import composed components (`TaskCard`, `QueueRow`) written as plain TSX. Its **manifest** declares the target `catalogId`, schemas for params, state and context, the initial state, the data sources it reads, and the actions it may invoke. The author also writes at least one **fixture scenario** (spec §7.3): named inputs such as `default`, `empty` and `failed`.

**B2. Author: preview and iterate** (spec §7.5). The host runs a Liveframe **preview session** on its backend, wired to the same **runner** (its sandbox) that production uses. Each edit packs a draft and renders it. The host's preview page mounts `<Preview>`, which draws the draft with the host's own primitives and CSS across scenarios, container widths, themes and design systems. `setState` works inside the session. Actions are shown in an intent log and never run. A person watches the page. An agent runs `liveframe preview capture <url>` and reads back screenshots and accessibility snapshots, then changes the code and captures again. The draft's code still never reaches the browser. See the [preview guide](preview.md).

**B3. LF: pack it** (spec §7.3). `pack()` checks the manifest and scenarios, transpiles the TSX, bundles the composed components it imports, and returns an immutable **package** identified by a SHA-256 hash. The package is exactly the last previewed draft, with the same hash. `pack()` never runs the widget.

**B4. Host: approve, place and store it** (spec §7.4). The host decides how widgets arrive (uploaded by a user, proposed by an agent, approved by an admin) and where each one is placed: for example, `queue@3` placed in the agent home's `main` slot with `params: { size: "large" }`. It may require the session's `check()`, which renders every scenario, to pass before approving. It then writes the package and the placement to its **store**: `fileStore(dir)` or `memoryStore()` from Liveframe, or its own database behind the same `Store` interface. Liveframe decides the record shapes and the checks; the host decides the policy and the backend.

**B5. Author or host: supply a theme and a design system** (spec §6.1–§6.2). Both are data. The theme holds colour and typography roles. The design system holds values and recipes, such as `button.ghost.label.hover → { textColor: "text.primary", … }`.
**LF** validates them on install: required roles are present, every `(kind, variant, slot, state)` resolves, value types are correct, and no colour comes from outside the theme. The host stores each one as a style record.

## Phase C — request time (a user opens the page)

**C1. Host: route and lay out the page.** The host's own React shell renders the header, sidebar and one region per placement. Each region needs a UI tree.

**C2. Host: gather the widget's four inputs** (spec §7.1, §8):
- `params` come from the placement;
- `state` is this placement's persisted widget state (for example `{ filter: "all", cursor: null, selected: "t-4812" }`), read from the store;
- `data` is each data source named in the manifest, **resolved as the viewer**. The widget never fetches anything itself;
- `context` holds host-provided facts such as the time and the container size.

**C3. Host: run the widget in its sandbox.** `loadPlacement()` reads the placement, its package and its state from the store and verifies all three (spec §7.4). The host renders the package through its **runner**: its own sandbox (an isolate or a separate process for untrusted code), or Liveframe's in-process or worker runner for trusted code. Inside it, the widget calls the Liveframe SDK.

**C4. LF: `render(widget, inputs, { validator, surfaceId, revision })`** (spec §7.2, §10):
1. calls the widget function. Composed components expand into primitives, so only catalog kinds remain;
2. builds the UI tree. Each node gets a key-path id (`root/queue/row:t-4812/claim`) and holds `kind`, `variant`, `props`, `style` (declared style props only) and `events`. Each event carries an intent as data, such as `{ type: "action", name: "tasks.claim", args: { id: "t-4812" } }`;
3. validates the tree as it builds it: kinds exist, props match their schemas, children are allowed, style props are declared and use tokens, actions are in the manifest, keys are unique and size limits hold;
4. returns `{ ok: true, value: UiTree }`, or `{ ok: false, errors }` — every typed `WidgetError` (`host-element`, `undeclared-action`…), up to a bound of 20.

**C5. Host: transport** (spec §9). The host sends the JSON tree (`format`, `catalogId`, `surfaceId`, `revision`, `root`) to the browser over HTTP, SSE, IPC or embedded in server-side rendering. Liveframe does not define the transport.

## Phase D — in the browser

**D1. LF: project three independent sheets** (spec §6.4). The implemented `/css` subpath provides `baseCss(catalog)`, `themeCss(theme, catalog)` and `designSystemCss(system, { catalog, registry })`, each returning `Result<string>`. Generate them when installed inputs change, on the backend or in the browser, and cache them by input. They contain CSS variables (`--lf-c-text_muted`, `--lf-v-space_3`…) and one stable class per `(kind, variant, slot)`, with state selectors. **Host** loads the sheets and applies `surfaceAttributes({ theme, designSystem, tree })` to each surface root. Themes and design systems select independent sheets, so N themes and M systems need N + M + 1 sheets for a fixed catalog. Surfaces never nest. See the [styling guide](styling.md) for loading, CSP and the renderer contract.

**D2. LF: `<Surface tree validator theme designSystem onIntent fallback />`** (spec §11), from `createRenderer({ catalog, implementations })` in `@arnilo/liveframe/react`. See [the renderer guide](renderer.md) for implementations and host integration. The host mounts it in the placement's region. The renderer:
- re-checks the tree with the app's compiled validator before reading its fields, then ignores lower revisions for the same surface;
- looks up the host's React implementation for each node's `kind`;
- passes it validated props, `slot()` (recipe and root style-prop classes), `style`, rendered `children`, `emit()`, and a scoped `portal`; collection `items` expose each child's `id`, `kind`, `variant`, `props`, `slot()`, `style`, rendered `children`, `render()` and `emit()`;
- uses `styleDeclarations(style, catalog)` for token-constrained layout (`gap: var(--lf-v-space_3)`) and responsive classes;
- keys nodes by `id`, so focus, scroll and local state survive re-renders;
- renders a wrapper and sibling portal container with matching `surfaceAttributes({ theme, designSystem, tree })`, including `lf_surface` and `lf_container` for responsive trees; node slots carry no scope classes;
- draws the host's `fallback` for the whole surface if the tree is invalid; an implementation that throws falls back at that node only;
- checks emitted values against `carries` (a mismatch throws without raising an intent), fills missing `setState` values and action `args[bind]`, removes `bind`, then calls `onIntent` with the complete intent for the host to re-check.

**D3. Browser: the host's primitives produce the DOM.** The `button` implementation renders `<button class="lf_button_ghost_root …">`. The final DOM comes from the host's components; the look comes from the recipe classes and variables. Overlays retain the surface's scope through DOM ancestry or a portal container with matching scope attributes and classes; backdrop and content slots are siblings.

## Phase E — interaction (spec §8)

**Tier 1, local.** The user opens a menu. The host's `menu` primitive handles it in the browser. Nothing leaves the browser, and the widget does not re-run.

**Tier 2, `setState`.** The user clicks the "Mine" tab.
1. **LF:** the renderer sees the event's intent `{ type: "setState", key: "filter", value: "mine" }` and calls `onIntent`.
2. **Host:** checks the key against the state schema, saves the new state to the store (`putState`), and repeats C2–C4.
3. **LF:** the new tree has `revision + 1`. The renderer reconciles it by `id`, so unchanged nodes keep their DOM, and ignores any older revision.

**Tier 3, action.** The user clicks "Claim".
1. **LF:** passes `{ type: "action", name: "tasks.claim", args: { id: "t-4812" } }` to `onIntent`.
2. **Host:** checks that the action is in the widget's manifest and the args match its schema, authorises it **as the viewer**, asks for confirmation if it is irreversible, and runs it. It then usually re-renders the widget so the data reflects the change.

An intent carries no authority. It is a request the host may refuse.

**Theme or design-system switch.** The host preloads the sheets, sets `data-lf-switching` on the surface's scope containers, changes `data-lf-theme` and/or `data-lf-ds` together, commits the styles, then removes the marker on the next animation frame. Transitions are suppressed; no widget re-runs, tree changes or slot-class changes occur.

## Phase F — the next launch (spec §7.4)

Nothing that changed at runtime lives in the app's code, so a relaunch only reads the store back:

1. **Host:** loads its active theme and design system from their style records, and LF validates and projects them (B5, D1).
2. **Host:** lists the placements for the page and calls `loadPlacement()` for each.
3. **LF:** verifies each record. The package hash and manifest must match, the params must fit the package's params schema, and the state must fit its state schema. A state that no longer fits, after the placement moved to a new widget version, is reset to the manifest's initial state, and the reset is reported. A tampered or corrupt record is an error, never run.
4. The page renders as in Phase C.

Rolling back a widget means pointing its placement at an older version. Packages never change once stored, so the older version is still there.

## Performance: where the time goes

A local interaction (tier 1) makes no round trip. A `setState` or action makes **one** round trip, the same as a conventional app that calls an API on a click. What Liveframe adds is CPU on the host: running the widget and validating its tree. It also sends UI instead of data. It is slower only than an app that handles the same interaction entirely in the browser. A theme or design-system switch is cheaper than in most apps, because it is CSS only.

Measured in the Phase 0 proof on the artifact-faithful agent home (679 nodes, 50 rows; 2026-10-22, the setup of `proof/tests/agent-home.bench.ts`, each step timed separately; `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`):

| Step | Cost |
|---|---|
| `render()`: build and validate | ≈ 5.6 ms (8.3 µs per node) |
| The widget function itself (author TSX) | ≈ 0.12 ms |
| Validation alone | ≈ 3.2 ms |
| Building the tree | ≈ 2.1 ms |
| Checking the input data | ≈ 0.19 ms |
| `JSON.stringify` of the tree | ≈ 0.43 ms |
| Host `setState` round trip over local HTTP (max) | 7.7 ms |
| Design-system switch (max, warm) | 3.8 ms |

The author's code is about 2% of a render. The rest is library work done twice or needlessly, so a compiled language would not help: the tree is born in JavaScript, and moving it into WebAssembly would cost about as much as serialising it. Phase 1 must reach 3 µs per node. The levers, in order of payoff:

1. **One pass, compiled per catalog** (spec §10). Today the build pass checks every prop and the validator walks the whole tree again, interpreting schemas, building regexes per string and stringifying the tree to count its bytes. Generated straight-line checks, run once while the tree is built, remove most of that. Input data is checked once, when it is resolved, not on every render. This belongs in Phases 1 and 2.
2. **Budget against realistic sizes** (spec §7.1). The bench renders 50 rows; the real page shows a few at a time. Cost grows with node count, so widgets page or window their rows.
3. **Skip re-renders when inputs are unchanged** (spec §8). The host caches on widget version plus a hash of the inputs.
4. **Patches or compression only when a measurement calls for them** (spec §9). 75 KB of repetitive JSON gzips small, and the spec already defers patches until measured.

## Who owns what

| Concern | Liveframe | Host | Author | Browser |
|---|---|---|---|---|
| Which primitives exist | Definition format | Definitions and React code | — | Runs the compiled primitives |
| Page, routes, shell, placement | — | All of it | — | — |
| Widget code | SDK, JSX runtime, `render()`, validator, `pack()`, reference runners | Sandbox (its runner), approval | Writes widgets, manifests and scenarios | Never runs it |
| Preview | Sessions, `<Preview>`, `liveframe preview capture` | The preview page and its transport | Iterates on the draft | Draws the draft's trees |
| Data | — | Resolves sources as the viewer | Names sources in the manifest | — |
| State | Carries it as input and intents | Persists it per placement | Declares its schema and initial value | Local primitive state only |
| Persistence | Record formats, `Store` interface, reference stores, verification on load | Backend, tenancy, the active theme and design system | — | — |
| Actions | Carries intents as data | Authorises and executes | Names actions in the manifest | Raises the event |
| Look | Formats, resolver, three-sheet `/css` projection, slot/style/scope helpers | Declared vocabulary, primitive structural CSS, sheet loading and CSP, scope attributes, theme selection and switching | May supply themes and design systems as validated data | Applies scoped CSS, state selectors and environment preferences |
| Transport | — | All of it | — | Receives the tree |

## Where styling expressiveness is controlled

The look of a surface is controlled by four separate dials. Each belongs to a different role.

| Dial | Controls | Owner | Where in the pipeline |
|---|---|---|---|
| **1. Recipe and typography vocabulary** | Which properties a recipe or typography role may set | **Liveframe** (the format, validator and projection) | B5, D1 |
| **2. Recipe addresses** | Which `(kind, variant, slot, state)` keys exist, and that each slot is rendered | **Host** (catalog and primitive code) | A1, A2 |
| **3. Values** | The roles, design values and recipe contents | **Theme and design-system author** | B5 |
| **4. Composition** | Which primitives, variants and style props a widget uses | **Widget author** | B1 |

An author fills dials 3 and 4, and can only express what dials 1 and 2 allow.

The boundary between dials 1 and 4 is fixed (spec §6.2, `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`): **recipes own the look, and style props own the structure.** Colour, borders, radius, padding, typography, shadow and motion are recipe and theme data, and change with the design system. Display mode, flex and grid layout, tracks, content alignment, size and position are style props chosen by the widget, and survive a design-system switch.

The Phase 0 parity work showed what this means in practice. The agent-home artifact's look gaps (`proof/GAPS.md`) were not missing primitives: they were missing look vocabulary (dial 1), or structure the widget had not yet expressed (dial 4).
