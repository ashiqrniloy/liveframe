import type { Locator, Page } from "playwright";
import { compileValidator, type UiTree, validateCatalog } from "../../index.ts";
import { check } from "../case.ts";
import type { PageOptions, Styles } from "./page.tsx";

type Target = (page: Page) => Locator;
export type LifecycleFixtures = {
  overlayKinds?: readonly string[];
  overlays?: readonly {
    kind: string;
    tree: UiTree;
    open(page: Page): Promise<unknown>;
    close(page: Page): Promise<unknown>;
    content: Target;
    backdrop: Target;
    background: Target;
    exitCss: string;
  }[];
  textInputKinds?: readonly string[];
  textInputs?: readonly { kind: string; tree: UiTree; field: Target; maxLength: number }[];
};

export function lifecycleCases(
  options: PageOptions & { fixtures: LifecycleFixtures },
  mount: (page: Page, tree: UiTree, styles: Styles) => Promise<void>,
  settle: (page: Page) => Promise<void>,
) {
  function coverage(
    declared: readonly string[] = [],
    fixtures: readonly { kind: string; tree: UiTree }[] = [],
    rule: string,
  ) {
    const catalog = validateCatalog(options.catalog);
    check(catalog.ok, rule, "§13", catalog.ok ? [] : catalog.errors);
    const missing = declared.filter((kind) => !fixtures.some((fixture) => fixture.kind === kind));
    check(!missing.length, rule, "§13", [`Missing fixtures for: ${missing.join(", ")}`]);
    const validator = compileValidator(options);
    for (const fixture of fixtures) {
      check(
        catalog.value.definitions.some((d) => d.kind === fixture.kind),
        rule,
        "§13",
        [`Unknown fixture kind: ${fixture.kind}`],
      );
      const result = validator.validateTree(fixture.tree);
      check(result.ok, rule, "§13", result.ok ? [] : result.errors);
      const nodes = [fixture.tree.root];
      let found = false;
      for (const node of nodes) {
        if (node.kind === fixture.kind) found = true;
        nodes.push(...(node.children ?? []));
      }
      check(found, rule, "§13", [`Fixture tree does not contain ${fixture.kind}`]);
    }
  }
  function overlays(rule: string) {
    coverage(options.fixtures.overlayKinds, options.fixtures.overlays, rule);
    return options.fixtures.overlays ?? [];
  }
  async function open(page: Page, styles: Styles, fixture: NonNullable<LifecycleFixtures["overlays"]>[number]) {
    await mount(page, fixture.tree, styles);
    await page.addStyleTag({ content: fixture.exitCss });
    await fixture.open(page);
    await fixture.content(page).waitFor({ state: "visible" });
    await settle(page);
  }
  return {
    async overlay_keeps_surface_scope(page: Page, styles: Styles, rule: string) {
      for (const fixture of overlays(rule)) {
        await open(page, styles, fixture);
        for (const target of [fixture.content, fixture.backdrop]) {
          check(
            await target(page).evaluate((element, styles) => {
              const scope = element.closest("[data-lf-conformance] > .lf_surface");
              return (
                scope?.getAttribute("data-lf-theme") === `${styles.theme.id}@${styles.theme.version}` &&
                scope?.getAttribute("data-lf-ds") === `${styles.designSystem.id}@${styles.designSystem.version}`
              );
            }, styles),
            rule,
            "§11",
            [`${fixture.kind}: overlay escaped its surface scope`],
          );
        }
        check(
          await fixture.backdrop(page).evaluate((element) => {
            for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
              const style = getComputedStyle(ancestor);
              if (Number(style.opacity) !== 1 || style.filter !== "none") return false;
            }
            return true;
          }),
          rule,
          "§11",
          [`${fixture.kind}: backdrop ancestor has opacity or a filter`],
        );
      }
    },
    async overlay_exit_finishes_before_unmount(page: Page, styles: Styles, rule: string) {
      for (const fixture of overlays(rule)) {
        for (const reduced of [false, true]) {
          await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
          await open(page, styles, fixture);
          const content = await fixture.content(page).elementHandle();
          const motion = await fixture.backdrop(page).evaluateHandle((element, content) => {
            const state = {
              element,
              started: false,
              ended: false,
              cancelled: false,
              mounted: false,
              earlyContent: false,
              observer: new MutationObserver(() => {
                if (state.started && !state.ended && element.isConnected && !content?.isConnected)
                  state.earlyContent = true;
              }),
            };
            element.addEventListener("animationstart", () => {
              state.started = true;
              state.mounted = element.isConnected && Boolean(content?.isConnected);
            });
            element.addEventListener("animationend", () => {
              state.ended = true;
            });
            element.addEventListener("animationcancel", () => {
              state.cancelled = true;
            });
            state.observer.observe(document.body, { childList: true, subtree: true });
            return state;
          }, content);
          try {
            await fixture.close(page);
            if (!reduced) {
              await page.waitForFunction((state) => state.started || !state.element.isConnected, motion);
              check(
                await motion.evaluate((state) => state.started && state.mounted && !state.earlyContent),
                rule,
                "§11",
                [`${fixture.kind}: unmounted before exit animation`],
              );
              await page.waitForFunction((state) => state.ended || state.cancelled, motion);
              check(
                await motion.evaluate((state) => state.ended && !state.cancelled && !state.earlyContent),
                rule,
                "§11",
                [`${fixture.kind}: exit animation did not finish before unmount`],
              );
            }
            await fixture.backdrop(page).waitFor({ state: "detached" });
            await fixture.content(page).waitFor({ state: "detached" });
            if (reduced)
              check(!(await motion.evaluate((state) => state.started)), rule, "§11", [
                `${fixture.kind}: exit animation started under reduced motion`,
              ]);
          } catch (error) {
            check(false, rule, "§11", [
              `${fixture.kind} (reducedMotion=${reduced}): ${String(error)}`,
              JSON.stringify(
                await motion.evaluate((state) => ({
                  started: state.started,
                  ended: state.ended,
                  cancelled: state.cancelled,
                  earlyContent: state.earlyContent,
                  connected: state.element.isConnected,
                  animations: state.element.getAnimations().map((a) => a.playState),
                })),
              ),
            ]);
          } finally {
            await motion.evaluate((state) => state.observer.disconnect());
            await motion.dispose();
            await content?.dispose();
          }
        }
      }
    },
    async open_overlay_locks_scroll_and_makes_background_inert(page: Page, styles: Styles, rule: string) {
      for (const fixture of overlays(rule)) {
        await mount(page, fixture.tree, styles);
        await page.addStyleTag({ content: "body { min-height: 3000px }" });
        // Prove the page can scroll before testing the implementation's lock.
        await page.mouse.move(5, 5);
        // Fixtures may mount already open; close them to establish the unlocked baseline.
        await fixture.open(page);
        await fixture.close(page);
        await fixture.content(page).waitFor({ state: "detached" });
        await page.mouse.wheel(0, 180);
        await page.waitForFunction(() => window.scrollY > 0);
        await open(page, styles, fixture);
        await page.addStyleTag({ content: "body { min-height: 3000px }" });
        const offset = await page.evaluate(() => window.scrollY);
        await page.mouse.move(5, 5);
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(150);
        check((await page.evaluate(() => window.scrollY)) === offset, rule, "§11", [
          `${fixture.kind}: background scrolled`,
        ]);
        check(
          await fixture
            .background(page)
            .evaluate((element) =>
              Boolean(element.closest("[data-lf-conformance] > .lf_surface")?.closest('[inert], [aria-hidden="true"]')),
            ),
          rule,
          "§11",
          [`${fixture.kind}: surface background is not inert`],
        );
        const bounds = await fixture.background(page).boundingBox();
        check(bounds, rule, "§13", [`${fixture.kind}: missing background control`]);
        const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        check(
          await fixture.backdrop(page).evaluate((element, point) => {
            const hit = document.elementFromPoint(point.x, point.y);
            return hit === element || element.contains(hit);
          }, point),
          rule,
          "§11",
          [`${fixture.kind}: backdrop does not intercept the background pointer`],
        );
        const before = await page.evaluate(() => window.liveframeConformance.intents());
        await page.mouse.click(point.x, point.y);
        await settle(page);
        check(
          JSON.stringify(await page.evaluate(() => window.liveframeConformance.intents())) === JSON.stringify(before),
          rule,
          "§8",
          [`${fixture.kind}: background pointer raised an intent`],
        );
      }
    },
    async text_input_counts_code_points(page: Page, styles: Styles, rule: string) {
      coverage(options.fixtures.textInputKinds, options.fixtures.textInputs, rule);
      for (const fixture of options.fixtures.textInputs ?? []) {
        check(Number.isSafeInteger(fixture.maxLength) && fixture.maxLength > 0, rule, "§13", [
          `${fixture.kind}: maxLength must be a positive integer`,
        ]);
        await mount(page, fixture.tree, styles);
        const field = fixture.field(page);
        const before = await page.evaluate(() => window.liveframeConformance.intents().length);
        await field.fill("");
        await field.pressSequentially("😀".repeat(fixture.maxLength + 1));
        const expected = "😀".repeat(fixture.maxLength);
        check((await field.inputValue()) === expected, rule, "§10", [
          `${fixture.kind}: field does not count code points`,
        ]);
        await field.blur();
        await settle(page);
        const intents = await page.evaluate((before) => window.liveframeConformance.intents().slice(before), before);
        const last = intents.at(-1);
        check(
          last && (last.type === "setState" ? last.value === expected : Object.values(last.args).includes(expected)),
          rule,
          "§10",
          [`${fixture.kind}: no intent carries the bounded text`],
        );
      }
    },
  };
}
