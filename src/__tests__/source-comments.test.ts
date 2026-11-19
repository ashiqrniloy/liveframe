import { expect, test } from "bun:test";
import { Glob } from "bun";

// A source comment states its rule and, where one exists, the spec section. Plans are execution state
// (AGENTS.md, "Authority order"), so a comment that cites a plan, a plan task, a design id or a decision
// by date sends the reader to a document that may move or be superseded.

const root = new URL("../../", import.meta.url).pathname;

const CITATIONS = [
  /\b[Pp]lan [0-9]{3}\b/,
  /\bdecision [0-9]{4}-[0-9]{2}-[0-9]{2}\b/,
  /\b(?:[Pp]lan|[Dd]esign) [A-Z][0-9]+(?:\.[0-9]+)?\b/,
  /\b[Tt]ask [0-9]+\b/,
];

/** Each comment's text in `source`, with the line it starts on. */
function comments(source: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  let line = 1;
  let counted = 0;
  for (const match of source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)) {
    for (; counted < match.index; counted++) if (source[counted] === "\n") line++;
    // `//` inside a string or a URL is not a comment: skip one with a single unclosed quote before it on its line.
    const prefix = source.slice(source.lastIndexOf("\n", match.index) + 1, match.index);
    if (match[0].startsWith("//") && /^[^"'`]*["'`][^"'`]*$/.test(prefix)) continue;
    found.push({ line, text: match[0] });
  }
  return found;
}

function citations(source: string): string[] {
  return comments(source)
    .filter(({ text }) => CITATIONS.some((pattern) => pattern.test(text)))
    .map(({ line, text }) => `${line}: ${text.trim().split("\n")[0]}`);
}

test("citation_check_finds_ids_in_comments_only", () => {
  expect(citations("// `setLocal` is the renderer's own (plan 029 L3).")).toHaveLength(1);
  expect(citations("/**\n * Rules (decision 2026-11-08-2310): never.\n */")).toHaveLength(1);
  expect(citations("/** Bounds checked at install (design T10). */")).toHaveLength(1);
  expect(citations("// `renderTemplate` (Task 4) can rely on it.")).toHaveLength(1);
  expect(citations("// Applied by the renderer and never sent to the host (spec §8).")).toEqual([]);
  expect(citations('const label = "plan 029";')).toEqual([]);
});

test("source_comments_cite_no_plan_or_decision_ids", async () => {
  const offending: string[] = [];
  for (const pattern of ["src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"]) {
    for await (const path of new Glob(pattern).scan({ cwd: root })) {
      if (path.includes("/__tests__/")) continue;
      for (const hit of citations(await Bun.file(root + path).text())) offending.push(`${path}:${hit}`);
    }
  }
  expect(offending).toEqual([]);
});
