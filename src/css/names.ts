/** Variable names for declared vocabulary roles and design values. */
export const colourVar = (role: string): string => `--lf-c-${role.replaceAll(".", "_")}`;
export const valueVar = (name: string): string => `--lf-v-${name.replaceAll(".", "_")}`;
export const typographyVar = (role: string, field: string): string => `--lf-t-${role.replaceAll(".", "_")}__${field}`;
export const slotClass = (kind: string, variant: string, slot: string): string => `lf_${kind}_${variant}_${slot}`;

/** Also escape '<' so a sheet can safely be embedded in a style element. */
export function cssString(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: CSS strings must escape control characters.
  return `"${value.replace(/["\\\u0000-\u001f\u007f<]/g, (char) => {
    if (char === '"' || char === "\\") return `\\${char}`;
    return `\\${(char === "\0" ? 0xfffd : char.charCodeAt(0)).toString(16)} `;
  })}"`;
}
