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
.lf_radioGroup_default_root,.lf_slider_default_root,.lf_progress_default_root,.lf_dateField_default_root{display:flex;flex-direction:column}
.lf_radioGroup_default_root[data-orientation=horizontal]{flex-direction:row;flex-wrap:wrap;align-items:center}
.lf_radio_default_root{display:inline-flex;align-items:center;min-height:2rem;cursor:pointer}
.lf_radio_default_indicator{display:inline-block;flex:none;width:1.1em;height:1.1em;box-sizing:border-box}
.lf_slider_default_root{display:grid;grid-template-columns:1fr auto}
.lf_slider_default_track{grid-column:1/-1;position:relative;height:0.375rem;margin-block:0.6rem}
.lf_slider_default_fill{position:absolute;inset-block:0;inset-inline-start:0}
.lf_slider_default_thumb{width:1.1rem;height:1.1rem;top:50%;box-sizing:border-box;cursor:grab}
.lf_progress_default_track{display:block;position:relative;height:0.375rem;overflow:hidden}
.lf_progress_default_fill{position:absolute;inset-block:0;inset-inline-start:0}
.lf_progress_default_root[data-mixed] .lf_progress_default_fill{inset-inline-end:0}
.lf_dateField_default_input{display:inline-flex;align-items:center;width:fit-content;min-height:2.25rem;box-sizing:border-box}
.lf_dateField_default_segment{padding-inline:0.1em;font-variant-numeric:tabular-nums}
.lf_richText_default_root{display:flex;flex-direction:column}
.lf_richText_default_paragraph,.lf_richText_default_heading,.lf_richText_default_list{margin:0}
.lf_richText_default_heading{text-wrap:balance}
.lf_richText_default_link{text-decoration:underline;text-underline-offset:0.15em}
.starter-chart{display:flex;flex-direction:column;height:16rem}
.starter-chart-area{flex:1;min-height:0;display:grid;grid-template-columns:auto 1fr;grid-template-rows:1fr auto;column-gap:0.5rem}
.starter-chart-ticks{position:relative;min-width:2ch;text-align:end}
.starter-chart-ticks>span{position:absolute;inset-inline-end:0;transform:translateY(-50%);line-height:1}
.lf_chart_default_plot{width:100%;height:100%;overflow:visible}
.starter-chart-labels{grid-column:2;display:flex}
.starter-chart-labels>span{flex:1 1 0;min-width:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.starter-chart-legend{display:flex;flex-wrap:wrap;list-style:none;padding:0;margin:0}
.starter-chart-legend>li{display:inline-flex;align-items:center;gap:0.35em}
.starter-swatch{display:inline-block;width:0.75em;height:0.75em;background:currentColor}
.lf_table_default_root{border-collapse:collapse;width:100%}
.lf_table_default_caption{text-align:start}
.lf_tableCell_default_root{text-align:start;vertical-align:top}
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
