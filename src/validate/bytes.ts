// biome-ignore lint/suspicious/noControlCharactersInRegex: JSON must escape control characters.
const escapedOrNonAscii = /["\\\x00-\x1f\x7f-\uffff]/;

/**
 * UTF-8 bytes of QuoteJSONString (ECMA-262), including quotes, without serialising. Not `utf8Length`:
 * this counts the JSON escapes, and a lone surrogate is a 6-byte `\uXXXX` escape, not U+FFFD.
 */
export function stringBytes(value: string, maximum = Infinity): number {
  if (value.length + 2 <= maximum && !escapedOrNonAscii.test(value)) return value.length + 2;
  let bytes = 2;
  for (let i = 0; i < value.length && bytes <= maximum; i++) {
    const unit = value.charCodeAt(i);
    if (unit === 0x22 || unit === 0x5c || unit === 8 || unit === 9 || unit === 10 || unit === 12 || unit === 13)
      bytes += 2;
    else if (unit < 0x20) bytes += 6;
    else if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 6;
    } else bytes += unit >= 0xdc00 && unit <= 0xdfff ? 6 : 3;
  }
  return bytes;
}

/*
 * Tree byte framing (spec §10: a tree's size is the UTF-8 length of its `JSON.stringify` output).
 * A container adds its two brackets, each item after the first a comma, and each object member
 * its quoted key and colon (`"key":`, or `,"key":` after the first). The validator applies these
 * to whatever JSON it walks; `render()` builds node shells and tree fields itself, so it adds their
 * framing through the named rules below. Both owners are proven to agree by
 * `byte-budget-agreement.test.ts`.
 */

/** `{` and `}`, or `[` and `]`. */
export const CONTAINER_BYTES = 2;
/** One `{`, `}`, `[` or `]` on its own, when a shell opens and closes in separate steps. */
export const BRACKET_BYTES = 1;
/** `,` between two items. */
export const SEPARATOR_BYTES = 1;

/** `"key":`, plus the leading `,` when the member is not the first. */
export function memberBytes(key: string, first: boolean, maximum = Infinity): number {
  return stringBytes(key, maximum) + 1 + (first ? 0 : 1);
}

const ID_MEMBER = memberBytes("id", true);
const KIND_MEMBER = memberBytes("kind", false);
const CHILDREN_MEMBER = memberBytes("children", false);
/** `,"variant":` before a node's variant value. */
export const VARIANT_MEMBER_BYTES = memberBytes("variant", false);
/** `,"props":` before a node's props object. */
export const PROPS_MEMBER_BYTES = memberBytes("props", false);
/** `,"style":` before a node's style object. */
export const STYLE_MEMBER_BYTES = memberBytes("style", false);
/** `,"events":` before a node's events object. */
export const EVENTS_MEMBER_BYTES = memberBytes("events", false);

/** A node's opening `{"id":…,"kind":…`. */
export function nodeOpenBytes(id: string, kind: string): number {
  return BRACKET_BYTES + ID_MEMBER + stringBytes(id) + KIND_MEMBER + stringBytes(kind);
}

/** A node's `,"children":[…]` framing for `count` children (count ≥ 1), without the children. */
export function childrenFramingBytes(count: number): number {
  return CHILDREN_MEMBER + CONTAINER_BYTES + (count - 1) * SEPARATOR_BYTES;
}

/** One tree field's `"name":value` (with its leading `,` unless first), given its value's bytes. */
export function treeFieldBytes(name: string, first: boolean, valueBytes: number): number {
  return memberBytes(name, first) + valueBytes;
}
