// A template port of the proof git-status widget (plan 028 Task 4). Label sanitisation in
// `fixtures/widgets/git-status/labels.ts` needs regular expressions, which the language does not have
// (design T22): the port expects labels that a source has already cleaned, as the parity test supplies.

import type { ObjectSchema } from "../../../formats/capabilities.ts";
import { obj, str } from "../../../schema.ts";
import type { Template, TemplateNode } from "../../../template/index.ts";
import capabilities from "../widgets/capabilities.json" with { type: "json" };
import { heading, p, text } from "./common.ts";

const entry = capabilities.sources["git.statuses"].result.items as unknown as ObjectSchema;
const omit = { $omit: null };

const head = "root.snapshot.head";
const snapshot = "root.snapshot";
const refresh = "root.refreshState";
const kindIs = (path: string, value: string) => ({ $eq: [p(`${path}.kind`), value] });

/** The last non-empty path segment, else "workspace" (labels.ts `rootLabel` without sanitising). */
const rootLabel = {
  $let: {
    bind: [
      {
        as: "parts",
        value: {
          $filter: { in: { $split: [p("root.workspaceRoot"), "/"] }, as: "part", where: { $ne: [p("part"), ""] } },
        },
      },
    ],
    in: { $coalesce: [{ $at: [p("parts"), { $sub: [{ $len: p("parts") }, 1] }] }, "workspace"] },
  },
};

const headLabel = {
  $cond: [
    kindIs(head, "branch"),
    { $concat: ["Branch: ", { $coalesce: [p(`${head}.name`), "main"] }] },
    {
      $cond: [
        kindIs(head, "detached"),
        { $concat: ["Detached: ", { $coalesce: [p(`${head}.shortSha`), "HEAD"] }] },
        { $cond: [kindIs(head, "unborn"), "Branch: (no commits yet)", "HEAD: unknown"] },
      ],
    },
  ],
};
const headIcon = {
  $cond: [
    { $and: [{ $has: p(`${head}.kind`) }, { $contains: [["branch", "detached", "unborn"], p(`${head}.kind`)] }] },
    "git.branch",
    omit,
  ],
};

const dirtyLabel = {
  $cond: [
    { $has: p(snapshot) },
    {
      $cond: [
        p(`${snapshot}.dirty`),
        {
          $let: {
            bind: [{ as: "count", value: { $coalesce: [p(`${snapshot}.changedFileCount`), 0] } }],
            in: {
              $cond: [
                { $gt: [p("count"), 0] },
                { $concat: ["Status: ", { $text: p("count") }, " changed"] },
                "Status: dirty",
              ],
            },
          },
        },
        "Status: clean",
      ],
    },
    "Status: not refreshed",
  ],
};
const dirtyIcon = {
  $cond: [{ $has: p(snapshot) }, { $cond: [p(`${snapshot}.dirty`), "status.warning", "status.success"] }, omit],
};

const refreshLabel = {
  $cond: [
    kindIs(refresh, "refreshing"),
    "Refresh: refreshing",
    {
      $cond: [
        kindIs(refresh, "last-success"),
        "Refresh: current",
        {
          $cond: [
            kindIs(refresh, "last-error"),
            { $concat: ["Refresh: ", { $coalesce: [p(`${refresh}.status.kind`), "error"] }] },
            "Refresh: idle",
          ],
        },
      ],
    },
  ],
};
const refreshIcon = {
  $cond: [
    kindIs(refresh, "last-success"),
    "status.success",
    { $cond: [kindIs(refresh, "last-error"), "status.error", omit] },
  ],
};

const row = (key: string, label: unknown, icon?: unknown): TemplateNode => ({
  $use: "StatusRow",
  key,
  with: { text: label as never, ...(icon ? { icon: icon as never } : {}) },
});

export const gitStatusTemplate: Template = {
  format: "liveframe-template/1",
  components: {
    StatusRow: {
      params: obj({ text: str({ maxLength: 10000 }) }, { icon: str({ maxLength: 128 }) }),
      root: {
        kind: "inline",
        style: { gap: "space.1", align: "center" },
        children: [{ $if: { $has: p("icon") }, kind: "icon", props: { name: p("icon") } }, text(p("text"))],
      },
    },
    GitRoot: {
      params: obj({ root: entry }),
      root: {
        kind: "fragment",
        children: [
          row("root", rootLabel),
          row("head", headLabel, headIcon),
          row("dirty", dirtyLabel, dirtyIcon),
          row("refresh", refreshLabel, refreshIcon),
        ],
      },
    },
  },
  root: {
    kind: "stack",
    style: { padding: "space.3", gap: "space.1" },
    children: [
      heading("Git", 2),
      {
        $each: { in: p("data.statuses"), as: "root", key: p("root.workspaceRootId") },
        $use: "GitRoot",
        with: { root: p("root") },
      },
      { $if: { $eq: [{ $len: p("data.statuses") }, 0] }, ...text("No workspace roots") },
    ],
  },
};
