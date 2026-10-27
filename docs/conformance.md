# Prove your app's Liveframe contracts

The conformance kit checks what your app supplies to Liveframe: its catalog,
themes, design systems, primitive implementations and store. Run it in CI when
any of those change. It ships no primitives, visual style, server or test runner.
The package is pre-release; use the subpaths exposed by your checkout.

| Suite | What it proves | What it leaves to your app or the library's tests |
| --- | --- | --- |
| `storeSuite` | Empty/missing records, keyed placement reads, immutable package versions (typed rejection), every valid id including long and non-ASCII ones, copy isolation, sorted placements, state deletion, style keys, loadable records and a malformed sibling not blocking a load; persistence when `reopen` is supplied | Transactions, concurrent writers, tenant boundaries, authorization and durability under crashes |
| `catalogSuite` | Catalog, capabilities and manifest install; valid examples cover every kind/variant; version compatibility when `published` is supplied | The library's validator algorithm, SDK internals and whether your primitives are accessible |
| `designSystemSuite` | Themes/design systems install, inheritance and recipe completeness, CSS projection, and no literal colour in supplied app sheets | External imported sheets, pixel parity, native platform/assistive-technology audits and the library's CSS selector/preference algorithms |
| `rendererSuite` | Complete implementation registry, successful server rendering for each example × theme × design system, root slot/style output, and fallback-only invalid arrivals with no implementation calls | Content deferred until client mount, browser interactions and the renderer's internal caching/error-boundary machinery |
| `rendererBrowserSuite` | Hydration, arrival rejection/recovery, expected complete intents, focus/scroll/draft survival, switching without renders, styled-state reachability, declared overlay lifecycle and text bounds | Undeclared overlay/input roles, unprovided interaction scenarios, timing budgets, production authorization and unsupported nested surfaces |

**Passing these suites does not prove isolation or authorization** (spec §14).
Reference runners are not sandboxes. The backend still resolves data as the
viewer, checks completed intents and revisions, and decides whether to execute
an action. The test page records intents; it never dispatches actions.

## Register cases with your test runner

`@arnilo/liveframe/conformance` needs neither React nor Playwright. Each suite
returns `ConformanceCase[]`: `{ name, run, timeout? }`. `run()` returns a promise;
`timeout` is milliseconds. Register cases inside a runner group when testing
multiple subjects, so their rule names remain distinguishable.

Supply `./host.ts` with your installed `catalog`, `capabilities`, a compatible
`manifest`, and `examples` (validated JSON UI trees). Its `styles` contains
`{ catalog, themes, designSystems, sheets }`; supply every installed inheritance
parent, and the contents of every app-owned CSS sheet. These can be a separate
catalog's styles if you test several catalogs. `sheets` is optional, but omitting
it omits the app-colour check. The scanner does not fetch `@import` URLs: supply
the imported contents too.

```ts
import { test } from "bun:test";
import { catalogSuite, designSystemSuite, storeSuite } from "@arnilo/liveframe/conformance";
import { memoryStore } from "@arnilo/liveframe/store";
import { catalog, capabilities, manifest, examples, styles } from "./host.ts";

const cases = [
  ...storeSuite({ create: () => memoryStore() }),
  ...catalogSuite({ catalog, capabilities, manifest, examples, published: catalog }),
  ...designSystemSuite(styles),
];
for (const c of cases) test(c.name, c.run, c.timeout);
```

Use `import { test } from "vitest"` for Vitest, or
`import { test } from "@jest/globals"` for Jest; the registration loop is the
same. Configure those runners to compile your TypeScript/ES modules normally.
This repository executes the examples with Bun; Vitest/Jest execution has not
been verified here. The signatures were checked during plan 010 Task 1.

Replace `memoryStore()` with your own store factory to test its backend. Each
`create()` must return a fresh, empty, isolated scope, even if cases run in
parallel. It may return a promise. For persistent stores add `reopen(store)` to
open the **same scope** through a new store instance; otherwise the persistence
case is absent. The caller owns cleanup after the cases finish. Never point the
suite at production data.

