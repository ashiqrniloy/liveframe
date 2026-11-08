// A template port of the proof agent-home queue (plan 028): the same data, state and actions as
// `fixtures/widgets/agent-home/queue.tsx`, written as element JSON with expressions. Task 3 validates
// it and times the install check; Task 4 renders it and proves it equal to the TSX widget.
import { arr, bool, type LanguageSchema, num, obj, str } from "../../../schema.ts";
import type { Expr, Template, TemplateNode } from "../../../template/index.ts";
import { heading, p, rowSchema, text } from "./common.ts";

/** One field of the `tasks.claim` status, or "" when the host reported none (action names hold dots, so `$get`). */
const claimField = (field: "status" | "reason"): Expr => ({
  $coalesce: [{ $get: [{ $get: [p("actions"), "tasks.claim"] }, field] }, ""],
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
            {
              $if: { $and: [{ $has: p("focus") }, { $eq: [p("focus.category"), "tasks"] }] },
              $use: "TaskCard",
              key: p("focus.id"),
              with: {
                task: p("focus"),
                canAct: p("params.canAct"),
                canEscalate: p("params.canEscalate"),
                escalating: p("state.escalating"),
                reason: p("state.reason"),
                claimStatus: claimField("status"),
                claimReason: claimField("reason"),
              },
            },
            {
              $if: { $and: [{ $has: p("focus") }, { $eq: [p("focus.category"), "alerts"] }] },
              $use: "AlertCard",
              key: p("focus.id"),
              with: { alert: p("focus"), canAct: p("params.canAct") },
            },
            {
              $if: {
                $and: [
                  { $has: p("focus") },
                  { $ne: [p("focus.category"), "tasks"] },
                  { $ne: [p("focus.category"), "alerts"] },
                ],
              },
              $use: "DecisionCard",
              key: p("focus.id"),
              with: { focus: p("focus"), canAct: p("params.canAct") },
            },
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

/** The widget's whole body, reusable as a component whose params are named `params`, `state` and `data`. */
export const agentHomeRoot: TemplateNode = {
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
            { kind: "box", key: "row-3", style: { surface: "surface.well", height: "space.4" } },
          ],
        },
        {
          $if: { $eq: [p("data.status"), "failed"] },
          kind: "stack",
          key: "failed",
          style: { gap: "space.3" },
          children: [
            heading("The queue did not load", 3, { tone: "danger" }),
            text(
              "Synapta could not reach your queue just now. Your draft and the dock still work; try the queue again.",
            ),
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
          children: [
            heading("Nothing else waits on you", 3),
            text("You have reached the end of the queue. Standing orders keep running, and new work appears here.", {
              tone: "muted",
            }),
          ],
        },
        ready,
      ],
    },
  ],
};

const factsSchema = rowSchema.properties.facts as LanguageSchema;
const kickerStyle = { gap: "space.2", align: "center" } as const;

const decideBox = (note: TemplateNode, acts: TemplateNode): TemplateNode => ({
  kind: "box",
  key: "decide",
  variant: "rule",
  style: { paddingX: "space.0", paddingTop: "space.4", paddingBottom: "space.0", marginTop: "space.1" },
  children: [
    {
      kind: "inline",
      style: {
        wrap: { base: "wrap", "bp.sm": "nowrap" },
        justify: "between",
        align: "center",
        gap: "space.3",
      },
      children: [note, acts],
    },
  ],
});

