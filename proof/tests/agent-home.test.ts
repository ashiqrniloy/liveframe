import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { createSurface } from "../host/state.ts";
import { type Intent, type UiNode, WidgetError } from "../runtime/index.ts";
import { checkSchema } from "../runtime/validate.ts";
import { agentHomeActions, agentHomeOptions, initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";

const session = (params = queueParams, data = agentHomeFixture) =>
  createSurface(
    AgentHomeQueue,
    {
      params,
      state: initialQueueState,
      data,
      context: { size: "full" },
    },
    agentHomeOptions,
    agentHomeActions,
  );
const nodes = (node: UiNode): UiNode[] => [node, ...(node.children ?? []).flatMap(nodes)];
const all = (surface: ReturnType<typeof session>) => nodes(surface.snapshot().tree.root);
const press = (surface: ReturnType<typeof session>, label: string) => {
  const intent = all(surface).find((node) => node.props.label === label)?.events?.onPress;
  if (!intent) throw new Error(`Missing intent: ${label}`);
  return surface.dispatch(surface.snapshot().tree.revision, intent);
};
const set = (surface: ReturnType<typeof session>, key: string, value: unknown) =>
  surface.dispatch(surface.snapshot().tree.revision, { type: "setState", key, value });
const focusTitle = (surface: ReturnType<typeof session>) =>
  all(surface)
    .filter((node) => node.kind === "heading" && node.props.level === 2)
    .at(-1)?.props.text;
const offeredActions = (surface: ReturnType<typeof session>) =>
  all(surface).flatMap((node) => Object.values(node.events ?? {}).filter((intent) => intent.type === "action"));

test("selecting_a_row_moves_its_card_to_focus", () => {
  const surface = session();
  expect(focusTitle(surface)).toBe(agentHomeFixture.groups[0]?.pages[0]?.rows[0]?.title);
  press(surface, "Reassign the Hansen delivery milestone");
  expect(focusTitle(surface)).toBe("Reassign the Hansen delivery milestone");
  expect(offeredActions(surface)).toContainEqual({ type: "action", name: "tasks.claim", args: { id: "task-5531" } });
  press(surface, "Invoice INV-2099-438 was refused by the provider");
  expect(offeredActions(surface).map((intent) => intent.type === "action" && intent.name)).toEqual([
    "alerts.acknowledge",
    "alerts.snooze",
    "alerts.snooze",
    "alerts.convert",
    "queue.about",
  ]);
});

test("queue_structure_matches_the_artifact_landmarks", () => {
  const tree = session().snapshot().tree;
  const all = nodes(tree.root);
  expect(all.some((node) => node.props.semantics === "section")).toBe(true);
  expect(all.some((node) => node.props.semantics === "header")).toBe(true);
  expect(all.some((node) => node.kind === "tabs")).toBe(true);
  const article = all.find((node) => node.props.semantics === "article");
  expect(article?.variant).toBe("plate");
  expect(all.some((node) => node.props.semantics === "terms")).toBe(true);
  expect(all.some((node) => node.props.semantics === "term")).toBe(true);
  expect(all.some((node) => node.props.semantics === "detail")).toBe(true);
  expect(all.filter((node) => node.kind === "disclosure")).toHaveLength(1);
  expect(all.some((node) => node.kind === "menu" && node.props.label === "Widget options")).toBe(true);
  expect(all.some((node) => node.props.semantics === "aside" && node.props.label === "Queue rows")).toBe(true);
  expect(all.some((node) => node.props.semantics === "nav" && node.props.label === "Pagination")).toBe(true);
  expect(all.some((node) => node.kind === "box" && node.variant === "callout")).toBe(true);
  expect(all.filter((node) => node.kind === "button" && node.props.current === true)).toHaveLength(1);
  expect(JSON.stringify(tree)).not.toContain("Selected · ");
});

test("filter_selects_a_visible_focus_and_load_more_advances_all_three_cursors", () => {
  const surface = session();
  set(surface, "filter", "tasks");
  expect(all(surface).find((node) => node.kind === "text" && node.props.text === "Tasks")).toBeDefined();
  expect(focusTitle(surface)).toBe("Reassign the Hansen delivery milestone");
  const first = press(surface, "Next");
  const next = nodes(first.tree.root).find((node) => node.props.label === "Next")?.events?.onPress;
  expect(next).toEqual({ type: "setState", key: "cursors", value: { decisions: "d-2", tasks: "t-3", alerts: "a-2" } });
  expect(JSON.stringify(first.tree)).toContain("Showing 4");
  press(surface, "Next");
  expect(all(surface).some((node) => node.props.label === "Next")).toBe(false);
  set(surface, "filter", "all");
  expect(JSON.stringify(surface.snapshot().tree)).toContain("Showing 12");
});

test("escalate_requires_a_reason_of_1_to_500_chars", () => {
  for (const reason of ["a", "\n", "x".repeat(500), "😀".repeat(500)]) {
    const surface = session();
    press(surface, "Reassign the Hansen delivery milestone");
    press(surface, "Escalate…");
    expect(all(surface).find((node) => node.kind === "dialog")?.props.open).toBe(true);
    expect(all(surface).find((node) => node.props.label === "Escalate")?.events).toBeUndefined();
    set(surface, "reason", reason);
    const result = press(surface, "Escalate");
    expect(result.actions).toEqual([{ type: "action", name: "tasks.escalate", args: { id: "task-5531", reason } }]);
  }
  for (const reason of ["", "x".repeat(501), "😀".repeat(501)]) {
    expect(() => checkSchema(agentHomeActions["tasks.escalate"], { id: "task-5531", reason }, "args")).toThrow();
  }
  const surface = session();
  press(surface, "Reassign the Hansen delivery milestone");
  press(surface, "Escalate…");
  expect(() => set(surface, "reason", "x".repeat(501))).toThrow(WidgetError);
  expect(() =>
    surface.dispatch(surface.snapshot().tree.revision, {
      type: "action",
      name: "tasks.escalate",
      args: { id: "task-5531", reason: "" },
    }),
  ).toThrow();
  press(surface, "Cancel");
  expect(all(surface).some((node) => node.kind === "dialog")).toBe(false);
});

test("loading_empty_failed_and_permissions_fail_closed", () => {
  for (const [status, expected] of [
    ["loading", "Loading"],
    ["empty", "Nothing else waits on you"],
    ["failed", "The queue did not load"],
  ] as const) {
    const surface = session(queueParams, { ...agentHomeFixture, status });
    expect(JSON.stringify(surface.snapshot().tree)).toContain(expected);
    expect(all(surface).some((node) => node.kind === "tabs")).toBe(false);
  }
  const readonly = session({ ...queueParams, canAct: false });
  press(readonly, "Reassign the Hansen delivery milestone");
  expect(offeredActions(readonly)).toEqual([{ type: "action", name: "queue.about", args: {} }]);
  expect(all(readonly).some((node) => node.props.label === "Escalate…" || node.props.label === "Reason")).toBe(false);
  expect(() => readonly.dispatch(2, { type: "action", name: "tasks.claim", args: { id: "task-5531" } })).toThrow();
  const restricted = session({ ...queueParams, canViewAlerts: false, canEscalate: false });
  expect(JSON.stringify(restricted.snapshot().tree)).not.toContain("INV-2099");
  expect(all(restricted).some((node) => node.kind === "tab" && node.props.value === "alerts")).toBe(false);
  press(restricted, "Reassign the Hansen delivery milestone");
  expect(all(restricted).some((node) => node.props.label === "Escalate…")).toBe(false);
  expect(() => set(restricted, "filter", "alerts")).toThrow();
});

test("widget_uses_only_catalog_primitives_and_declared_intents", () => {
  const surface = session();
  for (const label of ["Reassign the Hansen delivery milestone", "Escalate…"]) press(surface, label);
  for (const node of all(surface)) {
    expect(definitions.some((definition) => definition.kind === node.kind)).toBe(true);
    for (const intent of Object.values(node.events ?? {})) {
      if (intent.type === "action") expect(agentHomeOptions.actions).toContain(intent.name);
      else expect(Object.hasOwn(agentHomeOptions.state.properties, intent.key)).toBe(true);
    }
  }
  const unknown: Intent = { type: "action", name: "shell.exec", args: {} };
  expect(() => surface.dispatch(surface.snapshot().tree.revision, unknown)).toThrow();
});

test("paging_preserves_selection_and_row_ids_and_rejects_old_or_forged_intents", () => {
  const surface = session();
  press(surface, "Reassign the Hansen delivery milestone");
  const rowId = all(surface).find((node) => node.props.label === "Reassign the Hansen delivery milestone")?.id;
  const oldCursor = all(surface).find((node) => node.props.label === "Next")?.events?.onPress;
  press(surface, "Next");
  expect(all(surface).find((node) => node.props.label === "Reassign the Hansen delivery milestone")?.id).toBe(rowId);
  expect(focusTitle(surface)).toBe("Reassign the Hansen delivery milestone");
  expect(() => surface.dispatch(surface.snapshot().tree.revision, oldCursor)).toThrow();
  expect(() => set(surface, "cursors", { decisions: "unknown", tasks: "t-2", alerts: "a-2" })).toThrow();
  set(surface, "filter", "alerts");
  expect(() =>
    surface.dispatch(surface.snapshot().tree.revision, {
      type: "action",
      name: "tasks.claim",
      args: { id: "task-5531" },
    }),
  ).toThrow();
  const next = press(surface, "For 1 day");
  expect(next.actions).toEqual([
    { type: "action", name: "alerts.snooze", args: { id: "alert-7302", duration: "day" } },
  ]);
});
