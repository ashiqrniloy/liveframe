import { expect, test } from "bun:test";
import { designSystemSuite, ConformanceFailure } from "@arnilo/liveframe/conformance";
import { catalog } from "./fixtures/conformance/index.ts";
import certified from "./fixtures/proof/certified.design-system.json" with { type: "json" };
import rack from "./fixtures/proof/rack.design-system.json" with { type: "json" };
import certifiedTheme from "./fixtures/proof/certified.theme.json" with { type: "json" };
import rackTheme from "./fixtures/proof/rack.theme.json" with { type: "json" };

const input = { catalog, themes: [certifiedTheme, rackTheme], designSystems: [certified, rack] };
async function fails(name: string, overrides: Partial<Parameters<typeof designSystemSuite>[0]>) {
  const c = designSystemSuite({ ...input, ...overrides }).find((c) => c.name === name);
  if (!c) throw new Error(`Missing case ${name}`);
  try {
    await c.run();
    throw new Error("Mutant passed");
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    expect(error).toMatchObject({ rule: name });
    expect((error as ConformanceFailure).details.length).toBeGreaterThan(0);
    return error as ConformanceFailure;
  }
}

test("proof_styles_pass_the_design_system_suite", async () => {
  const cases = designSystemSuite(input);
  expect(cases.map((c) => c.name)).toEqual([
    "every_theme_installs",
    "every_design_system_installs",
    "every_theme_and_design_system_projects",
  ]);
  await Promise.all(cases.map((c) => c.run()));
  expect(designSystemSuite({ ...input, sheets: [] })).toHaveLength(4);
});

test("design_system_suite_catches_broken_styles", async () => {
  const colours = { ...rackTheme.colours };
  delete (colours as Record<string, unknown>)[catalog.vocabulary.colourRoles[0] ?? ""];
  const theme = await fails("every_theme_installs", { themes: [certifiedTheme, { ...rackTheme, colours }] });
  expect(theme.details).toContainEqual(expect.objectContaining({ kind: "unknown-name" }));
  const system = await fails("every_design_system_installs", { designSystems: [certified, { ...rack, recipes: {} }] });
  expect(system.details).toContainEqual(expect.objectContaining({ kind: "incomplete-design-system" }));
  await fails("every_design_system_installs", { designSystems: [{ ...certified, extends: "uninstalled" }] });
  await fails("every_design_system_installs", {
    designSystems: [
      { ...certified, recipes: { ...certified.recipes, "button.primary.root.rest": { textColor: "red" } } },
    ],
  });
  for (const overrides of [{ themes: [null] }, { designSystems: [null] }, { catalog: null }])
    await fails("every_theme_and_design_system_projects", overrides);
  await fails("every_theme_installs", { catalog: null });
  await fails("every_design_system_installs", { catalog: null });
});

test("design_system_suite_resolves_inheritance_from_the_whole_registry", async () => {
  const child = { ...certified, id: "child", extends: certified.id, values: {}, recipes: {} };
  for (const c of designSystemSuite({ ...input, designSystems: [child, certified] })) await c.run();
  await fails("every_design_system_installs", { designSystems: [child] });
});

test("app_sheet_case_rejects_literal_colours_and_names_the_declaration", async () => {
  for (const declaration of [
    "color: #f00",
    "background: red",
    "border: 1px solid rebeccapurple",
    "outline-color: CanvasText",
    "fill: RGB(0 0 0)",
    "stroke: hsl(0 0% 0%)",
    "box-shadow: 0 0 1px blue",
    "filter: drop-shadow(0 0 1px green)",
    "background-image: linear-gradient(red, blue)",
    "text-decoration: underline orange",
    "scrollbar-color: ButtonText Canvas",
    "--brand: magenta",
    "color: var(--lf-c-ink, red)",
    "c\\6flor: r\\65 d",
    "COLOR/**/:/**/RED !important",
    "-webkit-text-fill-color: yellow",
    "-webkit-filter: drop-shadow(0 0 1px red)",
  ]) {
    const failure = await fails("app_sheets_set_no_colour", {
      sheets: [".ok { display: flex }", `.bad { ${declaration} }`],
    });
    expect(failure.details.join(" ")).toContain("sheets[1]");
  }
});

test("app_sheet_case_allows_structure_and_theme_colour_references", async () => {
  const sheets = [
    `
    /* color: red */
    .red { display: grid; gap: 4px; border: 1px solid; border-radius: 2px;
      background: transparent; color: var(--lf-c-text__primary); outline: none;
      border-color: currentColor; content: "red; color: blue";
      background-image: url("red.png"); color-scheme: light dark;
      box-shadow: 0 0 1px var(--lf-c-ink);
      color: light-dark(var(--lf-c-ink), var(--lf-c-red)); }
  `,
  ];
  for (const c of designSystemSuite({ ...input, sheets })) await c.run();
});

test("conformance_theme_contrast_case_checks_every_installed_theme", async () => {
  const colours = { ...rackTheme.colours, "text.primary": rackTheme.colours["surface.base"] };
  const failure = await fails("every_theme_installs", { themes: [certifiedTheme, { ...rackTheme, colours }] });
  expect(failure.details).toContainEqual(
    expect.objectContaining({ kind: "insufficient-contrast", message: expect.stringContaining("text.primary") }),
  );
});