/** The focus plate shared by the decision, task and alert cards. */
function plate(
  item: string,
  marker: { name: string; tone: string },
  extra: { lead?: TemplateNode; acts: TemplateNode; dialog?: TemplateNode },
): TemplateNode {
  return {
    kind: "box",
    props: { semantics: "article" },
    variant: "plate",
    children: [
      {
        kind: "inline",
        key: "kicker",
        style: kickerStyle,
        children: [
          {
            kind: "icon",
            key: "brand",
            props: { name: "seal-brand" },
            style: { tone: "foil", width: "size.glyph", height: "size.glyph" },
          },
          text(p(`${item}.kicker`), { textStyle: "ui", tone: "foil" }, "word"),
        ],
      },
      {
        kind: "stack",
        key: "head",
        style: { gap: "space.2" },
        children: [
          heading(p(`${item}.title`), 2, { textStyle: "heading.3" }),
          {
            kind: "inline",
            key: "state",
            style: { gap: "space.2", wrap: "wrap", align: "center" },
            children: [
              {
                kind: "inline",
                key: "stamp",
                style: { gap: "space.2", align: "center", paddingRight: "space.2" },
                children: [
                  { kind: "icon", key: "marker", props: { name: marker.name }, style: { tone: marker.tone } },
                  text(p(`${item}.status`), { textStyle: "mono.strong", tone: marker.tone }, "word"),
                ],
              },
              text(p(`${item}.meta`), { textStyle: "meta", tone: "muted" }, "when"),
            ],
          },
        ],
      },
      ...(extra.lead ? [extra.lead] : []),
      { $use: "Facts", with: { facts: p(`${item}.facts`) } },
      {
        kind: "disclosure",
        key: "reference",
        props: { label: "Reference" },
        children: [text(p(`${item}.reference`), { textStyle: "meta" })],
      },
      decideBox(text(p(`${item}.note`), { textStyle: "meta", tone: "muted", maxWidth: "56ch" }, "note"), extra.acts),
      ...(extra.dialog ? [extra.dialog] : []),
    ],
  };
}

const button = (
  key: string | undefined,
  label: string | Expr,
  intent: TemplateNode["events"],
  variant?: string,
): TemplateNode => ({
  kind: "button",
  ...(key ? { key } : {}),
  ...(variant ? { variant } : {}),
  props: { label },
  ...(intent ? { events: intent } : {}),
});
const act = (name: string, args: Record<string, unknown>) => ({ type: "action" as const, name, args: args as never });
const clear = { type: "setState" as const, key: "escalating", value: "" };

const dialog: TemplateNode = {
  $if: { $and: [p("canAct"), p("canEscalate"), { $eq: [p("escalating"), p("task.id")] }] },
  kind: "dialog",
  props: { label: "Escalate this task?", open: true },
  events: { onClose: clear },
  children: [
    {
      kind: "stack",
      style: { gap: "space.3" },
      children: [
        text(
          "It goes to the people who can reassign it, with your reason attached. The task stays open.",
          {},
          "explanation",
        ),
        {
          kind: "textField",
          props: { label: "Reason", value: p("reason"), maxLength: 500 },
          events: { onChange: { type: "setState", key: "reason" } },
        },
        text(
          "1–500 characters. Everyone who sees the task sees the reason. Leave the field to confirm your draft.",
          { textStyle: "meta" },
          "help",
        ),
        {
          kind: "inline",
          style: { gap: "space.2" },
          children: [
            button("cancel", "Cancel", { onPress: clear }, "ghost"),
            {
              $let: [{ as: "length", value: { $len: p("reason") } }],
              $if: { $and: [{ $gte: [p("length"), 1] }, { $lte: [p("length"), 500] }] },
              ...button(
                "send",
                "Escalate",
                { onPress: act("tasks.escalate", { id: p("task.id"), reason: p("reason") }) },
                "primary",
              ),
            },
            {
              $let: [{ as: "length", value: { $len: p("reason") } }],
              $if: { $not: { $and: [{ $gte: [p("length"), 1] }, { $lte: [p("length"), 500] }] } },
              kind: "button",
              key: "send",
              variant: "primary",
              props: { label: "Escalate", disabled: true },
            },
          ],
        },
      ],
    },
  ],
};

