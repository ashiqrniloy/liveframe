/** The `url` keyword of a string schema: schemes it may carry, and whether a relative reference is allowed. */
export type UrlRule = { readonly schemes: readonly string[]; readonly relative?: boolean };

const isLetter = (code: number): boolean => (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
/** `ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )` (RFC 3986 §3.1); the first character must be a letter. */
const isSchemeCharacter = (code: number, first: boolean): boolean =>
  isLetter(code) || (!first && ((code >= 48 && code <= 57) || code === 43 || code === 45 || code === 46));

/**
 * One linear pass, no `URL` global. Any C0 control or space is rejected first, since a browser strips tab and
 * newline and trims the rest before it reads the scheme. A value with a scheme must name an allowed one
 * (compared ASCII case-insensitively). A value without one is a relative reference: allowed only with
 * `relative`, and never when it starts `//` or `/\` (protocol-relative) or `\` (a backslash is a slash in a browser).
 */
export function checkUrl(value: string, rule: UrlRule): boolean {
  let scheme = true;
  let colon = -1;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20) return false;
    if (!scheme) continue;
    if (code === 58) {
      if (i > 0) colon = i;
      scheme = false;
    } else if (!isSchemeCharacter(code, i === 0)) scheme = false;
  }
  if (colon > 0) return rule.schemes.includes(value.slice(0, colon).toLowerCase());
  if (rule.relative !== true) return false;
  const first = value[0];
  const second = value[1];
  return first !== "\\" && !(first === "/" && (second === "/" || second === "\\"));
}

/** What a failing value should have been, for `expected`. */
export function urlExpected(rule: UrlRule): string {
  return `a URL with scheme ${rule.schemes.join(", ")}${rule.relative === true ? " or a relative reference" : ""}`;
}

const caseless = (scheme: string): string =>
  [...scheme]
    .map((c) => (isLetter(c.charCodeAt(0)) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c.replace(/[+.]/, "\\$&")))
    .join("");

/**
 * An anchored ECMAScript pattern with the same verdicts as `checkUrl`, for JSON Schema output. Every part is
 * linear: a lookahead over the control class, then either an allowed scheme or (when relative) the negation of
 * "starts with a scheme" and of the two protocol-relative starts.
 */
export function urlPattern(rule: UrlRule): string {
  const schemes = `(?:${rule.schemes.map(caseless).join("|")}):`;
  const relative = "(?![A-Za-z][A-Za-z0-9+.-]*:)(?!\\\\)(?!/[/\\\\])";
  return `^(?![\\s\\S]*[\\x00-\\x20])(?:${schemes}${rule.relative === true ? `|${relative}` : ""})[\\s\\S]*$`;
}
