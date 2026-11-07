// A template port of the proof agent-home queue (plan 028): the same data, state and actions as
// `fixtures/widgets/agent-home/queue.tsx`, written as element JSON with expressions. Task 3 validates
// it and times the install check; Task 4 extends it to full parity and renders it.
import { arr, bool, num, obj, str } from "../../../schema.ts";
import type { Expr, Template, TemplateNode } from "../../../template/index.ts";

const p = (path: string) => ({ $path: path });
const text = (value: Expr, style: Record<string, unknown> = {}, key?: string): TemplateNode => ({
  kind: "text",
  ...(key ? { key } : {}),
  props: { text: value },
  style: style as never,
});
const heading = (value: Expr, level: number, style: Record<string, unknown> = {}, key?: string): TemplateNode => ({
  kind: "heading",
  ...(key ? { key } : {}),
  props: { text: value, level },
  style: style as never,
});

const category = str({ maxLength: 9, enum: ["decisions", "tasks", "alerts"] });

const queueRow: TemplateNode = {
  kind: "box",
  variant: "rule",
  style: { deferOffscreen: "space.7", surface: { $cond: [p("selected"), "surface.well", { $omit: null }] } },
  children: [
    {
      kind: "inline",
      key: "grid",
      style: {
        gap: "space.3",
        align: "start",
        paddingRight: { $cond: [{ $gt: [p("foldedAlerts"), 0] }, "space.0", "space.3"] },
      },
      children: [
        {
          kind: "icon",
          key: "marker",
          props: { name: { $cond: [{ $eq: [p("category"), "alerts"] }, "mk-struck", "mk-dashed"] } },
          style: {
            tone: { $cond: [{ $eq: [p("category"), "alerts"] }, "danger", "warning"] },
            width: "space.4",
            shrink: 0,
          },
        },
        {
          kind: "stack",
          key: "body",
          style: { gap: "space.1", align: "start", grow: 1, basis: 0 },
          children: [
            {
              kind: "button",
              key: "subject",
              variant: "ghost",
              props: { label: p("title"), current: p("selected") },
              events: { onPress: { type: "setState", key: "selected", value: p("id") } },
            },
            {
              kind: "inline",
              key: "meta",
              style: { gap: "space.1", wrap: "wrap", align: "center" },
              children: [
                text(p("status"), { textStyle: "mono", tone: "muted", paddingRight: "space.2" }),
                {
                  $each: { in: p("meta"), as: "entry", index: "at", key: p("entry") },
                  ...text(p("entry"), {}),
                  style: {
                    textStyle: "meta",
                    tone: "muted",
                    paddingRight: {
                      $cond: [{ $eq: [p("at"), { $sub: [{ $len: p("meta") }, 1] }] }, "space.0", "space.2"],
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          $if: { $gt: [p("foldedAlerts"), 0] },
          kind: "inline",
          key: "flag",
          style: { gap: "space.2", align: "center", shrink: 0 },
          children: [
            { kind: "icon", key: "marker", props: { name: "mk-solid" }, style: { tone: "info" } },
            {
              kind: "text",
              key: "word",
              props: { text: { $concat: [{ $text: p("foldedAlerts") }, " alert folded here"] } },
              style: { textStyle: "caption", tone: "warning" },
            },
          ],
        },
      ],
    },
  ],
};

const groupsOf = {
  $map: {
    in: p("permitted"),
    as: "group",
    value: {
      $let: {
        bind: [
          {
            as: "idx",
            value: {
              $findIndex: {
                in: p("group.pages"),
                as: "page",
                where: { $eq: [p("page.cursor"), { $get: [p("state.cursors"), p("group.id")] }] },
              },
            },
          },
        ],
        in: {
          $merge: [
            p("group"),
            {
              rows: {
                $flat: {
                  $map: {
                    in: { $slice: [p("group.pages"), 0, { $add: [p("idx"), 1] }] },
                    as: "page",
                    value: p("page.rows"),
                  },
                },
              },
              next: { $get: [{ $at: [p("group.pages"), p("idx")] }, "nextCursor"] },
            },
          ],
        },
      },
    },
  },
};

const withNext = { $filter: { in: p("groups"), as: "group", where: { $has: p("group.next") } } };

const ready: TemplateNode = {
  $let: [
    {
      as: "permitted",
      value: {
        $filter: {
          in: p("data.groups"),
          as: "group",
          where: { $or: [{ $ne: [p("group.id"), "alerts"] }, p("params.canViewAlerts")] },
        },
      },
    },
    { as: "groups", value: groupsOf },
    {
      as: "visible",
      value: {
        $filter: {
          in: p("groups"),
          as: "group",
          where: { $or: [{ $eq: [p("state.filter"), "all"] }, { $eq: [p("group.id"), p("state.filter")] }] },
        },
      },
    },
    { as: "rows", value: { $flat: { $map: { in: p("visible"), as: "group", value: p("group.rows") } } } },
    {
      as: "focus",
      value: {
        $coalesce: [
          { $at: [{ $filter: { in: p("rows"), as: "row", where: { $eq: [p("row.id"), p("state.selected")] } } }, 0] },
          { $at: [p("rows"), 0] },
        ],
      },
    },
    { as: "total", value: { $sum: { $map: { in: p("groups"), as: "group", value: p("group.total") } } } },
    { as: "showing", value: { $sum: { $map: { in: p("visible"), as: "group", value: p("group.total") } } } },
  ],
  $if: { $eq: [p("data.status"), "ready"] },
  kind: "stack",
  key: "ready",
  style: { gap: "space.3" },
  children: [
    {
      kind: "tabs",
      key: "tabs",
      props: { label: "Queue category", value: p("state.filter") },
      events: { onChange: { type: "setState", key: "filter" } },
      children: [
        { kind: "tab", key: "all", props: { value: "all", label: "All", count: { $text: p("total") } } },
        {
          $each: { in: p("groups"), as: "group", key: p("group.id") },
          kind: "tab",
          props: { value: p("group.id"), label: p("group.label"), count: { $text: p("group.total") } },
        },
      ],
    },
    {
      kind: "inline",
      key: "columns",
      style: { wrap: "wrap", gap: "space.5", align: "start" },
      children: [
        {
          kind: "stack",
          key: "focus",
          style: {
            gap: "space.3",
            position: { base: "static", "bp.md": "sticky" },
            insetTop: "space.4",
            width: "size.rail",
            grow: 1,
            shrink: 1,
          },
          children: [
            { $if: { $has: p("focus") }, ...heading(p("focus.title"), 3) },
            { $if: { $not: { $has: p("focus") } }, ...heading("Nothing else waits on you", 3) },
          ],
        },
        {
          kind: "box",
          key: "rows",
          props: { semantics: "aside", label: "Queue rows" },
          style: { width: "size.rail", grow: 0, shrink: 1 },
          children: [
            {
              kind: "stack",
              style: { gap: "space.0" },
              children: [
                {
                  $each: { in: p("visible"), as: "group", index: "gi", key: p("group.id") },
                  kind: "stack",
                  style: { gap: "space.0", marginTop: { $cond: [{ $eq: [p("gi"), 0] }, "space.0", "space.5"] } },
                  children: [
                    {
                      kind: "inline",
                      key: "label",
                      style: { marginBottom: "space.2" },
                      children: [text(p("group.label"), { textStyle: "overline", tone: "foil" })],
                    },
                    {
                      $each: { in: p("group.rows"), as: "row", key: p("row.id") },
                      $use: "QueueRow",
                      with: {
                        id: p("row.id"),
                        category: p("group.id"),
                        title: p("row.title"),
                        status: p("row.rowStatus"),
                        meta: p("row.rowMeta"),
                        foldedAlerts: { $coalesce: [p("row.foldedAlerts"), 0] },
                        selected: { $eq: [p("focus.id"), p("row.id")] },
                      },
                    },
                    { kind: "separator", key: "rule" },
                    {
                      $if: { $eq: [{ $len: p("group.rows") }, 0] },
                      kind: "inline",
                      key: "empty",
                      children: [text("Nothing else waits on you", { textStyle: "meta", tone: "muted" })],
                    },
                  ],
                },
                {
                  kind: "inline",
                  key: "pager",
                  props: { semantics: "nav", label: "Pagination" },
                  style: { gap: "space.3", justify: "between", align: "center", wrap: "wrap", paddingTop: "space.3" },
                  children: [
                    text({ $concat: ["Showing ", { $text: p("showing") }] }, { textStyle: "mono", tone: "muted" }),
                    {
                      $if: { $gt: [{ $len: withNext }, 0] },
                      kind: "inline",
                      key: "actions",
                      children: [
                        {
                          kind: "button",
                          props: { label: "Next" },
                          events: {
                            onPress: {
                              type: "setState",
                              key: "cursors",
                              value: {
                                $merge: [
                                  p("state.cursors"),
                                  {
                                    $fromEntries: {
                                      $map: { in: withNext, as: "group", value: [p("group.id"), p("group.next")] },
                                    },
                                  },
                                ],
                              },
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  $if: p("data.stale"),
                  kind: "box",
                  key: "stale",
                  variant: "callout",
                  style: { marginTop: "space.3" },
                  children: [
                    {
                      kind: "stack",
                      style: { gap: "space.1" },
                      children: [
                        text("stale", { textStyle: "mono.strong", tone: "warning" }, "word"),
                        text(
                          "An item changed while this page was open. Reload to see it before deciding.",
                          { textStyle: "meta", tone: "muted" },
                          "body",
                        ),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      kind: "box",
      key: "footer",
      variant: "rule",
      props: { semantics: "footer" },
      style: { paddingX: "space.0", paddingBottom: "space.0" },
      children: [
        {
          kind: "menu",
          props: { label: "Widget options" },
          children: [
            {
              kind: "menuItem",
              key: "about",
              props: { label: "About this widget" },
              events: { onPress: { type: "action", name: "queue.about", args: {} } },
            },
          ],
        },
      ],
    },
  ],
};

export const agentHomeTemplate: Template = {
  format: "liveframe-template/1",
  components: {
    QueueRow: {
      params: obj({
        id: str({ maxLength: 128 }),
        category,
        title: str({ maxLength: 10000 }),
        status: str({ maxLength: 10000 }),
        meta: arr(str({ maxLength: 10000 }), { maxItems: 100 }),
        foldedAlerts: num({ minimum: 0, maximum: 100 }),
        selected: bool(),
      }),
      root: queueRow,
    },
  },
  root: {
    kind: "box",
    props: { semantics: "section" },
    style: { surface: "surface.raised", radius: "radius.plate", padding: "space.5" },
    children: [
      {
        kind: "stack",
        style: { gap: "space.3" },
        children: [
          {
            kind: "stack",
            key: "header",
            props: { semantics: "header" },
            style: { gap: "space.0", marginBottom: "space.3" },
            children: [
              {
                kind: "inline",
                key: "head",
                style: { justify: "between", align: "end", wrap: "wrap", gap: "space.4", paddingBottom: "space.2" },
                children: [
                  heading("Queue", 2, { textStyle: { base: "heading.2.compact", "bp.md": "heading.2" } }, "title"),
                  text({ $concat: ["Checked ", p("data.checked")] }, { textStyle: "fine", tone: "muted" }, "checked"),
                ],
              },
              { kind: "separator", key: "rule" },
            ],
          },
          { $if: { $not: p("params.canAct") }, ...text("Read-only desk", { tone: "info" }, "readonly") },
          {
            $if: { $eq: [p("data.status"), "loading"] },
            kind: "stack",
            key: "loading",
            style: { gap: "space.2" },
            children: [
              heading("Loading", 3),
              text("Loading the queue. Static rows, no animated skeleton.", { tone: "muted" }),
              { kind: "box", key: "row-1", style: { surface: "surface.well", height: "space.4" } },
              { kind: "box", key: "row-2", style: { surface: "surface.well", height: "space.4" } },
            ],
          },
          {
            $if: { $eq: [p("data.status"), "failed"] },
            kind: "stack",
            key: "failed",
            style: { gap: "space.3" },
            children: [
              heading("The queue did not load", 3, { tone: "danger" }),
              {
                kind: "inline",
                key: "retry",
                children: [
                  {
                    kind: "button",
                    props: { label: "Retry the queue" },
                    events: { onPress: { type: "action", name: "queue.retry", args: {} } },
                  },
                ],
              },
            ],
          },
          {
            $if: { $eq: [p("data.status"), "empty"] },
            kind: "stack",
            key: "empty",
            style: { gap: "space.2" },
            children: [heading("Nothing else waits on you", 3)],
          },
          ready,
        ],
      },
    ],
  },
};
