import { checkUrl } from "@arnilo/liveframe";

/**
 * The closed formatted-text subset of `richText`: paragraphs, `#`–`###` headings, one level of
 * `-`/`*`/`1.` lists, `**strong**`, `*em*`/`_em_`, `` `code` ``, `[label](target)` and backslash escapes. Nothing
 * else is recognised, and the result is a token tree: every character reaches the DOM as text, never as HTML.
 */
export type Inline =
  | string
  | { readonly type: "strong"; readonly children: readonly Inline[] }
  | { readonly type: "em"; readonly text: string }
  | { readonly type: "code"; readonly text: string }
  | { readonly type: "link"; readonly label: string; readonly target: string };

export type Block =
  | { readonly type: "paragraph"; readonly children: readonly Inline[] }
  | { readonly type: "heading"; readonly depth: 1 | 2 | 3; readonly children: readonly Inline[] }
  | { readonly type: "list"; readonly ordered: boolean; readonly items: readonly (readonly Inline[])[] };

/** Counts the parser's steps, so a test can prove it linear without a timer. */
export type Meter = { steps: number };

/** The starter `link.href` rule. */
const linkRule = { schemes: ["https"], relative: true } as const;
const escapable = "\\*_`[]()#";

/** `checkUrl` rejects C0 and space; DEL and C1 are refused here too, so no control character reaches an `href`. */
const safeTarget = (target: string): boolean => {
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i);
    if (code >= 0x7f && code <= 0x9f) return false;
  }
  return checkUrl(target, linkRule);
};

const isWord = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/**
 * One line's characters with escapes applied, and for each position the next unescaped occurrence of each delimiter
 * at or after it. The tables are built in one pass from the end, so every opener finds its closer in O(1).
 */
function scan(line: string, meter: Meter) {
  const chars: string[] = [];
  const escaped: boolean[] = [];
  for (let i = 0; i < line.length; i++) {
    meter.steps++;
    const c = line[i] as string;
    const next = line[i + 1];
    if (c === "\\" && next !== undefined && escapable.includes(next)) {
      chars.push(next);
      escaped.push(true);
      i++;
    } else {
      chars.push(c);
      escaped.push(false);
    }
  }
  const n = chars.length;
  const at = (i: number, c: string) => i < n && chars[i] === c && !escaped[i];
  const tables = { star: [] as number[], double: [] as number[], under: [] as number[], tick: [] as number[] };
  const close = { bracket: [] as number[], paren: [] as number[] };
  let star = n;
  let double = n;
  let under = n;
  let tick = n;
  let bracket = n;
  let paren = n;
  for (let i = n - 1; i >= 0; i--) {
    meter.steps++;
    if (at(i, "*")) star = i;
    if (at(i, "*") && at(i + 1, "*")) double = i;
    // An underscore closes emphasis only where no letter or digit follows it, so `snake_case_name` stays text.
    if (at(i, "_") && !isWord(chars[i + 1])) under = i;
    if (at(i, "`")) tick = i;
    if (at(i, "]")) bracket = i;
    if (at(i, ")")) paren = i;
    tables.star[i] = star;
    tables.double[i] = double;
    tables.under[i] = under;
    tables.tick[i] = tick;
    close.bracket[i] = bracket;
    close.paren[i] = paren;
  }
  const next = (table: number[], i: number) => (i < n ? (table[i] as number) : n);
  return { chars, at, n, next, tables, close };
}

type Scan = ReturnType<typeof scan>;
type Level = "line" | "strong";

/** Parses `[from, to)` of a scanned line. Inside `strong` only emphasis nests; nothing nests inside emphasis. */
function inline(s: Scan, from: number, to: number, level: Level, meter: Meter): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push(text);
    text = "";
  };
  const slice = (a: number, b: number) => s.chars.slice(a, b).join("");
  let i = from;
  while (i < to) {
    meter.steps++;
    const c = s.chars[i] as string;
    if (s.at(i, "`")) {
      const end = s.next(s.tables.tick, i + 1);
      if (end < to && end > i + 1) {
        flush();
        out.push({ type: "code", text: slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (level === "line" && s.at(i, "*") && s.at(i + 1, "*")) {
      const end = s.next(s.tables.double, i + 2);
      if (end < to && end > i + 2) {
        flush();
        out.push({ type: "strong", children: inline(s, i + 2, end, "strong", meter) });
        i = end + 2;
        continue;
      }
      // An unclosed `**` is two literal stars.
      text += "**";
      i += 2;
      continue;
    } else if (s.at(i, "*") || (s.at(i, "_") && !isWord(s.chars[i - 1]))) {
      const end = s.next(c === "*" ? s.tables.star : s.tables.under, i + 1);
      if (end < to && end > i + 1) {
        flush();
        out.push({ type: "em", text: slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    } else if (level === "line" && s.at(i, "[")) {
      const label = s.next(s.close.bracket, i + 1);
      const end = label + 1 < to && s.at(label + 1, "(") ? s.next(s.close.paren, label + 2) : s.n;
      if (end < to) {
        const target = slice(label + 2, end);
        // A target outside the rule draws the whole `[label](target)` as text.
        if (label > i + 1 && safeTarget(target)) {
          flush();
          out.push({ type: "link", label: slice(i + 1, label), target });
        } else text += slice(i, end + 1);
        meter.steps += target.length;
        i = end + 1;
        continue;
      }
    }
    text += c;
    i++;
  }
  flush();
  return out;
}

const lineInline = (line: string, meter: Meter): Inline[] => {
  const s = scan(line, meter);
  return inline(s, 0, s.n, "line", meter);
};

const heading = /^(#{1,3}) +(.*)$/;
const bullet = /^[-*] +(.*)$/;
const numbered = /^\d{1,9}\. +(.*)$/;

/** Parses formatted text into blocks. Linear in the text's length: each character is scanned a fixed number of times. */
export function parseRichText(text: string, meter: Meter = { steps: 0 }): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[] | undefined;
  let list: { ordered: boolean; items: Inline[][] } | undefined;
  const end = () => {
    if (paragraph) blocks.push({ type: "paragraph", children: paragraph });
    if (list) blocks.push({ type: "list", ...list });
    paragraph = undefined;
    list = undefined;
  };
  for (const raw of text.split(/\r\n?|\n/)) {
    meter.steps++;
    const line = raw.trim();
    if (!line) {
      end();
      continue;
    }
    const h = heading.exec(line);
    if (h) {
      end();
      blocks.push({
        type: "heading",
        depth: (h[1] as string).length as 1 | 2 | 3,
        children: lineInline(h[2] as string, meter),
      });
      continue;
    }
    const b = bullet.exec(line);
    const o = b ? null : numbered.exec(line);
    const item = b ?? o;
    if (item) {
      const ordered = o !== null;
      if (!list || list.ordered !== ordered) {
        end();
        list = { ordered, items: [] };
      }
      list.items.push(lineInline(item[1] as string, meter));
      continue;
    }
    if (list) end();
    // Lines of one paragraph are joined by a line break the browser draws as a space.
    if (paragraph) paragraph.push("\n");
    else paragraph = [];
    paragraph.push(...lineInline(line, meter));
  }
  end();
  return blocks;
}
