// The renderer browser cases, shared by `/conformance/react` and `/conformance/dom`. They drive the app-owned page
// through `window.liveframeConformance` and never launch a browser or a server; an adapter supplies only what
// differs in how it mounts.
import type { Locator, Page } from "playwright";
import {
  checkOffered,
  compileValidator,
  type TreeIntent,
  type UiNode,
  type UiTree,
  validateCatalog,
} from "../../index.ts";
import { type ConformanceCase, ConformanceFailure, check } from "../case.ts";
import { type LifecycleFixtures, lifecycleCases } from "./overlays.ts";
import type { Styles, SuiteOptions } from "./page.ts";
import { type StateFixtures, styledStates } from "./states.ts";

type Target = (page: Page) => Locator;
type Interaction = { tree: UiTree; act(page: Page): Promise<unknown>; intents: readonly unknown[] };
export type BrowserFixtures = LifecycleFixtures & {
  states?: StateFixtures;
  interactions: readonly Interaction[];
  survival: { tree: UiTree; next: UiTree; focus: Target; scroll?: Target; input?: Target };
  /** A node gated by `when` on local state, hidden at first; `show` and `hide` raise `setLocal` events that draw and remove it. */
  local?: { tree: UiTree; show(page: Page): Promise<unknown>; hide(page: Page): Promise<unknown>; gated: Target };
  /** `act` raises a host intent that carries `local` writes; one of them draws the hidden node `gated` locates. */
  compound?: Interaction & { gated: Target };
  /** `act` writes local state, then raises an action that reads arguments `fromLocal`. */
  fromLocal?: Interaction;
  /** `next` is a later revision of `tree` whose `focus` names a different node: the one `target` locates. */
  focus?: { tree: UiTree; next: UiTree; target: Target };
};

/** Every intent of every node in a tree. */
function intentsOf(tree: UiTree): TreeIntent[] {
  const found: TreeIntent[] = [];
  const pending: UiNode[] = [tree.root];
  for (const node of pending) {
    found.push(...Object.values(node.events ?? {}));
    pending.push(...(node.children ?? []));
  }
  return found;
}
function hasGate(tree: UiTree): boolean {
  const pending: UiNode[] = [tree.root];
  for (const node of pending) {
    if (node.when !== undefined) return true;
    pending.push(...(node.children ?? []));
  }
  return false;
}
function need<T>(fixture: T | undefined, rule: string, field: string): T {
  check(fixture, rule, "§13", [`Missing ${field} fixture`]);
  return fixture as T;
}

export type BrowserSuiteOptions = SuiteOptions & {
  page(): Page | Promise<Page>;
  url: string;
  fixtures: BrowserFixtures;
};

/** What differs between adapters in the shared cases. */
export type BrowserAdapter = {
  /** The markup of the app's fallback as the page draws it, for comparison with the wrapper's content. */
  fallbackMarkup(page: Page): Promise<string>;
};

export type BrowserCase = (page: Page, styles: Styles, rule: string) => Promise<void>;

