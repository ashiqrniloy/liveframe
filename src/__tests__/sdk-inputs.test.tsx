/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { action, primitive, render, type WidgetProps } from "@arnilo/liveframe/sdk";
import { compileValidator, type LiveframeError } from "../index.ts";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };

const task = {
  type: "object",
  properties: { id: { type: "string", maxLength: 64 }, title: { type: "string", maxLength: 64 } },
  required: ["id", "title"],
  additionalProperties: false,
} as const;
const withSource = {
  ...capabilities,
  sources: {
    "tasks.list": {
      description: "Tasks.",
      params: { type: "object", properties: {}, required: [], additionalProperties: false },
      result: { type: "array", items: task, maxItems: 8 },
    },
  },
};
const withData = { ...manifest, sources: { tasks: { source: "tasks.list", params: {} } } };
const validator = compileValidator({ catalog: catalogDocument, capabilities: withSource, manifest: withData });
const freshValidator = compileValidator({ catalog: catalogDocument, capabilities: withSource, manifest: withData });

const Stack = primitive<{ readonly children?: unknown; readonly gap?: string }>("stack");
const Text = primitive<{ readonly text: string }>("text");
const Button = primitive<{ readonly label: string; readonly onPress?: unknown }>("button");

const inputs: WidgetProps = {
  params: { canAct: true, canEscalate: false, canViewAlerts: true },
  state: {
    filter: "all",
    selected: "decision-8812",
    cursors: { decisions: "start", tasks: "start", alerts: "start" },
    escalating: "",
    reason: "",
  },
  data: { tasks: [] },
  context: { size: "small" },
};
const options = { validator, surfaceId: "home", revision: 1 };

function failures(overrides: Partial<WidgetProps>, renderOptions = options): readonly LiveframeError[] {
  const result = render(() => <Text text="x" />, { ...inputs, ...overrides } as WidgetProps, renderOptions);
  return result.ok ? [] : result.errors;
}

describe("sdk inputs", () => {
  test("json_input_errors_preserve_nested_pointers", () => {
    for (const bad of [() => 0, Promise.resolve(0), Number.NaN]) {
      const errors = failures({ data: { tasks: [{ id: "t1", title: { "x/y~z": bad } }] } });
      expect(errors[0]?.kind).toBe("invalid-prop");
      expect(errors[0]?.pointer).toBe("/data/tasks/0/title/x~1y~0z");
    }
  });

  test("inputs_fail_their_schemas", () => {
    const rows: readonly {
      readonly label: string;
      readonly overrides: Partial<WidgetProps>;
      readonly pointer: string;
    }[] = [
      {
        label: "state",
        overrides: { state: { ...(inputs.state as object), filter: "nope" } },
        pointer: "/state/filter",
      },
      {
        label: "params",
        overrides: { params: { canEscalate: false, canViewAlerts: true } },
        pointer: "/params/canAct",
      },
      { label: "context", overrides: { context: { size: "huge" } }, pointer: "/context/size" },
      {
        label: "data",
        overrides: { data: { tasks: [{ id: 1, title: "Fix" }] } },
        pointer: "/data/tasks/0/id",
      },
      {
        label: "extra data key",
        overrides: { data: { tasks: [], other: 1 } },
        pointer: "/data/other",
      },
    ];

    for (const row of rows) {
      const errors = failures(row.overrides);
      expect({ row: row.label, errors: errors.map((error) => [error.kind, error.pointer, error.nodeId]) }).toEqual({
        row: row.label,
        errors: [["invalid-prop", row.pointer, undefined]],
      });
    }
  });

  test("data_checked_once_per_object", () => {
    let reads = 0;
    const list = [{ id: "t1", title: "Fix" }];
    const data = {
      get tasks() {
        reads += 1;
        return list;
      },
    };
    const widget = () => <Text text="x" />;
    const renderWith = (value: unknown): boolean =>
      render(widget, { ...inputs, data: value } as WidgetProps, options).ok;

    expect(renderWith(data)).toBe(true);
    const afterFirst = reads;
    expect(afterFirst).toBeGreaterThan(0);
    expect(renderWith(data)).toBe(true);
    expect(reads).toBe(afterFirst);

    const next = { tasks: [{ id: "t2", title: "Ship" }] };
    expect(renderWith(next)).toBe(true);
    expect(reads).toBe(afterFirst);
  });

  test("inputs_reach_widget_frozen", () => {
    let frozen: readonly boolean[] = [];
    let mutated = false;
    const widget = ({ params, state, data, context }: WidgetProps) => {
      frozen = [params, state, data, context].map((value) => Object.isFrozen(value));
      try {
        (state as Record<string, unknown>).filter = "tasks";
      } catch {
        mutated = true;
      }
      return <Text text="x" />;
    };

    expect(render(widget, inputs, options).ok).toBe(true);
    expect(frozen).toEqual([true, true, true, true]);
    expect(mutated).toBe(true);
  });

  test("render_is_deterministic", () => {
    const widget = ({ data }: WidgetProps) => {
      const rows = (data as { tasks: readonly { readonly id: string; readonly title: string }[] }).tasks;
      return (
        <Stack gap="space.2">
          {rows.map((row) => (
            <Button key={row.id} label={row.title} onPress={action("tasks.claim", { id: row.id })} />
          ))}
        </Stack>
      );
    };
    const resolved = {
      ...inputs,
      data: {
        tasks: [
          { id: "t1", title: "Fix" },
          { id: "t2", title: "Ship" },
        ],
      },
    } as WidgetProps;

    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const result = render(widget, resolved, { ...options, validator: i % 2 === 0 ? validator : freshValidator });
      expect(result.ok).toBe(true);
      if (result.ok) seen.add(JSON.stringify(result.value));
    }
    expect(seen.size).toBe(1);
  });
});
