import { valueVar } from "@arnilo/liveframe/css";

// Trusted app CSS owns primitive structure; recipes own their look.
export const primitiveCss = `
.lf_container{container-name:lf;container-type:inline-size}
.lf_stack_default_root{display:flex;flex-direction:column}
.lf_inline_default_root{display:flex;flex-direction:row;align-items:center}
.lf_grid_default_root{display:grid}
.lf_scroll_default_viewport{overflow:auto;max-height:100%}
.lf_button_default_root{display:inline-flex;align-items:center;justify-content:center;min-height:1.9rem}
.lf_button_primary_root,.lf_button_danger_root{display:inline-flex;align-items:center;justify-content:center;min-height:2.25rem}
.lf_button_ghost_root{display:inline-block;text-align:left}
.lf_heading_default_root,.lf_dialog_default_title{margin:0;text-wrap:balance}
.lf_textField_default_root,.lf_select_default_root{display:flex;flex-direction:column}
.lf_checkbox_default_root,.lf_switch_default_root{display:inline-flex;align-items:center}
.lf_checkbox_default_indicator{display:inline-block;width:1em;height:1em}
.lf_switch_default_track{display:inline-flex;width:2em;height:1em}
.lf_switch_default_thumb{width:1em;height:1em}
[data-selected] .lf_switch_default_thumb{transform:translateX(100%)}
.lf_dialog_default_backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.lf_dialog_default_content{max-width:90vw;max-height:90vh;overflow:auto}
.lf_icon_default_root{display:inline-flex;flex:none;width:1rem;height:1rem}
.lf_tabs_default_list{display:flex;flex-wrap:wrap;align-items:center}
.lf_tab_default_root{display:inline-flex;align-items:center;min-height:2.25rem}
.lf_tooltip_default_trigger{display:inline-flex}
.lf_box_plate_root{display:grid;align-content:start;min-width:0}
.lf_box_callout_root{display:grid;grid-template-columns:1px minmax(0,1fr)}
.lf_box_default_rail,.lf_box_plate_rail,.lf_box_rule_rail,.lf_box_callout_rail{display:block;width:1px}
.lf_disclosure_default_summary{width:fit-content;min-height:2rem;cursor:pointer}
[open] > .lf_disclosure_default_summary{margin-bottom:var(${valueVar("space.1")})}
`;
