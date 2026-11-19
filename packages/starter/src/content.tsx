import { type Implementation, implement } from "@arnilo/liveframe/react";
import { createElement, type ReactNode } from "react";
import * as Aria from "react-aria-components";
import { type Inline, parseRichText } from "./rich-text.ts";
import { Chart, RichText, Table, TableCell, TableRow } from "./ui.definitions.gen.ts";

/**
 * Children passed as arguments, not as an array: drawn content has no identity beyond its position, and React keys
 * arguments by position itself.
 */
const el = (type: string, props: object | null, children: readonly ReactNode[]) =>
  createElement(type, props, ...children);

type Slot = (name: "code" | "link") => string;

function inline(child: Inline, slot: Slot): ReactNode {
  // A soft line break inside a paragraph is text, which the browser draws as a space.
  if (typeof child === "string") return child;
  if (child.type === "strong")
    return el(
      "strong",
      null,
      child.children.map((part) => inline(part, slot)),
    );
  if (child.type === "em") return <em>{child.text}</em>;
  if (child.type === "code") return <code className={slot("code")}>{child.text}</code>;
  // The target passed `checkUrl` with the starter `link.href` rule in the parser; a failing one is already text.
  return (
    <Aria.Link href={child.target} className={slot("link")}>
      {child.label}
    </Aria.Link>
  );
}
const inlines = (children: readonly Inline[], slot: Slot) => children.map((child) => inline(child, slot));

/** Ticks with a 1, 2 or 5 step over a range that always holds zero, so bars stand on a zero baseline. */
export function scale(values: readonly number[]) {
  let low = 0;
  let high = 0;
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  if (low === high) high = 1;
  const raw = (high - low) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = (raw / power <= 1 ? 1 : raw / power <= 2 ? 2 : raw / power <= 5 ? 5 : 10) * power;
  const from = Math.floor(low / step) * step;
  const to = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = from; tick <= to + step / 2; tick += step) ticks.push(Number(tick.toPrecision(12)));
  /** A value's position from the top of the plot, in percent. */
  const y = (value: number) => ((to - value) / (to - from)) * 100;
  return { ticks, y };
}

type Series = { readonly name: string; readonly values: readonly number[] };
const seriesSlots = ["series1", "series2", "series3", "series4"] as const;

/** The chart's text alternative: every drawn point, by series. */
export function describeChart(labels: readonly string[], series: readonly Series[]): string {
  const points = (s: Series) =>
    s.values
      .slice(0, labels.length)
      .map((value, i) => `${labels[i]} ${value}`)
      .join(", ");
  return series.map((s) => `${s.name}: ${points(s)}`).join("; ");
}

/** `richText`, `chart` and the table kinds: content the browser must lay out itself. */
export const content: Implementation[] = [
  implement(RichText, ({ props, slot, style }) => {
    const base = props.headingLevel ?? 3;
    const blocks = parseRichText(props.text).map((block) => {
      if (block.type === "paragraph") return el("p", { className: slot("paragraph") }, inlines(block.children, slot));
      if (block.type === "heading")
        return el(
          `h${Math.min(6, base + block.depth - 1)}`,
          { className: slot("heading") },
          inlines(block.children, slot),
        );
      return el(
        block.ordered ? "ol" : "ul",
        { className: slot("list") },
        block.items.map((item) => el("li", { className: slot("item") }, inlines(item, slot))),
      );
    });
    return el("div", { className: slot("root"), style }, blocks);
  }),
  implement(Chart, ({ props, slot, style }) => {
    const { labels, series } = props;
    const count = labels.length;
    const { ticks, y } = scale(series.flatMap((s) => s.values.slice(0, count)));
    const band = count ? 100 / count : 0;
    const width = (band * 0.8) / series.length;
    const summary = [props.summary, describeChart(labels, series)].filter(Boolean).join(" ");
    const paint = (n: number) => slot(seriesSlots[n] ?? "series4");
    const points = (s: Series) =>
      s.values
        .slice(0, count)
        .map((value, i) => `${i * band + band / 2},${y(value)}`)
        .join(" ");
    const marks = (s: Series, n: number) =>
      props.type === "bar"
        ? el(
            "g",
            { className: paint(n), fill: "currentColor" },
            s.values.slice(0, count).map((value, i) =>
              el(
                "rect",
                {
                  x: i * band + band * 0.1 + n * width,
                  y: Math.min(y(value), y(0)),
                  width,
                  height: Math.abs(y(value) - y(0)),
                },
                [],
              ),
            ),
          )
        : el("g", { className: paint(n), fill: "none", stroke: "currentColor" }, [
            el("polyline", { strokeWidth: 2, vectorEffect: "non-scaling-stroke", points: points(s) }, []),
          ]);
    const hidden = (className: string) => ({ "aria-hidden": "true", className });
    // Geometry only: every mark paints `currentColor`, and its series slot's recipe sets the colour (law 3).
    return (
      <div className={`${slot("root")} starter-chart`} style={style}>
        <div className="starter-chart-area">
          {el(
            "div",
            hidden(`${slot("axis")} starter-chart-ticks`),
            ticks.map((tick) => el("span", { style: { insetBlockStart: `${y(tick)}%` } }, [tick])),
          )}
          {el(
            "svg",
            {
              className: slot("plot"),
              role: "img",
              "aria-label": props.label,
              viewBox: "0 0 100 100",
              preserveAspectRatio: "none",
            },
            [
              el("title", null, [props.label]),
              el("desc", null, [summary]),
              el(
                "g",
                { className: slot("gridline"), stroke: "currentColor" },
                ticks.map((tick) =>
                  el("line", { x1: 0, x2: 100, y1: y(tick), y2: y(tick), vectorEffect: "non-scaling-stroke" }, []),
                ),
              ),
              ...series.map(marks),
            ],
          )}
          {el(
            "div",
            hidden(`${slot("axis")} starter-chart-labels`),
            labels.map((label) => el("span", null, [label])),
          )}
        </div>
        {el(
          "ul",
          hidden(`${slot("legend")} starter-chart-legend`),
          series.map((s, n) => el("li", null, [el("span", { className: `${paint(n)} starter-swatch` }, []), s.name])),
        )}
      </div>
    );
  }),
  // A static data table needs no grid focus, so it is native table markup, not React Aria `Table`.
  implement(Table, ({ props, slot, style, children }) => (
    <table className={slot("root")} style={style} aria-label={props.label}>
      {props.caption === undefined ? null : <caption className={slot("caption")}>{props.caption}</caption>}
      <tbody>{children}</tbody>
    </table>
  )),
  implement(TableRow, ({ slot, style, children }) => (
    <tr className={slot("root")} style={style}>
      {children}
    </tr>
  )),
  implement(TableCell, ({ props, slot, style, children }) => {
    const span = props.span === undefined || props.span === 1 ? {} : { colSpan: props.span };
    return props.header === undefined ? (
      <td className={slot("root")} style={style} {...span}>
        {children}
      </td>
    ) : (
      <th className={slot("root")} style={style} scope={props.header === "column" ? "col" : "row"} {...span}>
        {children}
      </th>
    );
  }),
];
