import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { compileValidator, type UiNode } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { catalog } from "../catalog.ts";
import { describeChart, scale } from "../content.tsx";
import { designSystem } from "../design-system.ts";
import { implementations } from "../implementations.tsx";
import { type Meter, parseRichText } from "../rich-text.ts";
import { themes } from "../themes.ts";
import { capabilities, manifest, tree } from "./host.ts";

const { Surface } = createRenderer({ catalog, implementations });
const validator = compileValidator({ catalog, capabilities, manifest });
const [theme] = themes;
if (!theme) throw new Error("Missing theme");

/** Server markup of one node, after the validator has accepted its tree. */
function draw(node: UiNode): string {
  const checked = tree("content", node);
  expect(validator.validateTree(checked).ok).toBe(true);
  return renderToString(
    createElement(Surface, { tree: checked, validator, theme, designSystem, fallback: "Unavailable", onIntent() {} }),
  );
}
const rich = (text: string) => draw({ id: "root", kind: "richText", props: { text } });

test("rich_text_parses_the_closed_subset", () => {
  expect(
    parseRichText(
      "# Title\n\nSome **bold *and em* text**, _em_, `code` and [a](/x).\nNext line\n\n- one\n* two\n\n1. first",
    ),
  ).toEqual([
    { type: "heading", depth: 1, children: ["Title"] },
    {
      type: "paragraph",
      children: [
        "Some ",
        { type: "strong", children: ["bold ", { type: "em", text: "and em" }, " text"] },
        ", ",
        { type: "em", text: "em" },
        ", ",
        { type: "code", text: "code" },
        " and ",
        { type: "link", label: "a", target: "/x" },
        ".",
        "\n",
        "Next line",
      ],
    },
    { type: "list", ordered: false, items: [["one"], ["two"]] },
    { type: "list", ordered: true, items: [["first"]] },
  ]);
});

test("rich_text_leaves_unclosed_and_escaped_delimiters_as_text", () => {
  expect(parseRichText("a **b and *c and `d and [e")).toEqual([
    { type: "paragraph", children: ["a **b and *c and `d and [e"] },
  ]);
  expect(parseRichText("\\*not em\\* and \\# \\[x\\](y) snake_case_name")).toEqual([
    { type: "paragraph", children: ["*not em* and # [x](y) snake_case_name"] },
  ]);
  // A delimiter never closes on the next line, and `####` is not a heading.
  expect(parseRichText("*a\nb*\n\n#### four")).toEqual([
    { type: "paragraph", children: ["*a", "\n", "b*"] },
    { type: "paragraph", children: ["#### four"] },
  ]);
});

test("formatted_text_draws_no_html_from_its_string", () => {
  const html = rich('<img src=x onerror="alert(1)"> and <script>alert(2)</script> **<b>bold</b>**');
  expect(html).not.toContain("<img");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<b>");
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
  expect(html).toContain("<strong>&lt;b&gt;bold&lt;/b&gt;</strong>");
});

test("link_outside_the_scheme_allowlist_is_drawn_as_text", () => {
  for (const target of ["javascript:alert(1)", "java\tscript:alert(1)", "//evil.example", "http://plain.example"]) {
    const blocks = parseRichText(`see [here](${target}) now`);
    expect(blocks).toEqual([{ type: "paragraph", children: [`see [here](${target}) now`] }]);
    expect(rich(`see [here](${target}) now`)).not.toContain("<a");
  }
  // DEL and C1 controls, which `checkUrl` leaves to the caller.
  for (const control of ["\u007f", "\u0085"])
    expect(parseRichText(`[x](https://a.example/${control})`)[0]).toEqual({
      type: "paragraph",
      children: [`[x](https://a.example/${control})`],
    });
  const html = rich("see [here](https://example.com/r) and [there](/local)");
  expect(html).toContain('href="https://example.com/r"');
  expect(html).toContain('href="/local"');
});

test("rich_text_headings_start_at_heading_level", () => {
  const html = draw({ id: "root", kind: "richText", props: { text: "# a\n\n## b\n\n### c", headingLevel: 5 } });
  expect(html).toMatch(/<h5[^>]*>a<\/h5>/);
  expect(html).toMatch(/<h6[^>]*>b<\/h6>/);
  // Capped at 6.
  expect(html).toMatch(/<h6[^>]*>c<\/h6>/);
});

