// Trusted app CSS owns primitive structure; the design system's recipes own the look.
export const primitiveCss = `
.lf_stack_default_root{display:flex;flex-direction:column}
.lf_inline_default_root{display:flex;flex-direction:row;align-items:center}
.lf_button_default_root,.lf_button_primary_root,.lf_button_danger_root{display:inline-flex;align-items:center;justify-content:center;min-height:2rem}
.lf_button_ghost_root{display:inline-block;text-align:left}
.lf_heading_default_root,.lf_dialog_default_title{margin:0;text-wrap:balance}
.lf_textField_default_root{display:flex;flex-direction:column}
.lf_dialog_default_backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.lf_dialog_default_content{max-width:90vw;max-height:90vh;overflow:auto}
.lf_box_plate_root{display:grid;align-content:start;min-width:0}
.lf_box_callout_root{display:grid;grid-template-columns:1px minmax(0,1fr)}
.lf_box_default_rail,.lf_box_plate_rail,.lf_box_rule_rail,.lf_box_callout_rail{display:block;width:1px}
`;