`published` is your previously released catalog, not normally the new catalog
as in this smoke example. Omitting it omits the compatibility case. Breaking
changes must keep the catalog name and increase its major suffix; compatible
changes keep the same `catalogId`.

Every `(kind, variant)` needs a node in at least one catalog example, including
default variants. All trees must fit the supplied manifest and capabilities;
use a dedicated test manifest that permits their events. Missing coverage fails
with the missing pairs rather than silently skipping them.

## Supply a browser page and renderer cases

Use `@arnilo/liveframe/conformance/react` for renderer work. It requires the
optional React and React DOM peers; browser tests also need your Playwright
installation and browser. The kit uses Playwright types and does not launch a
browser, bundle code or serve a page.

Your `./renderer-host.ts` exports `pageOptions: PageOptions`, containing
`{ catalog, capabilities, manifest, implementations, themes, designSystems,
fallback }`. Here `themes` and `designSystems` are complete, installed documents,
not just identities. Share this configuration between the test process and the
page. Load your primitives' structural CSS in the page as well.

The app-owned page entry is:

```ts
import { conformancePage } from "@arnilo/liveframe/conformance/react";
import { pageOptions } from "./renderer-host.ts";

conformancePage(pageOptions);
```

Bundle and serve that entry in an otherwise empty HTML test page with your usual
app tools. Use **development or profiling React**: ordinary production React
disables `Profiler` callbacks and the page fails with an actionable message
instead of hiding descendant renders. Import no widgets, package loader or
backend host module into the client entry. Only trees cross into the page.

`conformancePage` installs the projected sheets and exposes
`window.liveframeConformance`: `mount(tree, styles)`,
`hydrate(markup, tree, styles)`, `switch(styles)`, `intents()` and `renders()`.
`styles` has `{ theme: { id, version }, designSystem: { id, version } }`, naming
installed documents. Normally the browser suite drives these methods. Fixture
callbacks can mount a higher-revision tree to model a host response; they must
retain the current style identities.

In your test process, create the cases with this compiled helper, then register
them with the same loop above:

```ts
import type { Page } from "playwright";
import { type BrowserFixtures, type PageOptions, rendererBrowserSuite, rendererSuite } from "@arnilo/liveframe/conformance/react";

function rendererCases(
  options: PageOptions,
  serverExamples: readonly unknown[],
  hydrationExamples: readonly unknown[],
  fixtures: BrowserFixtures,
  page: () => Promise<Page>,
  url: string,
) {
  return [
    ...rendererSuite({ ...options, examples: serverExamples }),
    ...rendererBrowserSuite({ ...options, examples: hydrationExamples, fixtures, page, url }),
  ];
}
```

Call `rendererCases(pageOptions, serverExamples, hydrationExamples, fixtures,
() => browser.newPage(), url)` during test registration. Start your server and
browser in the runner's before-all hook and close them in its after-all hook;
the callback reads `browser` when a case runs. Each browser case requests its
own page, navigates to `url`, crosses every theme × design-system pair and
closes the page in `finally`. Supply at least two distinct theme identities and
two design-system identities for switching. Browser cases carry 120-second
runner timeouts and use 10-second Playwright operation timeouts.

Keep example sets explicit:

- Catalog examples cover all kinds and variants.
- Server root-presence examples must have **SSR-visible nodes**. Portals are
  undefined until mount; overlay content, inactive panels and menu items may
  deliberately emit no server markup. Use fixtures whose nodes are visible on
  the server for root checks; missing roots are never silently exempted.
- Hydration examples can include deferred content: the server output must
  hydrate without warnings or recoverable errors. Browser interaction/state/
  overlay fixtures must then open that content and exercise it after mount.

## Describe your app's interactions and lifecycle