test("rich_text_parse_is_linear", () => {
  // Inputs built to defeat a backtracking parser: openers whose closer is far or missing, and many link starts.
  const shapes = [
    (n: number) => "*".repeat(n),
    (n: number) => "[a](".repeat(Math.ceil(n / 4)).slice(0, n),
    (n: number) => "**a *b ".repeat(Math.ceil(n / 7)).slice(0, n),
    (n: number) => "_x".repeat(Math.ceil(n / 2)).slice(0, n),
    (n: number) => "`[*_".repeat(Math.ceil(n / 4)).slice(0, n),
    (n: number) => "- a\n".repeat(Math.ceil(n / 4)).slice(0, n),
  ];
  for (const shape of shapes) {
    const steps = (n: number) => {
      const meter: Meter = { steps: 0 };
      parseRichText(shape(n), meter);
      return meter.steps;
    };
    const ratio = steps(4000) / steps(2000);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
    // A fixed number of steps per character.
    expect(steps(4000)).toBeLessThan(4000 * 6);
  }
});

test("table_headers_carry_their_scope", () => {
  const cell = (id: string, props: UiNode["props"]): UiNode => ({
    id,
    kind: "tableCell",
    props,
    children: [{ id: `${id}/text`, kind: "text", props: { text: id.slice(-1) } }],
  });
  const html = draw({
    id: "root",
    kind: "table",
    props: { label: "Tasks", caption: "Open tasks" },
    children: [
      {
        id: "root/h",
        kind: "tableRow",
        props: {},
        children: [cell("root/h/a", {}), cell("root/h/b", { header: "column" })],
      },
      {
        id: "root/r",
        kind: "tableRow",
        props: {},
        children: [cell("root/r/c", { header: "row" }), cell("root/r/d", { span: 2 })],
      },
    ],
  });
  expect(html).toMatch(/<table[^>]*aria-label="Tasks"/);
  expect(html).toMatch(/<caption[^>]*>Open tasks<\/caption>/);
  expect(html).toMatch(/<td class="lf_tableCell_default_root"[^>]*>.*?a/);
  expect(html).toMatch(/<th[^>]*scope="col"[^>]*>/);
  expect(html).toMatch(/<th[^>]*scope="row"[^>]*>/);
  expect(html).toMatch(/<td[^>]*colSpan="2"|<td[^>]*colspan="2"/);
  // Rows sit directly in the body: no wrapper element breaks the table's structure.
  expect(html).toMatch(/<tbody><tr[^>]*><td/);
});

test("chart_scale_has_a_zero_baseline_and_round_ticks", () => {
  expect(scale([3, 5]).ticks).toEqual([0, 2, 4, 6]);
  expect(scale([-30, 70]).ticks).toEqual([-50, 0, 50, 100]);
  expect(scale([]).ticks).toEqual([0, 0.5, 1]);
  const { y } = scale([0, 10]);
  expect([y(10), y(0)]).toEqual([0, 100]);
  // A series shorter than the labels describes only its points.
  expect(describeChart(["Mon", "Tue"], [{ name: "Closed", values: [3] }])).toBe("Closed: Mon 3");
});

test("chart_marks_paint_current_colour_under_their_series_slot", () => {
  const html = draw({
    id: "root",
    kind: "chart",
    props: {
      label: "Closed per day",
      type: "bar",
      labels: ["Mon", "Tue"],
      series: [
        { name: "Closed", values: [3, 5] },
        { name: "Opened", values: [2, 4] },
      ],
    },
  });
  expect(html).toContain('<g class="lf_chart_default_series1" fill="currentColor">');
  expect(html).toContain('<g class="lf_chart_default_series2" fill="currentColor">');
  // No literal colour anywhere in the drawn chart (law 3).
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
});

test("starter_source_has_no_inner_html", () => {
  const root = new URL("..", import.meta.url).pathname;
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
    // Every source and test file but this one, which names the properties it looks for.
    (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith("rich-text.test.ts"),
  );
  expect(files.length).toBeGreaterThan(5);
  for (const file of files)
    expect({
      file,
      found: /dangerouslySetInnerHTML|innerHTML|outerHTML/.test(readFileSync(join(root, file), "utf8")),
    }).toEqual({ file, found: false });
});
