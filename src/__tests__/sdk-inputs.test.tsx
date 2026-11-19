/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { action, primitive, render, type WidgetInputs, type WidgetProps } from "@arnilo/liveframe/sdk";
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

type TaskRow = { readonly id: string; readonly title: string };
type LayerProps = { readonly tasks: readonly TaskRow[]; readonly wrapped?: { readonly rows: readonly TaskRow[] } };

const Direct = ({ tasks }: LayerProps) => (
  <Stack gap="space.2">
    {tasks.map((row) => (
      <Button key={row.id} label={row.title} onPress={action("tasks.claim", { id: row.id })} />
    ))}
  </Stack>
);
const Layer6 = (props: LayerProps) => <Direct {...props} />;
const Layer5 = (props: LayerProps) => <Layer6 {...props} />;
const Layer4 = (props: LayerProps) => <Layer5 {...props} />;
const Layer3 = (props: LayerProps) => <Layer4 {...props} />;
const Layer2 = (props: LayerProps) => <Layer3 {...props} />;
const Layer1 = (props: LayerProps) => <Layer2 {...props} />;
const PayloadLayer = (_props: { readonly payload: unknown }) => <Text text="ok" />;
const ExtLayer = (_props: { readonly ext: unknown }) => <Text text="ok" />;

