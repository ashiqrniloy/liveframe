/** @jsxImportSource @arnilo/liveframe/sdk */
import {
  arr,
  bindSources,
  type Capabilities,
  compileValidator,
  type Infer,
  int,
  obj,
  str,
  type UiTree,
  validateCapabilities,
} from "@arnilo/liveframe";
import { render, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { catalog } from "../catalog.ts";
import { Button, Inline, Scroll, Text } from "../ui.gen.ts";

// A list longer than the node limit (docs/sdk.md, "Lists longer than the node limit"): the range the user sees is
// widget state, the source reads only the rows around it, and `scroll` reserves the space of the rest.

/** The most rows one tree draws. */
export const MAX_ROWS = 200;
/** Rows read beyond each edge of the visible range, so a short scroll needs no new tree. */
const OVERSCAN = 60;
export const TOTAL = 50_000;

const range = obj({
  start: int({ minimum: 0, maximum: 1_000_000_000 }),
  end: int({ minimum: 0, maximum: 1_000_000_000 }),
});
const page = obj({
  total: int({ minimum: 0, maximum: 1_000_000_000 }),
  offset: int({ minimum: 0, maximum: 1_000_000_000 }),
  rows: arr(obj({ id: str({ maxLength: 16 }), title: str({ maxLength: 80 }) }), { maxItems: MAX_ROWS }),
});
type Range = Infer<typeof range>;
export type Page = Infer<typeof page>;

const checked = validateCapabilities({
  format: "liveframe-capabilities/1",
  sources: { "rows.window": { description: "The rows around a visible range.", params: range, result: page } },
  actions: {},
});
if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
export const capabilities: Capabilities = checked.value;

export const manifest = {
  format: "liveframe-manifest/1",
  id: "windowed-list",
  version: "1",
  catalogId: catalog.catalogId,
  params: obj({}),
  context: obj({}),
  state: obj({ range }),
  initialState: { range: { start: 0, end: 0 } },
  sources: {
    rows: {
      source: "rows.window",
      params: { start: { from: "state", path: "range.start" }, end: { from: "state", path: "range.end" } },
    },
  },
  actions: [],
} as const;

export const validator = compileValidator({ catalog, capabilities, manifest });

/** The app's source: the visible range plus overscan, clamped to the collection and to `MAX_ROWS`. */
export function readWindow({ start, end }: Range, total = TOTAL): Page {
  const from = Math.max(0, Math.min(start, total) - OVERSCAN);
  const to = Math.min(total, from + MAX_ROWS, Math.max(end, start) + OVERSCAN);
  return rowsAt(from, to, total);
}

export function rowsAt(from: number, to: number, total = TOTAL): Page {
  const rows = Array.from({ length: Math.max(0, to - from) }, (_, i) => ({
    id: String(from + i),
    title: `Row ${from + i}`,
  }));
  return { total, offset: from, rows };
}

/** Rows are direct children of the scroll and exactly one `size.row` tall, so the reserved space matches. */
export function WindowedList({ data }: WidgetProps<object, { range: Range }, { rows: Page }, object>) {
  const { total, offset, rows } = data.rows;
  return (
    <Scroll
      label="Rows"
      axis="vertical"
      height="size.panel"
      itemCount={total}
      itemStart={offset}
      itemSize="size.row"
      onRange={state.set("range")}
    >
      {rows.slice(0, MAX_ROWS).map((row) => (
        <Inline key={row.id} height="size.row" paddingX="space.3" gap="space.3">
          <Text text={row.title} grow={1} />
          <Button label="Open" variant="ghost" />
        </Inline>
      ))}
    </Scroll>
  );
}

/** The tree for a state, read the way a host would: bind the source to the range, read it, then render. */
export function windowTree(range: Range, revision: number): UiTree {
  const bound = bindSources(manifest, capabilities, { params: {}, state: { range }, context: {} });
  if (!bound.ok) throw new Error(JSON.stringify(bound.errors));
  return pageTree(readWindow(bound.value.rows?.params as Range), revision);
}

/** The tree that draws one page of rows. */
export function pageTree(rows: Page, revision: number): UiTree {
  const result = render(
    WindowedList,
    { params: {}, context: {}, state: { range: { start: rows.offset, end: rows.offset } }, data: { rows } },
    { validator, surfaceId: "windowed", revision },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
