import type { WidgetInputs } from "../../sdk/types.ts";
import type { Expr, Template } from "../../template/index.ts";

const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
const path = ($path: string) => ({ $path });

// From the LF-18 reproduction. Keys keep the repeated component uses distinct.
export function componentExpansion(depth: number, width: number): Template {
  return {
    format: "liveframe-template/1",
    components: Object.fromEntries(
      Array.from({ length: depth }, (_, i) => [
        `C${i}`,
        {
          params: empty,
          root: {
            kind: "box",
            children: Array.from({ length: width }, (_, key) =>
              i === depth - 1 ? { kind: "separator", key } : { $use: `C${i + 1}`, key },
            ),
          },
        },
      ]),
    ),
    root: { kind: "box", children: [{ $use: "C0" }] },
  };
}

function evaluateBeforeEmitting(condition: Expr): Template {
  return { format: "liveframe-template/1", root: { kind: "box", children: [{ kind: "separator", $if: condition }] } };
}

export const stringDoublingThenSlice = evaluateBeforeEmitting({
  $let: {
    bind: Array.from({ length: 21 }, (_, i) => ({
      as: `s${i}`,
      value: i === 0 ? "a" : { $concat: [path(`s${i - 1}`), path(`s${i - 1}`)] },
    })),
    in: {
      $gt: [
        {
          $len: {
            $map: {
              in: [0, 1, 2, 3, 4, 5, 6, 7],
              as: "i",
              value: { $slice: [path("s20"), 0, 1_048_576] },
            },
          },
        },
        0,
      ],
    },
  },
});

export const nestedMaps = evaluateBeforeEmitting({
  $let: {
    bind: [{ as: "items", value: Array<number>(1000).fill(1) }],
    in: {
      $gt: [
        {
          $len: {
            $map: {
              in: path("items"),
              as: "outer",
              value: { $map: { in: path("items"), as: "inner", value: path("inner") } },
            },
          },
        },
        0,
      ],
    },
  },
});

export const hostileTemplateInputs: WidgetInputs = {
  params: { canEdit: false },
  context: { size: "small" },
  state: { filter: "all", selected: "", title: "" },
  data: { rows: [] },
};

export const hostileTemplates = {
  fanOut10: componentExpansion(10, 4),
  fanOut16: componentExpansion(16, 4),
  nestedMaps,
  stringDoublingThenSlice,
};
