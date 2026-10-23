import { type Result, validateDesignSystem, validateTheme } from "@arnilo/liveframe";
import { baseCss, designSystemCss, themeCss } from "@arnilo/liveframe/css";
import certifiedSystem from "../../src/__tests__/fixtures/proof/certified.design-system.json";
import certifiedTheme from "../../src/__tests__/fixtures/proof/certified.theme.json";
import rackSystem from "../../src/__tests__/fixtures/proof/rack.design-system.json";
import rackTheme from "../../src/__tests__/fixtures/proof/rack.theme.json";
import { primitiveCss } from "../renderer/primitives/base.ts";
import { catalog } from "./fixtures.ts";

function checked<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
export const themes = {
  certified: checked(validateTheme(certifiedTheme, catalog.vocabulary)),
  rack: checked(validateTheme(rackTheme, catalog.vocabulary)),
};
const context = { catalog, registry: {} };
export const systems = {
  certified: checked(validateDesignSystem(certifiedSystem, context)),
  rack: checked(validateDesignSystem(rackSystem, context)),
};
export const base = checked(baseCss(catalog));
export const themeSheets = {
  certified: checked(themeCss(themes.certified, catalog)),
  rack: checked(themeCss(themes.rack, catalog)),
};
export const systemSheets = {
  certified: checked(designSystemCss(systems.certified, context)),
  rack: checked(designSystemCss(systems.rack, context)),
};
export const proofSheets = [base, primitiveCss, ...Object.values(themeSheets), ...Object.values(systemSheets)].join(
  "\n",
);