const inputs: WidgetInputs = {
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

  test("caller_frozen_input_is_cached_by_identity_and_mutable_input_is_copied_each_render", () => {
    const seen: unknown[] = [];
    const widget = ({ data }: WidgetProps) => {
      seen.push(data);
      return <Text text="x" />;
    };
    const renderWith = (data: unknown): boolean => render(widget, { ...inputs, data } as WidgetProps, options).ok;

    // Frozen all the way down: checked once, then the same copy for this validator's check.
    const frozen = Object.freeze({ tasks: Object.freeze([Object.freeze({ id: "t1", title: "Fix" })]) });
    expect(renderWith(frozen)).toBe(true);
    expect(renderWith(frozen)).toBe(true);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[0]).not.toBe(frozen);

    // Frozen outside, writable inside: a fresh copy each render, so a change inside is seen.
    const row = { id: "t1", title: "Fix" };
    const shallow = Object.freeze({ tasks: Object.freeze([row]) });
    expect(renderWith(shallow)).toBe(true);
    row.title = "Ship";
    expect(renderWith(shallow)).toBe(true);
    expect(seen[3]).not.toBe(seen[2]);
    expect((seen[3] as { tasks: TaskRow[] }).tasks[0]?.title).toBe("Ship");

    // Writable: a fresh copy each render.
    const mutable = { tasks: [{ id: "t1", title: "Fix" }] };
    expect(renderWith(mutable)).toBe(true);
    expect(renderWith(mutable)).toBe(true);
    expect(seen[5]).not.toBe(seen[4]);
  });

  test("input_with_an_accessor_property_is_never_cached", () => {
    let reads = 0;
    const row = Object.freeze({ id: "t1", title: "Fix" });
    const inner = Object.defineProperty({}, "tasks", {
      enumerable: true,
      get() {
        reads += 1;
        return Object.freeze([row]);
      },
    });
    const data = Object.freeze(inner);
    const seen: unknown[] = [];
    const widget = ({ data }: WidgetProps) => {
      seen.push(data);
      return <Text text="x" />;
    };
    for (let i = 0; i < 3; i++) expect(render(widget, { ...inputs, data } as WidgetProps, options).ok).toBe(true);
    expect(reads).toBe(3);
    expect(new Set(seen).size).toBe(3);

    // An accessor deeper down keeps every frozen container above it from being cached.
    reads = 0;
    const accessorRow = Object.freeze(
      Object.defineProperty({ id: "t1" }, "title", {
        enumerable: true,
        get() {
          reads += 1;
          return "Fix";
        },
      }),
    );
    const outer = Object.freeze({ tasks: Object.freeze([accessorRow]) });
    seen.length = 0;
    for (let i = 0; i < 2; i++)
      expect(render(widget, { ...inputs, data: outer } as WidgetProps, options).ok).toBe(true);
    expect(reads).toBe(2);
    expect(seen[1]).not.toBe(seen[0]);
  });

  test("frozen_accessor_inputs_are_rechecked", () => {
    let tasks: readonly object[] = Object.freeze([Object.freeze({ id: "t1", title: "Fix" })]);
    const data = Object.freeze({
      get tasks() {
        return tasks;
      },
    });
    const seen: number[] = [];
    const widget = (owned: WidgetProps) => {
      seen.push((owned.data as { tasks: readonly object[] }).tasks.length);
      return <Text text="x" />;
    };
    expect(render(widget, { ...inputs, data } as WidgetProps, options).ok).toBe(true);
    tasks = Object.freeze([]);
    expect(render(widget, { ...inputs, data } as WidgetProps, options).ok).toBe(true);
    expect(seen).toEqual([1, 0]);
  });

  test("mutable_data_is_rechecked", () => {
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
    expect(reads).toBeGreaterThan(afterFirst);

    const next = { tasks: [{ id: "t2", title: "Ship" }] };
    expect(renderWith(next)).toBe(true);
    expect(reads).toBeGreaterThan(afterFirst);
  });

  test("checked_data_is_checked_again_under_another_source_schema", () => {
    const incompatible = compileValidator({
      catalog: catalogDocument,
      capabilities: {
        ...withSource,
        sources: {
          "tasks.list": {
            ...withSource.sources["tasks.list"],
            result: { type: "array", items: { type: "string", maxLength: 8 }, maxItems: 8 },
          },
        },
      },
      manifest: withData,
    });
    const data = { tasks: [{ id: "t1", title: "Fix" }] };
    let ran = 0;
    const widget = () => {
      ran += 1;
      return <Text text="x" />;
    };
    const renderWith = (checked: typeof validator) =>
      render(widget, { ...inputs, data } as WidgetProps, { ...options, validator: checked });

    expect(renderWith(validator).ok).toBe(true);
    const bad = renderWith(incompatible);
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.errors.map((error) => [error.kind, error.pointer])).toEqual([
      ["invalid-prop", "/data/tasks/0"],
    ]);
    expect(ran).toBe(1);
    expect(renderWith(validator).ok).toBe(true);
  });

  test("widget_mutation_fails_without_freezing_caller_inputs", () => {
    const original = JSON.parse(JSON.stringify(inputs));
    const result = render(
      (owned: WidgetProps) => {
        expect(Object.isFrozen(owned)).toBe(true);
        (owned.state as Record<string, unknown>).filter = "tasks";
        return <Text text="x" />;
      },
      original,
      options,
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[0]?.kind).toBe("render-failed");
    expect(Object.isFrozen(original)).toBe(false);
    expect(Object.isFrozen(original.state)).toBe(false);
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

  test("shallow_frozen_inputs_are_deep_frozen", () => {
    const cursors = { decisions: "start", tasks: "start", alerts: "start" };
    const row = { id: "t1", title: "Fix" };
    const data = Object.freeze({ tasks: Object.freeze([row]) });
    const state = Object.freeze({ ...(inputs.state as object), cursors });
    let frozen = false;
    const result = render(
      ({ state, data }: WidgetProps) => {
        frozen =
          Object.isFrozen((state as { cursors: object }).cursors) &&
          Object.isFrozen((data as { tasks: object[] }).tasks[0]);
        return <Text text="x" />;
      },
      { ...inputs, state, data } as WidgetProps,
      options,
    );

    expect(result.ok).toBe(true);
    expect(frozen).toBe(true);
    expect(Object.isFrozen(cursors)).toBe(false);
    expect(Object.isFrozen(row)).toBe(false);
    cursors.tasks = "next";
    row.title = "Changed";
    expect(render(() => <Text text="x" />, { ...inputs, state, data } as WidgetProps, options).ok).toBe(true);
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

  test("composed_props_holding_owned_inputs_are_not_rewalked", () => {
    const tasks: readonly TaskRow[] = Object.freeze([
      Object.freeze({ id: "t1", title: "Fix" }),
      Object.freeze({ id: "t2", title: "Ship" }),
    ]);
    const frozenData = Object.freeze({ tasks });
    const resolved = { ...inputs, data: frozenData } as WidgetProps;

    const directWidget = ({ data }: WidgetProps) => <Direct tasks={(data as { tasks: readonly TaskRow[] }).tasks} />;
    const layeredWidget = ({ data }: WidgetProps) => {
      const ownedTasks = (data as { tasks: readonly TaskRow[] }).tasks;
      return <Layer1 tasks={ownedTasks} wrapped={{ rows: ownedTasks }} />;
    };

    const directResult = render(directWidget, resolved, options);
    const firstLayered = render(layeredWidget, resolved, options);
    // Second render reuses `frozenData` through `inputCopies` (`src/sdk/render.ts`).
    const secondLayered = render(layeredWidget, resolved, options);

    expect(directResult.ok).toBe(true);
    expect(firstLayered.ok).toBe(true);
    expect(secondLayered.ok).toBe(true);
    if (directResult.ok && firstLayered.ok && secondLayered.ok) {
      expect(JSON.stringify(firstLayered.value)).toBe(JSON.stringify(directResult.value));
      expect(JSON.stringify(secondLayered.value)).toBe(JSON.stringify(directResult.value));
    }
  });

  test("function_nested_in_a_widget_built_prop_is_still_function_prop", () => {
    const resolved = { ...inputs, data: { tasks: [{ id: "t1", title: "Fix" }] } } as WidgetProps;

    const withFn = render(
      ({ data }: WidgetProps) => (
        <PayloadLayer payload={{ rows: (data as { tasks: unknown }).tasks, onPick: () => {} }} />
      ),
      resolved,
      options,
    );
    expect(withFn.ok).toBe(false);
    expect(!withFn.ok && withFn.errors[0]).toMatchObject({
      kind: "function-prop",
      pointer: "/payload/onPick",
      nodeId: "root",
    });

    const withPromise = render(
      ({ data }: WidgetProps) => (
        <PayloadLayer payload={{ rows: (data as { tasks: unknown }).tasks, pending: Promise.resolve(1) }} />
      ),
      resolved,
      options,
    );
    expect(withPromise.ok).toBe(false);
    expect(!withPromise.ok && withPromise.errors[0]).toMatchObject({
      kind: "async-render",
      pointer: "/payload/pending",
      nodeId: "root",
    });

    const withNaN = render(
      ({ data }: WidgetProps) => (
        <PayloadLayer payload={{ rows: (data as { tasks: unknown }).tasks, count: Number.NaN }} />
      ),
      resolved,
      options,
    );
    expect(withNaN.ok).toBe(false);
    expect(!withNaN.ok && withNaN.errors[0]).toMatchObject({
      kind: "invalid-prop",
      pointer: "/payload/count",
      nodeId: "root",
    });
  });

  test("callers_frozen_object_is_not_trusted", () => {
    const callerFrozenFn = Object.freeze({
      tasks: Object.freeze([Object.freeze({ id: "t1", title: () => "Fix" })]),
    });
    const fnErrors = failures({ data: callerFrozenFn });
    expect(fnErrors[0]).toMatchObject({
      kind: "invalid-prop",
      pointer: "/data/tasks/0/title",
    });

    const callerFrozenGetter = Object.freeze({
      get tasks() {
        return () => [];
      },
    });
    const getterErrors = failures({ data: callerFrozenGetter });
    expect(getterErrors[0]).toMatchObject({
      kind: "invalid-prop",
      pointer: "/data/tasks",
    });

    const externalFrozen = Object.freeze({ nested: Object.freeze({ onPick: () => {} }) });
    const composedResult = render(() => <ExtLayer ext={externalFrozen} />, inputs, options);
    expect(composedResult.ok).toBe(false);
    expect(!composedResult.ok && composedResult.errors[0]).toMatchObject({
      kind: "function-prop",
      pointer: "/ext/nested/onPick",
      nodeId: "root",
    });
  });
});
