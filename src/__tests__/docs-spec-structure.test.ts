import { expect, test } from "bun:test";

const spec = await Bun.file(new URL("../../docs/spec.md", import.meta.url)).text();

function longParagraphs(markdown: string): string[] {
  return markdown
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm, "")
    .split(/\n\s*\n|\n(?=\s*(?:[-*]|\d+\.) )/)
    .filter((paragraph) => !/^\s*(?:#|\||---)/.test(paragraph))
    .filter((paragraph) => paragraph.trim().split(/\s+/).length > 160);
}

function releaseReferences(markdown: string): string[] {
  return [...markdown.replace(/`decision-logs\/[^`\n]+`/g, "").matchAll(/\b0\.[12]\.\d\b/g)].map(
    ([version]) => version,
  );
}

test("spec_structure_checks_detect_long_prose_and_release_history", () => {
  const long = "word ".repeat(161).trim();
  expect(longParagraphs(long)).toEqual([long]);
  expect(longParagraphs(`- ${long}\n- Short rule.`)).toHaveLength(1);
  expect(longParagraphs(`\`\`\`ts\n${long}\n\`\`\``)).toEqual([]);
  expect(longParagraphs(`  \`\`\`ts\n  ${long}\n  \`\`\``)).toEqual([]);
  expect(longParagraphs("word ".repeat(160).trim())).toEqual([]);
  expect(releaseReferences("As in 0.2.1; directories from 0.1.0.")).toEqual(["0.2.1", "0.1.0"]);
  expect(releaseReferences("`decision-logs/date-release-0-1-0.md`")).toEqual([]);
  expect(releaseReferences("`decision-logs/date-0.2.1.md` says 0.2.1")).toEqual(["0.2.1"]);
});

test("spec_paragraphs_stay_short", () => {
  expect(longParagraphs(spec)).toEqual([]);
});

test("spec_carries_no_release_history", () => {
  expect(releaseReferences(spec)).toEqual([]);
});

test("spec_sections_open_with_numbered_rules", () => {
  const sections = [...spec.matchAll(/^#{2,3} (\d+(?:\.\d+)?)[^\n]*\n([\s\S]*?)(?=^#{2,3} |$(?![\s\S]))/gm)];
  expect(sections.filter(([, number]) => !number?.includes(".")).map(([, number]) => Number(number))).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
  for (const [, number, body] of sections) {
    expect(body?.trimStart(), `Section ${number}`).toMatch(/^\*\*Rules\*\*\n\n1\. /);
    expect(body, `Section ${number}`).toContain("**Rationale**");
  }
});

test("spec_preserves_section_anchors_and_the_four_laws", () => {
  expect(spec.match(/^#{2,3} .+$/gm)).toEqual([
    "## 1. Purpose",
    "## 2. The model",
    "## 3. What the library ships, and what the app provides",
    "## 4. Concepts",
    "## 5. Component definitions",
    "## 6. Styling (Clay's model)",
    "### 6.1 Theme: the only colour source",
    "### 6.2 Design system: values and recipes",
    "### 6.3 Style props: what authors may set",
    "### 6.4 How styling reaches the screen",
    "### 6.5 The declared vocabulary",
    "## 7. Authoring and installing (Synapta's model)",
    "### 7.1 Widgets",
    "### 7.2 The SDK",
    "### 7.3 Packages",
    "### 7.4 Storage",
    "### 7.5 Runners and preview",
    "### 7.6 Template widgets",
    "## 8. Interaction (Synapta's three tiers)",
    "## 9. The UI tree (wire format)",
    "### 9.1 Optional tree patches",
    "## 10. Validation",
    "## 11. Renderer",
    "## 12. First task: prove the primitive set on two real UIs",
    "## 13. Tech stack and packages",
    "## 14. Non-goals for v1",
    "## 15. Open decisions",
  ]);
  expect(spec).toContain(
    "1. Widget code never runs in the browser. Only the app's compiled primitives run there.\n" +
      "2. The UI tree is data, and it is validated before the renderer reads it.\n" +
      "3. Widget code never sets colours or raw CSS. Look comes from the design system; layout comes from token-constrained style props.\n" +
      "4. A widget never holds authority. Data is resolved and actions are run by the app, as the viewer.",
  );
});
