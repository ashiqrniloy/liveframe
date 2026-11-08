// Run by `bun scripts/release/archive-gate.ts --dir packages/starter` in the install directory, outside the checkout:
// the installed package must resolve its catalog document, its generated modules and its peers on its own, and pass
// the design-system conformance suite (three themes, contrast audit on) the repository's tests run.
import { designSystemSuite } from "@arnilo/liveframe/conformance";
import catalogDocument from "@arnilo/liveframe-starter/catalog.json" with { type: "json" };
import { Button } from "@arnilo/liveframe-starter/definitions";
import { Stack } from "@arnilo/liveframe-starter/ui";
import { catalog, designSystem, implementations, primitiveCss, styles, themes } from "@arnilo/liveframe-starter";

if (catalogDocument.catalogId !== catalog.catalogId) throw new Error("catalog.json does not match the catalog");
if (Button.kind !== "button" || typeof Stack !== "function") throw new Error("Generated modules did not load");
if (themes.length !== 3 || implementations.length !== catalog.definitions.length) throw new Error("Incomplete starter");
if (Object.values(styles()).some((sheet) => sheet.length === 0)) throw new Error("Empty sheet");

const cases = designSystemSuite({
  catalog,
  themes,
  designSystems: [designSystem],
  sheets: [primitiveCss],
  contrast: true,
});
let failed = 0;
for (const c of cases) {
  try {
    await c.run();
  } catch (error) {
    failed++;
    console.error(`${c.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`${cases.length - failed}/${cases.length} design-system conformance cases pass`);
process.exit(failed === 0 ? 0 : 1);
