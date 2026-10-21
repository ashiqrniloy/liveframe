# Phase 0 gaps

These are proof findings, not finalized changes to the normative spec. No primitive has been added. Source paths below are relative to `proof/references/`; commits are recorded in `references/SOURCES.md`.

## Task 3 — theme authority and vocabulary

- **Rack typography ownership:** Clay's `packages/design-rack/docs/index.md` §2 and decision `2026-08-28-2234` separate content themes, user typography and design systems. Liveframe spec §6.1 puts typography in the theme. `styles/rack/theme.ts` supplies proof-host typography using the font stacks and base/label/meta sizes in `clay/design-artifacts/approved/rack-kit-and-pages/rack.css:9–17`; heading roles supply a proof scale. This does not migrate or redefine Clay's user preferences. Task 12 must revisit the ownership mismatch.
- **Shared colour roles:** both themes declare the same vocabulary in `styles/types.ts`. Modus Operandi's `designTokens` map directly; `text.primary` and `surface.scrollbar` come from its `textStyles` entries `text` and `scrollbar`. Rack's aliases `surface.base`/`raised`, `accent.fill`/`fill.hover`, `text.on-accent`, `status.critical` and `shadow.highlight` reuse case/module/accent/error colours. The Rack primary hover recipe retains its source opacity of 0.86; the additional `accent.fill.hover` alias does not invent a new palette entry.
- **Roles absent from Certified:** `surface.case/module` alias bg/surface; text meta/disabled and kbd/status reuse its muted/foreground roles; border roles reuse line/line-2/control/focus. Diagnostic ink roles use danger/attention/success/info ink. Certified has no five-patch identity vocabulary: `patch.1–5` reuse danger/info/success/accent/foil colours. It also has no diagnostic fill roles: diagnostic soft roles reuse its neutral hover wash, preserving its no-chromatic-fill direction. These aliases satisfy the structural switch contract but do not prove Rack's identity-versus-status distinction under Certified; Task 10 must inspect this, and Task 12 must report the limitation.
- **Transparency:** Rack's 247 translated source recipes replace `transparent` with `colour.transparent`; both themes own its colour value. Every other source recipe field and all 14 source values are retained. Tests compare with the pinned manifest after that sole normalization, including nested shadow roles.
- **Scope:** only Certified light and Modus Operandi light are supplied. Dark/contrast modes, OS forced colours, font loading and pixel parity are not established by this data task; CSS projection and parity belong to Tasks 5 and 11. Typography sizes and spacing are numeric CSS pixels; rem-based Certified tokens use the reference's default 16px root.

## Task 3 — Rack catalog mapping

The mapping table below corresponds to `rackMappings` in `styles/rack/design-system.ts`. Entries name `<kind>.<variant>.<slot>` prefixes. Source states are copied; every slot requires an explicit rest recipe, and unspecified states inherit that slot's rest recipe. Because Task 2 definitions do not declare per-kind state subsets, the proof materializes all eight spec §6.2 states for every catalog slot. It does not infer behavior or state from a recipe.

