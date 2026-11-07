// A template port of the proof core-queue widget (plan 028 Task 4): the four sizes of
// `fixtures/widgets/core-queue/widget.tsx`. `full` and any state other than `ready` draw the
// agent-home body, so that body is a component here, reached through one `Entry` component whose
// fragment root picks exactly one branch.
import { int, obj } from "../../../schema.ts";
import type { Template, TemplateNode } from "../../../template/index.ts";
import coreManifest from "../proof/core-queue.manifest.json" with { type: "json" };
import { agentHomeComponents, agentHomeRoot } from "./agent-home.ts";
import { heading, inputSchemas, p, text } from "./common.ts";

const schemas = inputSchemas(coreManifest);
const inputs = obj(schemas);
const given = { params: p("params"), state: p("state"), data: p("data"), context: p("context") };

/** The decision pages, the page the cursor is on, and every row up to it. */
const decisionLets = [
  {
    as: "pages",
    value: {
      $coalesce: [
        {
          $get: [
            {
              $at: [
                { $filter: { in: p("data.groups"), as: "group", where: { $eq: [p("group.id"), "decisions"] } } },
                0,
              ],
            },
            "pages",
          ],
        },
        { $lit: [] },
      ],
    },
  },
  {
    as: "index",
    value: {
      $findIndex: { in: p("pages"), as: "page", where: { $eq: [p("page.cursor"), p("state.cursors.decisions")] } },
    },
  },
] satisfies NonNullable<TemplateNode["$let"]>;

const rowsLet = {
  as: "rows",
  value: {
    $flat: {
      $map: { in: { $slice: [p("pages"), 0, { $add: [p("index"), 1] }] }, as: "page", value: p("page.rows") },
    },
  },
};

const size = (name: string) => ({ $eq: [p("context.size"), name] });
const ready = { $eq: [p("data.status"), "ready"] };

const metric: TemplateNode = {
  kind: "box",
  style: { surface: "surface.raised", padding: "space.4" },
  children: [
    {
      kind: "stack",
      style: { gap: "space.2" },
      children: [
        text("Decisions waiting on you · today", { textStyle: "label" }, "label"),
        heading({ $text: p("value") }, 2),
        text("Current page · not a queue total", { textStyle: "meta", tone: "muted" }, "scope"),
      ],
    },
  ],
};

const core: TemplateNode = {
  $let: [
    ...decisionLets,
    rowsLet,
    {
      as: "focus",
      value: {
        $coalesce: [
          { $at: [{ $filter: { in: p("rows"), as: "row", where: { $eq: [p("row.id"), p("state.selected")] } } }, 0] },
          { $at: [p("rows"), 0] },
        ],
      },
    },
    { as: "next", value: { $get: [{ $at: [p("pages"), p("index")] }, "nextCursor"] } },
  ],
  kind: "box",
  props: { semantics: "section" },
  style: { surface: "surface.raised", padding: "space.4" },
  children: [
    {
      kind: "stack",
      style: { gap: "space.4" },
      children: [
        {
          kind: "inline",
          key: "header",
          props: { semantics: "header" },
          style: { justify: "between", wrap: "wrap", gap: "space.2" },
          children: [
            heading("Your decision queue", 2),
            text({ $concat: ["Checked ", p("data.checked")] }, { textStyle: "meta", tone: "muted" }),
          ],
        },
        { $if: { $not: p("params.canAct") }, ...text("Read-only desk", { tone: "info" }, "readonly") },
        {
          kind: "inline",
          key: "columns",
          style: { wrap: "wrap", gap: "space.5", align: "start" },
          children: [
            {
              $if: { $and: [size("large"), { $has: p("focus") }] },
              kind: "stack",
              key: "focus",
              style: {
                gap: "space.3",
                position: "sticky",
                insetTop: "space.4",
                width: "size.rail",
                grow: 1,
                shrink: 1,
              },
              children: [{ $use: "DecisionCard", with: { focus: p("focus"), canAct: p("params.canAct") } }],
            },
            {
              kind: "box",
              key: "rows",
              props: { semantics: "aside", label: "Queue rows" },
              style: { width: "size.rail", grow: { $cond: [size("large"), 0, 1] }, shrink: 1 },
              children: [
                {
                  kind: "stack",
                  style: { gap: "space.1" },
                  children: [
                    {
                      $each: { in: p("rows"), as: "row", key: p("row.id") },
                      $use: "QueueRow",
                      with: {
                        id: p("row.id"),
                        category: p("row.category"),
                        title: p("row.title"),
                        status: p("row.rowStatus"),
                        meta: p("row.rowMeta"),
                        foldedAlerts: { $coalesce: [p("row.foldedAlerts"), 0] },
                        selected: { $eq: [p("focus.id"), p("row.id")] },
                      },
                    },
                    {
                      $if: { $eq: [{ $len: p("rows") }, 0] },
                      ...text("No decisions are waiting on you.", { tone: "muted" }),
                    },
                    {
                      kind: "inline",
                      key: "pager",
                      props: { semantics: "nav", label: "Pagination" },
                      style: { justify: "between", gap: "space.2" },
                      children: [
                        text({ $concat: ["Showing ", { $text: { $len: p("rows") } }] }, { textStyle: "meta" }),
                        {
                          $if: { $has: p("next") },
                          kind: "button",
                          props: { label: "Load more" },
                          events: {
                            onPress: {
                              type: "setState",
                              key: "cursors",
                              value: { $merge: [p("state.cursors"), { decisions: p("next") }] },
                            },
                          },
                        },
                      ],
                    },
                    {
                      $if: p("data.stale"),
                      kind: "box",
                      key: "stale",
                      variant: "callout",
                      children: [
                        {
                          kind: "stack",
                          style: { gap: "space.1" },
                          children: [
                            text("Stale", { textStyle: "label", tone: "warning" }, "word"),
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
      ],
    },
  ],
};

export const coreQueueTemplate: Template = {
  format: "liveframe-template/1",
  components: {
    ...agentHomeComponents,
    AgentHome: {
      params: obj({ params: schemas.params, state: schemas.state, data: schemas.data }),
      root: agentHomeRoot,
    },
    Metric: { params: obj({ value: int() }), root: metric },
    Core: { params: inputs, root: core },
    Entry: {
      params: inputs,
      root: {
        kind: "fragment",
        children: [
          {
            $if: { $or: [size("full"), { $ne: [p("data.status"), "ready"] }] },
            $use: "AgentHome",
            with: { params: p("params"), state: p("state"), data: p("data") },
          },
          {
            $let: decisionLets,
            $if: { $and: [{ $not: size("full") }, ready, size("small")] },
            $use: "Metric",
            with: {
              value: {
                $sum: {
                  $map: {
                    in: { $slice: [p("pages"), 0, { $add: [p("index"), 1] }] },
                    as: "page",
                    value: { $len: p("page.rows") },
                  },
                },
              },
            },
          },
          {
            $if: { $and: [{ $not: size("full") }, ready, { $not: size("small") }] },
            $use: "Core",
            with: given,
          },
        ],
      },
    },
  },
  root: { $use: "Entry", with: given },
};
