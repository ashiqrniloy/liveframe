import { expect, test } from "bun:test";
import { ConformanceFailure } from "../conformance/case.ts";
import { styledStates } from "../conformance/react/states.ts";
import { stateDeclarations } from "../css/design-system.ts";
import { recipeDeclarations } from "../css/recipe.ts";
import { pageOptions } from "./fixtures/conformance-browser.tsx";

const rule = "every_styled_state_is_reachable";
const noPage = {} as Parameters<typeof styledStates>[2];
const unused = async () => {
  throw new Error("Missing coverage must fail before driving the browser");
};

test("state_coverage_lists_all_missing_keys_across_installed_systems", async () => {
  try {
    await styledStates(pageOptions, {}, noPage, rule, unused, unused);
    throw new Error("Missing coverage passed");
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    const failure = error as ConformanceFailure;
    expect(failure.rule).toBe(rule);
    const details = failure.details.join("\n");
    expect(details).toContain("button.primary.hover");
    expect(details).toContain("checkbox.default.selected");
    expect(details).toContain("menu.default.open");
    expect(details).toContain("tab.default.selected");
    expect(details).not.toContain(".rest");
  }
});

test("state_comparison_uses_projected_defaults_rather_than_object_shape", () => {
  const rest = recipeDeclarations({ borderWidth: { value: 1, unit: "px" } });
  expect(stateDeclarations({ borderWidth: { value: 1, unit: "px" }, borderStyle: "solid" }, rest)).toBeUndefined();
  expect(stateDeclarations({ opacity: 0.5 }, rest)).toBe("opacity:0.5");
});

test("rest_equivalent_states_require_no_browser_fixtures", async () => {
  const designSystems = pageOptions.designSystems.map((system) => ({
    ...system,
    recipes: Object.fromEntries(
      Object.entries(system.recipes)
        .filter(([key]) => key.endsWith(".rest"))
        .flatMap(([key, recipe]) => [
          [key, recipe],
          [key.replace(/rest$/, "focus"), {}],
        ]),
    ),
  }));
  await styledStates({ ...pageOptions, designSystems }, undefined, noPage, rule, unused, unused);
});

test("placeholder_only_state_requires_a_fixture", async () => {
  const withPlaceholder = (focus: Record<string, unknown>) =>
    pageOptions.designSystems.map((system) => ({
      ...system,
      recipes: Object.fromEntries(
        Object.entries(system.recipes)
          .filter(([key]) => key.endsWith(".rest"))
          .flatMap(([key, recipe]) => [
            [key, recipe],
            [key.replace(/rest$/, "focus"), key === "textField.default.input.rest" ? focus : {}],
          ]),
      ),
    })) as typeof pageOptions.designSystems;
  // A different placeholder colour in a state is a styled state, though it adds no main-rule declaration.
  const differing = withPlaceholder({ placeholderColor: "text.muted" });
  try {
    await styledStates({ ...pageOptions, designSystems: differing }, undefined, noPage, rule, unused, unused);
    throw new Error("A placeholder-only state needed no fixture");
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    expect((error as ConformanceFailure).details.join("\n")).toContain("textField.default.focus");
  }
});