/** The shared cases, by name, in suite order. */
export function browserCases(options: BrowserSuiteOptions, adapter: BrowserAdapter): Record<string, BrowserCase> {
  async function mount(page: Page, tree: unknown, styles: Styles, invalid?: "fallback" | "keep-last") {
    await page.evaluate(({ tree, styles, invalid }) => window.liveframeConformance.mount(tree, styles, invalid), {
      tree,
      styles,
      invalid,
    });
    await settle(page);
  }
  async function interact(
    page: Page,
    styles: Styles,
    rule: string,
    fixture: Interaction,
    before?: () => Promise<void>,
  ) {
    await open(page);
    await mount(page, fixture.tree, styles);
    await before?.();
    const errors: string[] = [];
    const capture = (error: Error) => {
      errors.push(String(error));
    };
    page.on("pageerror", capture);
    try {
      await fixture.act(page);
      await settle(page);
      const emissions = await page.evaluate(() => window.liveframeConformance.emissions());
      const actual = emissions.map(({ intent }) => intent);
      const validator = compileValidator(options);
      for (const { intent, origin } of emissions) {
        const offered = checkOffered(fixture.tree, origin, intent, validator);
        check(offered.ok, rule, "§8", offered.ok ? [] : offered.errors);
      }
      check(!errors.length && equal(actual, fixture.intents), rule, "§8", [
        ...errors,
        `Expected ${JSON.stringify(fixture.intents)}; received ${JSON.stringify(actual)}`,
      ]);
    } finally {
      page.off("pageerror", capture);
    }
  }
  const open = (page: Page) => openPage(page, options.url);
  const cases = {
    async invalid_arrival_shows_only_the_fallback_and_recovers(page: Page, styles: Styles, rule: string) {
      const tree = options.fixtures.survival.tree;
      await mount(page, tree, styles);
      const before = await page.evaluate(() => window.liveframeConformance.renders());
      const catalog = validateCatalog(options.catalog);
      check(catalog.ok, rule, "§11", catalog.ok ? [] : catalog.errors);
      let kind = "conformanceUnknownKind";
      while (catalog.value.definitions.some((definition) => definition.kind === kind)) kind += "X";
      await mount(page, { ...tree, root: { ...tree.root, kind } }, styles);
      const fallback = await page.locator("[data-lf-conformance] > .lf_surface").first().innerHTML();
      const expected = await adapter.fallbackMarkup(page);
      check(fallback === expected, rule, "§11", ["Invalid arrival must show only the fallback"]);
      check((await page.evaluate(() => window.liveframeConformance.renders())) === before, rule, "§11", [
        "Invalid arrival called an implementation",
      ]);
      await mount(page, { ...tree, revision: tree.revision + 1 }, styles);
      check((await page.evaluate(() => window.liveframeConformance.renders())) > before, rule, "§11", [
        "Valid arrival did not recover",
      ]);
    },
    async keep_last_invalid_arrival_keeps_the_last_tree_marked(page: Page, styles: Styles, rule: string) {
      const tree = options.fixtures.survival.tree;
      await mount(page, tree, styles, "keep-last");
      const before = await page.evaluate(() => {
        const wrapper = document.querySelector("[data-lf-conformance] > .lf_surface");
        (window as { keptNodes?: Element[] }).keptNodes = [...(wrapper?.querySelectorAll("*") ?? [])];
        return window.liveframeConformance.renders();
      });
      await mount(page, { ...tree, revision: tree.revision + 1, catalogId: `${tree.catalogId}X` }, styles, "keep-last");
      const kept = await page.evaluate(() => {
        const wrapper = document.querySelector("[data-lf-conformance] > .lf_surface");
        const nodes = (window as { keptNodes?: Element[] }).keptNodes ?? [];
        return {
          nodes: nodes.length > 0 && nodes.every((node) => node.isConnected),
          stale: wrapper?.getAttribute("data-lf-stale") === "" && wrapper.getAttribute("aria-busy") === "true",
        };
      });
      check(kept.nodes && kept.stale, rule, "§11", [
        `Keep-last must keep the last tree's nodes (${kept.nodes}) and mark the wrapper stale (${kept.stale})`,
      ]);
      check((await page.evaluate(() => window.liveframeConformance.renders())) === before, rule, "§11", [
        "Rejected arrival called an implementation",
      ]);
      await mount(page, { ...tree, revision: tree.revision + 2 }, styles, "keep-last");
      const cleared = await page.locator("[data-lf-conformance] > .lf_surface[data-lf-stale]").count();
      check(cleared === 0, rule, "§11", ["Accepted arrival did not clear the stale mark"]);
    },
    async interactions_raise_one_complete_intent(page: Page, styles: Styles, rule: string) {
      check(options.fixtures.interactions.length, rule, "§13", ["Missing interaction fixtures"]);
      // Start each interaction on a fresh page so local state and intents cannot leak.
      for (const fixture of options.fixtures.interactions) await interact(page, styles, rule, fixture);
    },
    async when_false_node_is_not_drawn(page: Page, styles: Styles, rule: string) {
      const f = need(options.fixtures.local, rule, "local");
      check(hasGate(f.tree), rule, "§13", ["The local fixture's tree must gate a node with `when`"]);
      await mount(page, f.tree, styles);
      check((await f.gated(page).count()) === 0, rule, "§8", ["A node whose `when` is false was drawn on arrival"]);
      await f.show(page);
      await settle(page);
      check((await f.gated(page).count()) > 0, rule, "§8", ["A node whose `when` turned true was not drawn"]);
      await f.hide(page);
      await settle(page);
      check((await f.gated(page).count()) === 0, rule, "§8", ["A node whose `when` turned false is still drawn"]);
    },
    async set_local_redraws_and_never_reaches_the_host(page: Page, styles: Styles, rule: string) {
      const f = need(options.fixtures.local, rule, "local");
      check(
        intentsOf(f.tree).some((intent) => intent.type === "setLocal"),
        rule,
        "§13",
        ["The local fixture's tree must carry a `setLocal` event"],
      );
      await mount(page, f.tree, styles);
      await f.show(page);
      await settle(page);
      check((await f.gated(page).count()) > 0, rule, "§8", ["`setLocal` did not change what is drawn"]);
      const sent = await page.evaluate(() => window.liveframeConformance.emissions());
      // Law 4: local state is the browser's own and never reaches the host as an intent.
      check(sent.length === 0, rule, "§8", [`\`setLocal\` reached onIntent: ${JSON.stringify(sent)}`]);
    },
    async local_writes_apply_with_one_complete_host_intent(page: Page, styles: Styles, rule: string) {
      const f = need(options.fixtures.compound, rule, "compound");
      check(
        intentsOf(f.tree).some((intent) => intent.type !== "setLocal" && intent.local !== undefined),
        rule,
        "§13",
        ["The compound fixture's tree must carry a host intent with `local` writes"],
      );
      await interact(page, styles, rule, f, async () => {
        check((await f.gated(page).count()) === 0, rule, "§13", ["The compound fixture's node must start hidden"]);
      });
      check((await f.gated(page).count()) > 0, rule, "§8", ["The intent's local writes were not applied"]);
    },
    async from_local_intent_arrives_complete(page: Page, styles: Styles, rule: string) {
      const f = need(options.fixtures.fromLocal, rule, "fromLocal");
      check(
        intentsOf(f.tree).some((intent) => intent.type !== "setLocal" && intent.fromLocal !== undefined),
        rule,
        "§13",
        ["The fromLocal fixture's tree must carry an intent that reads `fromLocal`"],
      );
      await interact(page, styles, rule, f);
    },
    async focus_mark_moves_focus_once(page: Page, styles: Styles, rule: string) {
      const f = need(options.fixtures.focus, rule, "focus");
      check(
        f.next.surfaceId === f.tree.surfaceId &&
          f.next.revision > f.tree.revision &&
          f.next.focus !== undefined &&
          f.next.focus !== f.tree.focus,
        rule,
        "§13",
        ["The focus fixture's next must be a later revision of tree with a different `focus`"],
      );
      const blur = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const focused = () => f.target(page).evaluate((element) => element.contains(document.activeElement));
      await mount(page, f.tree, styles);
      await blur();
      await mount(page, f.next, styles);
      const events = await page.evaluate(() => window.liveframeConformance.events());
      check(await focused(), rule, "§11", [
        `A changed focus mark did not move focus to ${f.next.focus}; it must reach the element with the node's domId`,
        ...events.filter((event) => event.type === "focus-missed").map((event) => JSON.stringify(event)),
      ]);
      // The user moves on; a revision with the same mark must leave focus where the user put it.
      await blur();
      await mount(page, { ...f.next, revision: f.next.revision + 1 }, styles);
      check(!(await focused()), rule, "§11", ["An unchanged focus mark moved focus again"]);
    },
    async focus_scroll_and_local_state_survive_revisions(page: Page, styles: Styles, rule: string) {
      const f = options.fixtures.survival;
      check(f.next.surfaceId === f.tree.surfaceId && f.next.revision > f.tree.revision, rule, "§13", [
        "Survival next must have the same surfaceId and a higher revision",
      ]);
      await mount(page, f.tree, styles);
      if (f.input) await f.input(page).fill("uncommitted draft");
      await f.focus(page).focus();
      const focused = await f.focus(page).elementHandle();
      const input = f.input ? await f.input(page).inputValue() : undefined;
      let scroll: number | undefined;
      if (f.scroll) {
        scroll = await f.scroll(page).evaluate((element) => {
          element.scrollTop = 40;
          return element.scrollTop;
        });
        check(scroll > 0, rule, "§13", ["Survival scroll fixture must overflow"]);
      }
      let acceptedMarkup: string | undefined;
      for (const tree of [f.next, f.tree]) {
        await mount(page, tree, styles);
        const markup = await page.locator("[data-lf-conformance]").innerHTML();
        if (acceptedMarkup !== undefined)
          check(markup === acceptedMarkup, rule, "§11", ["Stale arrival changed the accepted DOM"]);
        acceptedMarkup = markup;
        check(
          await f
            .focus(page)
            .evaluate((element, previous) => element === previous && element === document.activeElement, focused),
          rule,
          "§11",
          ["Focus or node identity lost across revision/reorder"],
        );
        if (f.input) check((await f.input(page).inputValue()) === input, rule, "§11", ["Uncommitted input lost"]);
        if (f.scroll) {
          const actual = await f.scroll(page).evaluate((element) => element.scrollTop);
          check(actual === scroll, rule, "§11", [
            `Scroll offset lost: expected ${scroll}, received ${actual}, revision ${tree.revision}`,
          ]);
        }
      }
      await focused?.dispose();
    },
    async switching_keeps_nodes_and_focus_and_rerenders_nothing(page: Page, styles: Styles, rule: string) {
      check(
        new Set(options.themes.map((theme) => `${theme.id}@${theme.version}`)).size > 1 &&
          new Set(options.designSystems.map((system) => `${system.id}@${system.version}`)).size > 1,
        rule,
        "§13",
        ["Switching needs two theme and design-system identities"],
      );
      await mount(page, options.fixtures.survival.tree, styles);
      await options.fixtures.survival.focus(page).focus();
      const snapshot = await page.evaluateHandle(() => ({
        nodes: [...document.querySelectorAll("[data-lf-conformance] *")],
        focus: document.activeElement,
        renders: window.liveframeConformance.renders(),
      }));
      for (const theme of options.themes)
        for (const designSystem of options.designSystems) {
          await page.evaluate((styles) => window.liveframeConformance.switch(styles), {
            theme: { id: theme.id, version: theme.version },
            designSystem: { id: designSystem.id, version: designSystem.version },
          });
          await settle(page);
          check(
            await page
              .locator("[data-lf-conformance] > .lf_surface")
              .evaluateAll(
                (scopes, styles) =>
                  scopes.length === 2 &&
                  scopes.every(
                    (scope) =>
                      scope.getAttribute("data-lf-theme") === `${styles.theme.id}@${styles.theme.version}` &&
                      scope.getAttribute("data-lf-ds") === `${styles.designSystem.id}@${styles.designSystem.version}`,
                  ),
                { theme, designSystem },
              ),
            rule,
            "§6.4",
            ["Switch did not apply both scope identities"],
          );
          check(
            await page.evaluate(
              (previous) =>
                previous.nodes.every((node) => node.isConnected) &&
                previous.focus === document.activeElement &&
                previous.renders === window.liveframeConformance.renders(),
              snapshot,
            ),
            rule,
            "§6.4",
            ["Switch replaced nodes, lost focus or rendered an implementation"],
          );
        }
      await snapshot.dispose();
    },
    async every_styled_state_is_reachable(page: Page, styles: Styles, rule: string) {
      await styledStates(
        options,
        options.fixtures.states,
        page,
        rule,
        async (tree) => {
          // Fallback unmounts primitive state without reloading the adopter's bundle per fixture.
          await mount(page, { ...tree, root: { ...tree.root, kind: "" } }, styles);
          await mount(page, tree, styles);
        },
        () => settle(page),
      );
    },
    ...lifecycleCases(
      options,
      async (page, tree, styles) => {
        await open(page);
        await mount(page, tree, styles);
      },
      settle,
    ),
  };
  return cases;
}

