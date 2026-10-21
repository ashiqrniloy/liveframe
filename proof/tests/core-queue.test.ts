import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { openPage } from "../host/pages.ts";
import { createSurface } from "../host/state.ts";
import { render, type UiNode, WidgetError } from "../runtime/index.ts";
import { initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { coreQueueActions, coreQueueOptions } from "../widgets/core-queue/manifest.ts";
import { CoreQueue } from "../widgets/core-queue/widget.tsx";

const nodes = (node: UiNode): UiNode[] => [node, ...(node.children ?? []).flatMap(nodes)];
const session = (size: string, canAct = true, data = agentHomeFixture) =>
  createSurface(
    CoreQueue,
    { params: { ...queueParams, canAct }, state: initialQueueState, data, context: { size } },
    coreQueueOptions,
    coreQueueActions,
  );
const all = (s: ReturnType<typeof session>) => nodes(s.snapshot().tree.root);
const press = (s: ReturnType<typeof session>, label: string) => {
  const intent = all(s).find((node) => node.props.label === label)?.events?.onPress;
  if (!intent) throw new Error(`Missing ${label}`);
  return s.dispatch(s.snapshot().tree.revision, intent);
};

test("renders_each_size_with_a_distinct_valid_tree", () => {
  const trees = ["small", "medium", "large", "full"].map((size) => {
    const s = session(size);
    for (const node of all(s)) {
      expect(definitions.some((definition) => definition.kind === node.kind)).toBe(true);
      for (const intent of Object.values(node.events ?? {}))
        if (intent.type === "action") expect(coreQueueOptions.actions).toContain(intent.name);
    }
    expect(JSON.stringify(openPage(size, "core-queue").snapshot().tree.root)).toBe(
      JSON.stringify(s.snapshot().tree.root),
    );
    expect(all(s).some((node) => node.kind === "tabs")).toBe(size === "full");
    expect(all(s).some((node) => node.props.label === "Review and decide")).toBe(size === "large" || size === "full");
    expect(all(s).some((node) => node.props.label === "Reassign the Hansen delivery milestone")).toBe(size === "full");
    return JSON.stringify(s.snapshot().tree.root);
  });
  expect(new Set(trees).size).toBe(4);
  expect(trees[0]).toContain("Current page · not a queue total");
  expect(all(session("small")).some((node) => Object.keys(node.events ?? {}).length)).toBe(false);
});

test("size_outside_the_manifest_is_rejected", () => {
  const result = render(
    CoreQueue,
    { params: queueParams, state: initialQueueState, data: agentHomeFixture, context: { size: "huge" } },
    coreQueueOptions,
  );
  expect(result).toBeInstanceOf(WidgetError);
});

test("decision_sizes_select_page_and_enforce_current_offered_actions", () => {
  for (const size of ["medium", "large"]) {
    const s = session(size);
    press(s, "Load more");
    expect(JSON.stringify(s.snapshot().tree)).toContain("Showing 5");
    expect(all(s).some((node) => node.props.label === "Load more")).toBe(false);
    const row = agentHomeFixture.groups[0]?.pages[1]?.rows[0];
    if (!row) throw new Error("Missing decision");
    press(s, row.title);
    if (size === "large") {
      expect(all(s).some((node) => node.kind === "heading" && node.props.text === row.title)).toBe(true);
      expect(press(s, "Review and decide").actions).toEqual([
        { type: "action", name: "decisions.review", args: { id: row.id } },
      ]);
    }
    expect(() =>
      s.dispatch(s.snapshot().tree.revision, { type: "action", name: "tasks.claim", args: { id: "task-5531" } }),
    ).toThrow();
    expect(
      all(session(size, false)).some((node) =>
        Object.values(node.events ?? {}).some((intent) => intent.type === "action"),
      ),
    ).toBe(false);
  }
});

test("every_size_handles_loading_empty_failure_and_zero_decisions", () => {
  for (const size of ["small", "medium", "large", "full"]) {
    for (const status of ["loading", "empty", "failed"] as const) {
      const s = session(size, true, { ...agentHomeFixture, status });
      expect(all(s).some((node) => node.kind === "tabs")).toBe(false);
      expect(all(s).some((node) => node.props.label === "Retry the queue")).toBe(status === "failed");
    }
    const s = session(size, true, {
      ...agentHomeFixture,
      groups: agentHomeFixture.groups.map((group) => ({ ...group, total: 0, pages: [{ cursor: "start", rows: [] }] })),
    });
    expect(all(s).some((node) => node.props.label === "Review and decide")).toBe(false);
  }
});
