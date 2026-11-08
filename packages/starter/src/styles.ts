import { baseCss, designSystemCss, themeCss } from "@arnilo/liveframe/css";
import { catalog, valid } from "./catalog.ts";
import { designSystem } from "./design-system.ts";
import { themes } from "./themes.ts";

// Trusted app CSS owns primitive structure; the design system's recipes own the look (spec §6.2). It names no colour:
// the one paint it reads is the `sheen` extension, with a transparent fallback.
export const primitiveCss = `
.lf_stack_default_root{display:flex;flex-direction:column}
.lf_inline_default_root{display:flex;flex-direction:row;align-items:center}
.lf_grid_default_root{display:grid}
.lf_scroll_default_viewport{overflow:auto;max-height:100%}
.starter-button{display:inline-flex;align-items:center;justify-content:center;min-height:2.25rem;cursor:pointer;box-shadow:inset 0 1px 0 var(--lf-p-sheen,transparent)}
.starter-button[data-disabled]{cursor:default}
.lf_heading_default_root,.lf_dialog_default_title{margin:0;text-wrap:balance}
.lf_textField_default_root,.lf_select_default_root{display:flex;flex-direction:column}
.lf_select_default_trigger{display:flex;justify-content:space-between;align-items:center;min-height:2.25rem;text-align:left}
.lf_checkbox_default_root,.lf_switch_default_root{display:inline-flex;align-items:center}
.lf_checkbox_default_indicator{display:inline-flex;align-items:center;justify-content:center;width:1.1em;height:1.1em;line-height:1}
.lf_switch_default_track{display:inline-flex;align-items:center;width:2.2em;height:1.2em;padding:2px;box-sizing:border-box}
.lf_switch_default_thumb{width:calc(1.2em - 6px);height:calc(1.2em - 6px)}
[data-selected] .lf_switch_default_thumb{transform:translateX(1em)}
.lf_menu_default_trigger,.lf_popover_default_trigger,.lf_dialog_default_close{display:inline-flex;align-items:center;min-height:2.25rem;cursor:pointer}
.lf_menuItem_default_root,.lf_select_default_option{display:flex;align-items:center;cursor:default;outline:none}
.lf_dialog_default_backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.lf_dialog_default_content{max-width:90vw;max-height:90vh;overflow:auto}
.lf_icon_default_root{display:inline-flex;align-items:center;justify-content:center;flex:none;width:1rem;height:1rem}
.lf_tabs_default_list{display:flex;flex-wrap:wrap;align-items:center}
.lf_tab_default_root{display:inline-flex;align-items:center;min-height:2.25rem;cursor:pointer}
.lf_tooltip_default_trigger{display:inline-flex}
.lf_image_default_root{max-width:100%}
.starter-link{text-decoration:underline;text-underline-offset:0.15em}
.lf_box_plate_root{display:grid;align-content:start;min-width:0}
.lf_box_callout_root{display:grid;grid-template-columns:3px minmax(0,1fr)}
.lf_box_default_rail,.lf_box_plate_rail,.lf_box_rule_rail{display:none}
.lf_box_callout_rail{display:block;width:3px}
.lf_disclosure_default_summary{width:fit-content;min-height:2rem;cursor:pointer}
`;

/**
 * The sheets a page loads, in order: base, primitive structure, then one theme sheet and one design-system sheet.
 * Each theme and design system scopes itself to the surface that names it, so all three themes load at once and a
 * switch is an attribute change.
 */
export function styles(): {
  readonly base: string;
  readonly primitives: string;
  readonly themes: string;
  readonly designSystem: string;
} {
  return {
    base: valid("base sheet", baseCss(catalog)),
    primitives: primitiveCss,
    themes: themes.map((theme) => valid(`${theme.id} sheet`, themeCss(theme, catalog))).join("\n"),
    designSystem: valid("design-system sheet", designSystemCss(designSystem, { catalog, registry: {} })),
  };
}