/** Opens the page and waits for the conformance API. */
export async function openPage(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => !!window.liveframeConformance);
}

/** Two frames: lets the page commit, run layout effects and style what it drew. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** Runs each named case on a fresh page per theme and design system. */
export function browserSuiteCases(options: BrowserSuiteOptions, cases: Record<string, BrowserCase>): ConformanceCase[] {
  const open = (page: Page) => openPage(page, options.url);
  return Object.entries(cases).map(([name, run]) => ({
    name,
    timeout: 120000,
    async run() {
      let page: Page | undefined;
      try {
        check(options.themes.length && options.designSystems.length, name, "§13", ["Missing themes or design systems"]);
        page = await options.page();
        page.setDefaultTimeout(10000);
        for (const theme of options.themes)
          for (const designSystem of options.designSystems) {
            await open(page);
            await run(
              page,
              {
                theme: { id: theme.id, version: theme.version },
                designSystem: { id: designSystem.id, version: designSystem.version },
              },
              name,
            );
          }
      } catch (error) {
        if (error instanceof ConformanceFailure) throw error;
        throw new ConformanceFailure(name, "§11", [String(error)]);
      } finally {
        await page?.close();
      }
    },
  }));
}
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a),
    right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, value]) => Object.hasOwn(b, key) && equal(value, (b as Record<string, unknown>)[key]))
  );
}