export const agentHomeComponents: NonNullable<Template["components"]> = {
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
  Facts: {
    params: obj({ facts: factsSchema }),
    root: {
      kind: "box",
      key: "facts",
      children: [
        { kind: "separator", key: "rule" },
        {
          kind: "inline",
          style: {
            wrap: { base: "wrap", "bp.sm": "nowrap" },
            align: "start",
            paddingTop: "space.3",
            gap: { base: "space.3", "bp.sm": "space.5" },
          },
          children: [
            {
              $each: { in: p("facts"), as: "fact", key: p("fact.label") },
              kind: "stack",
              props: { semantics: "terms" },
              style: { gap: "space.0", width: { base: "fill", "bp.sm": "48.67%" } },
              children: [
                {
                  kind: "inline",
                  key: "term",
                  props: { semantics: "term" },
                  children: [text(p("fact.label"), { textStyle: "meta", tone: "muted" })],
                },
                {
                  kind: "inline",
                  key: "detail",
                  props: { semantics: "detail" },
                  children: [text(p("fact.value"), { textStyle: "meta" })],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  DecisionCard: {
    params: obj({ focus: rowSchema, canAct: bool() }),
    root: plate(
      "focus",
      { name: "mk-dashed", tone: "warning" },
      {
        acts: {
          $if: p("canAct"),
          kind: "inline",
          key: "acts",
          style: { shrink: 0 },
          children: [
            button(
              undefined,
              "Review and decide",
              { onPress: act("decisions.review", { id: p("focus.id") }) },
              "primary",
            ),
          ],
        },
      },
    ),
  },
  TaskCard: {
    params: obj({
      task: rowSchema,
      canAct: bool(),
      canEscalate: bool(),
      escalating: str({ maxLength: 128 }),
      reason: str({ maxLength: 500 }),
      claimStatus: str({ maxLength: 16 }),
      claimReason: str({ maxLength: 500 }),
    }),
    root: plate(
      "task",
      { name: "mk-dashed", tone: "warning" },
      {
        acts: {
          $if: p("canAct"),
          kind: "inline",
          key: "acts",
          style: { gap: "space.2", wrap: "wrap", shrink: 0 },
          children: [
            button(
              "claim",
              { $cond: [{ $eq: [p("claimStatus"), "pending"] }, "Claiming…", "Claim"] } as never,
              { onPress: act("tasks.claim", { id: p("task.id") }) },
              "primary",
            ),
            {
              $if: p("canEscalate"),
              ...button("escalate", "Escalate…", {
                onPress: { type: "setState", key: "escalating", value: p("task.id") },
              }),
            },
            {
              $if: { $eq: [p("claimStatus"), "failed"] },
              ...text(
                { $concat: ["Could not claim: ", { $coalesce: [p("claimReason"), "unknown reason"] }] },
                { textStyle: "meta", tone: "danger" },
                "claim-failed",
              ),
            },
          ],
        },
        dialog,
      },
    ),
  },
  AlertCard: {
    params: obj({ alert: rowSchema, canAct: bool() }),
    root: plate(
      "alert",
      { name: "mk-struck", tone: "danger" },
      {
        lead: { $if: { $has: p("alert.lead") }, ...text(p("alert.lead"), { textStyle: "meta" }, "lead") },
        acts: {
          $if: p("canAct"),
          kind: "inline",
          key: "acts",
          style: { gap: "space.2", wrap: "wrap", shrink: 0 },
          children: [
            button(
              "acknowledge",
              "Acknowledge",
              { onPress: act("alerts.acknowledge", { id: p("alert.id") }) },
              "primary",
            ),
            {
              kind: "menu",
              props: { label: "Snooze" },
              children: [
                button("hour", "For 1 hour", {
                  onPress: act("alerts.snooze", { id: p("alert.id"), duration: "hour" }),
                }),
                button("day", "For 1 day", { onPress: act("alerts.snooze", { id: p("alert.id"), duration: "day" }) }),
              ].map((node) => ({ ...node, kind: "menuItem" })),
            },
            button("convert", "Convert to task", { onPress: act("alerts.convert", { id: p("alert.id") }) }),
          ],
        },
      },
    ),
  },
};

export const agentHomeTemplate: Template = {
  format: "liveframe-template/1",
  components: agentHomeComponents,
  root: agentHomeRoot,
};