| Proof prefix | Rack source prefix / treatment |
| --- | --- |
| `box.default.root` | `panel.flat.root` (transparent generic box; widget chooses a surface role) |
| `stack.default.root`, `grid.default.root` | `stack.default.root`; grid layout remains a renderer/style-prop concern |
| `inline.default.root` | `flex.row.root` |
| `scroll.default.root` / `scrollbar` | `scroll.default.root` / `scrollbarThumb`; viewport is an unpainted wrapper, not the source scrollbar track |
| `separator.default.root` | `divider.default.root`; the source strong variant has no catalog counterpart |
| `text.default.root` / `heading.default.root` | `label.body.root` / `label.title.root`, with theme typography roles `body` / `heading.2` |
| `icon.default.root` | `label.default.root` ink; glyph geometry belongs to the renderer |
| `image.default.root` | Unpainted image; no source image family |
| `link.default.root` | `label.accent.root` plus body typography and focus outline; label slot inherits ink |
| `button.{default,primary,danger}.root` | Same source prefixes; default is outlined, danger is filled |
| `button.ghost.root` | `button.muted.root`; label/icon slots inherit the root's ink |
| `button.ghostDanger` (source only) | Preserved in translated source data; no matching catalog variant. It is not silently merged into filled `danger` or added to the catalog |
| `textField.default.root` / `label` / `input` | `flex.column.root` / `textInput.default.label` / `textInput.default.input`. Using an unpainted field wrapper avoids drawing the source field and input borders twice |
| `select.default.root` / `label` / `trigger` / `list` / `option` | `dropdown.default.root` / `textInput.default.label` / `dropdown.default.trigger` / `dropdown.default.popover` / `dropdown.default.item`; list gets the floating surface |
| `menu.default.root` / `trigger` / `content` | `dropdown.default.root` / `button.default.root` / `menu.default.root`; the painted source menu surface moves to content |
| `menuItem.default.root` / `menuItem.danger.root` | `menu.default.item` / `menu.default.itemDanger`; danger retains default item state feedback with diagnostic ink. Label/icon slots inherit ink |
| `popover.default.root` / `trigger` / `content` | Unpainted `dropdown.default.root` / `button.default.root` / `popover.default.root` |
| `dialog.default.root` / `backdrop` / `content` / `title` / `close` | `dropdown.default.root` / `modal.default.scrim` / `modal.default.dialog` / `label.title.root` / `button.muted.root` |
| `tooltip.default.root` / `trigger` / `content` | Unpainted wrappers / `tooltip.default.root` on content |
| `tabs.default.root` / `list` / `panel` | `dropdown.default.root` / `seg.default.root` / unpainted wrapper |
| `tab.default.root` / `label` / `panel` | `seg.default.item` / inherited ink / unpainted panel |
| `checkbox.default.{root,label,indicator}`, `switch.default.{root,label,track,thumb}` | No source families. Explicit supplements reuse Rack field borders/radii, pill geometry for switch, accent selection, focus outline and disabled opacity. No new primitive or product component |

Other source variants (`textInput.search/bare/command/inline/secret`, `label.display/section/caption/detail/status/eyebrow/accent`, `panel.fixed/transient/tint`, `flex.column`, etc.) remain in the translated source inventory rather than becoming widget variants. Product-shaped source families (`case`, `module`, `lamp`, `jack`, `pips`, `io`, etc.) are reference styling only: they are not installed as catalog kinds or returned in the active catalog recipes. Tasks 7–9 must compose the corresponding UI from primitives and record any geometry that roles/style props cannot express.

The Rack package docs §5 say 273 keys, but the pinned manifest actually has **247 recipes**. The manifest is the proof authority; tests lock its exact inventory.

## Task 3 — style format and parity handoff

- Rack recipes use undeclared `spacing.none/xxs/xs/sm/md/lg/tooltip` references and `expo-out`. The proof supplies spacing values 0/4/8/12/16/24/6 and the documented `[0.16, 1, 0.3, 1]` easing. Both systems also expose the same `space.0–7` layout token names (0/4/8/12/16/24/32/48). These are explicit proof values; exact context-specific padding still needs Task 11 parity.
- `styles/types.ts` is a closed proof subset, not the published Phase 1 format/schema. It includes Rack's typed outline, opacity, saturation, shadow and press-shift fields. Task 5's projector must handle these fields, axis padding and theme typography, rather than pass through CSS strings. Value references are checked by property domain, including when a colour role and a border-width token both use `border.hairline`.
- Certified recipes translate `.btn`, `.field`, `.menu`, `.tab`, `.check`, `.switch` and `.dialog` from the pinned stylesheet/artifact. Default button maps to outline, ghost to quiet, danger to quiet danger; primary is filled. Box stays unpainted so plates/cards remain composition. Pop/mount shadows split geometry from theme colour roles. The current type subset does not claim exact typography tracking/stretch, control heights, text decoration, multi-state precedence or every context-specific border. Tasks 5/11 must record or resolve parity gaps rather than introduce product-shaped primitives or raw widget CSS.
- Completeness and closed-property/value checks run in `tests/styles.test.ts` for these trusted proof fixtures. A reusable runtime install validator remains Phase 1; this task does not claim to accept untrusted external themes or design systems.