Export fixtures typed as `BrowserFixtures`. Locators are functions
`(page: Page) => Locator`, targeting your actual controls and affected slots.
They must work across all supplied themes and design systems. Use genuine user
interaction and tree props; do not manufacture state attributes in the DOM.

| Fixture field | Required contents and behavior |
| --- | --- |
| `interactions` | Nonempty array of `{ tree, act(page), intents }`. Drive local interactions with expected `[]`; supply state/action interactions with the exact complete intent array. Each entry starts on a fresh page. |
| `survival` | `{ tree, next, focus, scroll?, input? }`. `next` has the same surface id and a higher revision; retain stable node ids/ancestry, and reorder relevant siblings. `focus` locates a focusable element. Optional `scroll` must actually overflow; optional `input` holds an uncommitted draft. The suite also sends the old tree as a stale arrival. |
| `states` | Map from `"kind.variant.state"` to `{ tree, target, drive? }`. Required for every non-rest state whose resolved declarations differ from rest in any installed system. `target` carries the root slot class or an affected slot's class and must match the spec §6.4 selector. Without `drive`, hover/active are driven automatically; other states come from tree props. Supply `drive` for keyboard focus or opening deferred content. Missing keys are reported. |
| `overlayKinds` | Array declaring **every overlay kind in your app**, e.g. `["dialog"]`. The catalog does not identify overlays. |
| `overlays` | One or more `{ kind, tree, open, close, content, backdrop, background, exitCss }` entries covering each declared overlay kind. Each validated tree contains its explicit `kind`. Mount a **closed tree**, then let `open(page)` open it after the portal mounts. `close(page)` requests closure. Locators identify the content, backdrop and a background control. |
| `textInputKinds` | Array declaring **every bounded text-input kind**, e.g. `["textField"]`. The catalog does not identify text inputs. |
| `textInputs` | Entries `{ kind, tree, field, maxLength }` covering each declared input kind. Use an initially empty bounded field and a carried-value event so typing/blur emits the complete string intent. The suite types astral characters past the bound and checks both the field and latest emitted value by Unicode code point. Native HTML `maxlength` counts UTF-16 units and is insufficient. |

Use empty declaration arrays only when the app has no such kinds. Omitting the
arrays leaves those roles undeclared; the kit cannot discover that omission.
Declaring a kind without its fixture fails and names the kind.

For overlays, `background(page)` must locate a real background control even
while hidden from accessibility queries (for example, use `includeHidden: true`
with a role locator). The page must scroll while the overlay is closed. The
suite checks scroll locking, inert/hidden background ancestry, pointer hit testing
against the backdrop and no background intent while open. Both content and
backdrop must retain the surface's theme/design-system scope. Backdrop ancestors
must have opacity 1 and no filter that prevents sampling the page behind them.

Supply `exitCss` that starts a measurable exit animation on your implementation's
exit marker, even if the installed recipes have no exit motion. Include a
`prefers-reduced-motion: reduce` override disabling that animation. The suite
requires content to stay mounted through exit and disappear afterward; reduced
motion must start no exit animation. A known proof implementation issue with
initially-open dialogs remains tracked in plan 010 Task 10; closed-then-open
fixtures do not establish that separate first-arrival behavior.

## Read failures and reproduce the examples

A failed case rejects with `ConformanceFailure`, an `Error` with `rule`, `spec`
and bounded `details` (strings or `LiveframeError` entries). Report all three;
validation diagnostics include JSON pointers. Fix the named implementation or
missing fixture instead of filtering out a case to get a pass.

[`conformance-guide.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/conformance-guide.test.ts) compiles
and registers the data examples against the memory store and shared proof data,
checks the documented snippets against their executable sources, runs the
server cases and hydrates the documented page entry in Chromium. The dedicated
conformance tests separately run full browser fixtures and broken subjects.
Vitest/Jest, other browsers, pixel parity and a native accessibility audit are
separate evidence, not established by this guide test.
