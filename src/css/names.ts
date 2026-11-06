import { joinVariant } from "../formats/axes.ts";

/** Variable names for declared vocabulary roles and design values. */
export const colourVar = (role: string): string => `--lf-c-${role.replaceAll(".", "_")}`;
export const valueVar = (name: string): string => `--lf-v-${name.replaceAll(".", "_")}`;
export const typographyVar = (role: string, field: string): string => `--lf-t-${role.replaceAll(".", "_")}__${field}`;
/** Names are `[a-z][A-Za-z0-9-]*`, so the variable name is injective without escaping. */
export const extensionVar = (name: string): string => `--lf-p-${name}`;
/**
 * One stable class per `(kind, variant, slot)`. A kind with axes adds its axis values in declared
 * order after the variant (`lf_button_primary__critical_root`); names hold no `_`, so it stays injective.
 */
export const slotClass = (kind: string, variant: string, slot: string, axes: readonly string[] = []): string =>
  `lf_${kind}_${joinVariant(variant, axes)}_${slot}`;

/** Also escape '<' so a sheet can safely be embedded in a style element. */
export function cssString(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: CSS strings must escape control characters.
  return `"${value.replace(/["\\\u0000-\u001f\u007f<]/g, (char) => {
    if (char === '"' || char === "\\") return `\\${char}`;
    return `\\${(char === "\0" ? 0xfffd : char.charCodeAt(0)).toString(16)} `;
  })}"`;
}
