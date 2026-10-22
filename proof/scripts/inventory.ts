/**
 * Cause-grouped inventory of the parity capture's DOM and style differences.
 *
 * `parity.ts` compares element paths positionally, so one wrapper shifts every descendant and the
 * difference count says nothing about the causes. This collapses anonymous wrappers (a div or span
 * with no attributes and no direct text) and compares the remaining semantic elements in order, then
 * groups the style differences by anchor. Reads the capture `parity.ts` already wrote; no browser, no
 * network, no dependency.
 *
 *   timeout 60 bun proof/scripts/inventory.ts --dir evidence/parity
 */

import { readFileSync } from "node:fs";

type Element = { tag: string; attributes: Record<string, string>; text: string };
type Capture = { approved: Record<string, Element>; widget: Record<string, Element> };

const ignored = new Set(["class", "style", "id", "aria-labelledby", "aria-describedby", "aria-controls", "for"]);
const args = process.argv.slice(2);
const dir = args[args.indexOf("--dir") + 1] ?? "evidence/parity";
const widths = [1440, 1024, 390];

function semantic(tree: Record<string, Element>): string[] {
  const children = new Map<string, string[]>();
  for (const path of Object.keys(tree)) {
    if (path === "queue") continue;
    const parent = path.slice(0, path.lastIndexOf("/"));
    children.set(parent, [...(children.get(parent) ?? []), path]);
  }
  for (const list of children.values())
    list.sort((a, b) => Number(a.slice(a.lastIndexOf("/") + 1)) - Number(b.slice(b.lastIndexOf("/") + 1)));
  const lines: string[] = [];
  const walk = (path: string, depth: number) => {
    const node = tree[path];
    if (!node) throw new Error(`Missing element at ${path}`);
    const attributes = Object.fromEntries(Object.entries(node.attributes).filter(([name]) => !ignored.has(name)));
    const semanticNode = node.tag !== "div" && node.tag !== "span" && node.tag !== "template";
    if (semanticNode || Object.keys(attributes).length > 0 || node.text.length > 0) {
      const shown = Object.keys(attributes).length ? ` ${JSON.stringify(attributes)}` : "";
      lines.push(`${"  ".repeat(depth)}${node.tag}${shown}${node.text ? ` "${node.text.slice(0, 60)}"` : ""}`);
      depth += 1;
    }
    for (const child of children.get(path) ?? []) walk(child, depth);
  };
  for (const child of children.get("queue") ?? []) walk(child, 0);
  return lines;
}

function hunks(approved: string[], widget: string[]): string[][] {
  // Longest common subsequence over the semantic lines, so the report shows what actually diverged.
  const n = approved.length;
  const m = widget.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1)
    for (let j = m - 1; j >= 0; j -= 1)
      table[i]![j] =
        approved[i] === widget[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const result: string[][] = [];
  let i = 0;
  let j = 0;
  let open: string[] | null = null;
  while (i < n || j < m) {
    if (i < n && j < m && approved[i] === widget[j]) {
      if (open) result.push(open);
      open = null;
      i += 1;
      j += 1;
      continue;
    }
    open ??= [];
    if (j >= m || (i < n && table[i + 1]![j]! >= table[i]![j + 1]!)) open.push(`- ${approved[i++]!.trim()}`);
    else open.push(`+ ${widget[j++]!.trim()}`);
  }
  if (open) result.push(open);
  return result;
}

// Why each divergence exists; the first matching rule names the cause. Order matters: the most
// specific markup wins over a shared tag such as `span` or `button`.
const causes: [RegExp, string][] = [
  [
    /tablist|"role":"tab"|tabpanel|aria-orientation/,
    "Tabs are React Aria markup (tablist adds aria-orientation, a tab is a div[role=tab], the panel always renders) and one label string carries the count",
  ],
  [
    /role":"img"|"svg"|"use"|"path"|"circle"/,
    "An icon is an inline glyph in span[role=img][aria-hidden], not an svg > use reference to a sprite symbol",
  ],
  [/"dt"|"dd"|"dl"/, "Facts render dt/dd text in a child span, and each column pair is its own dl"],
  [/"details"|"summary"|aria-expanded/, "Widget options are a menu popup button, not native details > summary"],
  [/"hr"/, "The header's bottom border is a separator element, not a border on the header"],
  [/"p"/, "Prose is a text span; the catalog has no paragraph primitive"],
  [/"a"/, "An action is a button carrying an intent, not a link"],
  [/"next"/i, "A button label sits in its own span slot"],
  [/^[+-] span "/, "A text element renders a span where the source used a div"],
  [/^[+-] (div|span) \{/, "An attribute differs on the same element"],
];

const causeOf = (hunk: string[]): string => {
  const text = hunk.join("\n");
  return causes.find(([pattern]) => pattern.test(text))?.[1] ?? "Unclassified";
};

const styleDifferences = widths.map((width) => {
  const styles = JSON.parse(readFileSync(`${dir}/${width}-styles.json`, "utf8")) as {
    differences: { anchor: string; property: string; approved: string; widget: string }[];
  };
  return styles.differences;
});

console.log("# Cause-grouped parity inventory\n");
console.log(
  `Generated by \`bun proof/scripts/inventory.ts --dir ${dir}\` from the capture \`parity.ts\` wrote. ` +
    "Wrapper elements (a `div`/`span` with no attributes and no direct text) are collapsed, then the semantic trees are compared in order; " +
    "one wrapper therefore no longer counts as hundreds of differences.\n",
);
for (const width of widths) {
  const capture = JSON.parse(readFileSync(`${dir}/${width}-dom.json`, "utf8")) as Capture;
  const approved = semantic(capture.approved);
  const widget = semantic(capture.widget);
  const groups = hunks(approved, widget);
  console.log(`## ${width} px\n`);
  console.log(
    `Semantic elements: approved ${approved.length}, widget ${widget.length}. Divergent groups: ${groups.length}.\n`,
  );
  groups.forEach((group, index) => {
    console.log(`### Group ${index + 1}\n`);
    for (const line of group) console.log(`- \`${line}\``);
    console.log("");
  });
}
console.log("## Style differences\n");
console.log("| Width | Anchor | Property | Approved | Widget |");
console.log("| --- | --- | --- | --- | --- |");
widths.forEach((width, index) => {
  for (const difference of styleDifferences[index] ?? [])
    console.log(
      `| ${width} | ${difference.anchor} | ${difference.property} | ${difference.approved} | ${difference.widget} |`,
    );
});
