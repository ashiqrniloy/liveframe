import type { Result } from "../errors.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { typographyVar } from "./names.ts";

/** Generic surface defaults; app primitives own all per-kind structure. */
export function baseCss(catalog: Catalog): Result<string> {
  const checked = validateCatalog(catalog);
  if (!checked.ok) return checked;
  const role = checked.value.vocabulary.surfaceTypography;
  const fields = {
    "font-family": "fontFamily",
    "font-size": "fontSize",
    "font-size-adjust": "fontSizeAdjust",
    "font-stretch": "fontStretch",
    "font-weight": "fontWeight",
    "letter-spacing": "letterSpacing",
    "line-height": "lineHeight",
    "text-transform": "textTransform",
  };
  const typography = Object.entries(fields)
    .map(([property, field]) => `${property}:var(${typographyVar(role, field)})`)
    .join(";");
  return {
    ok: true,
    value: [
      ":where([data-lf-ds]) *{box-sizing:border-box;margin:0;border:0 solid}",
      ":where([data-lf-ds]) :where(button,input,select,textarea){font:inherit}",
      `:where([data-lf-ds]).lf_surface{${typography}}`,
      ":where([data-lf-ds]).lf_container{container-name:lf;container-type:inline-size}",
      "@media (forced-colors:active){:where([data-lf-ds]) .lf_fill{outline:1px solid CanvasText;outline-offset:-1px}}",
      "@media (prefers-reduced-motion:reduce){:where([data-lf-ds]) *{transition-duration:0s !important;translate:none !important}}",
      "@media (prefers-reduced-transparency:reduce){:where([data-lf-ds]) *{--lf-alpha:1 !important;backdrop-filter:none !important}}",
      ":where([data-lf-ds][data-lf-switching]),:where([data-lf-ds][data-lf-switching]) *{transition:none !important}",
    ].join("\n"),
  };
}
