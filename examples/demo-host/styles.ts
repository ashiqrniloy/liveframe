import { baseCss, designSystemCss, themeCss } from "@arnilo/liveframe/css";
import { catalog, designSystems, themes } from "./app.ts";
import { primitiveCss } from "./primitives/css.ts";

function valid<T>(result: { ok: true; value: T } | { ok: false; errors: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

/** The sheets the pages load, in order. Each theme and design system scopes itself to the surface that names it. */
export const sheets: Record<string, string> = {
  "/styles/base.css": valid(baseCss(catalog)),
  "/styles/primitives.css": primitiveCss,
  "/styles/theme.css": themes.map((theme) => valid(themeCss(theme, catalog))).join("\n"),
  "/styles/design-system.css": designSystems
    .map((system) => valid(designSystemCss(system, { catalog, registry: {} })))
    .join("\n"),
};
