import type { Locator, Page } from "playwright";
import { stateDeclarations, stateSelectors } from "../../css/design-system.ts";
import { slotClass } from "../../css/names.ts";
import { recipeDeclarations } from "../../css/recipe.ts";
import { type UiTree, validateCatalog } from "../../index.ts";
import { resolveRecipes } from "../../resolve.ts";
import { check, ConformanceFailure } from "../case.ts";
import type { PageOptions } from "./page.tsx";

export type StateFixtures = Readonly<
  Record<
    string,
    {
      tree: UiTree;
      target(page: Page): Locator;
      drive?(page: Page): Promise<unknown>;
    }
  >
>;

export async function styledStates(
  options: PageOptions,
  fixtures: StateFixtures | undefined,
  page: Page,
  rule: string,
  mount: (tree: UiTree) => Promise<void>,
  settle: () => Promise<void>,
) {
  const catalog = validateCatalog(options.catalog);
  check(catalog.ok, rule, "§6.4", catalog.ok ? [] : catalog.errors);
  const registry = Object.fromEntries(
    options.designSystems.map((system) => [`${system.id}@${system.version}`, system]),
  );
  const required = new Map<string, Set<string>>();
  for (const system of options.designSystems) {
    const recipes = resolveRecipes(system, { catalog: catalog.value, registry });
    for (const definition of catalog.value.definitions)
      for (const variant of definition.variants)
        for (const state of Object.keys(stateSelectors) as (keyof typeof stateSelectors)[]) {
          if (state === "rest") continue;
          const slots = definition.slots.filter((slot) => {
            const prefix = `${definition.kind}.${variant}.${slot}` as const;
            return (
              stateDeclarations(
                recipes[`${prefix}.${state}`] ?? {},
                recipeDeclarations(recipes[`${prefix}.rest`] ?? {}),
              ) !== undefined
            );
          });
          if (!slots.length) continue;
          const key = `${definition.kind}.${variant}.${state}`;
          const classes = required.get(key) ?? new Set<string>();
          // Root state propagates to every slot; a slot's own state applies only to itself.
          for (const slot of ["root", ...slots]) classes.add(slotClass(definition.kind, variant, slot));
          required.set(key, classes);
        }
  }
  const missing = [...required.keys()].filter((key) => !Object.hasOwn(fixtures ?? {}, key)).sort();
  const details: string[] = [];
  for (let i = 0; i < missing.length; i += 10)
    details.push(`Missing state fixtures: ${missing.slice(i, i + 10).join(", ")}`);
  check(!missing.length, rule, "§13", details);
  for (const [key, classes] of required) {
    const fixture = fixtures?.[key];
    check(fixture, rule, "§13", [`Missing state fixture: ${key}`]);
    const state = key.slice(key.lastIndexOf(".") + 1) as Exclude<keyof typeof stateSelectors, "rest">;
    try {
      await mount(fixture.tree);
      const target = fixture.target(page);
      if (fixture.drive) await fixture.drive(page);
      else if (state === "hover" || state === "active") {
        await target.hover();
        if (state === "active") await page.mouse.down();
      }
      await settle();
      const matches = await target.evaluate(
        (element, { selector, classes, hover, guarded, disabled }) =>
          classes.some((cls) => element.classList.contains(cls)) &&
          (element.matches(selector) || (hover && matchMedia("(hover: hover)").matches && element.matches(":hover"))) &&
          (!guarded || !element.matches(`:is(${disabled}),:is(${disabled}) *`)),
        {
          selector: stateSelectors[state],
          classes: [...classes],
          hover: state === "hover",
          guarded: state === "hover" || state === "active",
          disabled: stateSelectors.disabled,
        },
      );
      check(matches, rule, "§6.4", [
        `${key}: target must carry the affected slot class and match ${stateSelectors[state]}`,
      ]);
    } catch (error) {
      if (error instanceof ConformanceFailure) throw error;
      throw new ConformanceFailure(rule, "§6.4", [`${key}: ${String(error)}`]);
    } finally {
      if (state === "active") await page.mouse.up();
    }
  }
}
