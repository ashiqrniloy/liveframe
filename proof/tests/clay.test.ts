import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { gitFixture, rackFixture } from "../host/fixtures/clay.ts";
import { openPage } from "../host/pages.ts";
import { createSurface } from "../host/state.ts";
import { buildGitStatusTree } from "../references/clay/packages/git/src/status.ts";
import { render, type UiNode, WidgetError } from "../runtime/index.ts";
import { GitStatus } from "../widgets/clay/git-status.tsx";
import { gitOptions, initialRackState, rackActions, rackOptions } from "../widgets/clay/manifest.ts";
import { RackModule } from "../widgets/clay/rack-module.tsx";

const nodes = (node: UiNode): UiNode[] => [node, ...(node.children ?? []).flatMap(nodes)];
const git = (statuses = gitFixture.statuses) => {
  const tree = render(GitStatus, { params: {}, state: {}, data: { statuses }, context: { size: "full" } }, gitOptions);
  if (tree instanceof WidgetError) throw tree;
  return nodes(tree.root);
};
const moduleSession = () =>
  createSurface(
    RackModule,
    {
      params: {},
      state: initialRackState,
      data: rackFixture,
      context: { size: "full" },
    },
    rackOptions,
    rackActions,
  );

test("git_status_matches_builder_output_structure", () => {
  const expected: { text: string; icon?: string | null }[] = [];
  buildGitStatusTree(
    {
      definePanel: (v: unknown) => v,
      defineStack: (v: unknown) => v,
      defineLabel: (v: { text: string; icon?: string | null }) => {
        expected.push(v);
        return v;
      },
    },
    gitFixture.statuses,
  );
  const rows = git().filter((node) => node.kind === "inline");
  expect(
    rows.map((row) => ({
      text: row.children?.find((n) => n.kind === "text")?.props.text,
      icon: row.children?.find((n) => n.kind === "icon")?.props.name ?? null,
    })),
  ).toEqual(expected.map(({ text, icon }) => ({ text, icon: icon ?? null })));
  expect(JSON.stringify(rows)).not.toContain("/synthetic/");
  expect(git().find((node) => node.kind === "heading")?.props.text).toBe("Git");
});

test("empty_state_renders", () => {
  expect(
    git([])
      .filter((node) => node.kind === "text")
      .map((node) => node.props.text),
  ).toEqual(["No workspace roots"]);
  expect(JSON.stringify(openPage("full", "git-status", "empty").snapshot())).toContain("No workspace roots");
});

test("agent_info_tabs_and_close_map_to_declared_intents", () => {
  const s = moduleSession();
  const all = () => nodes(s.snapshot().tree.root);
  const dispatch = (intent: unknown) => s.dispatch(s.snapshot().tree.revision, intent);
  expect(all().find((n) => n.kind === "tabs")?.events?.onChange).toEqual({ type: "setState", key: "tab" });
  for (const tab of ["om", "context", "files"]) {
    dispatch({ type: "setState", key: "tab", value: tab });
    expect(all().find((n) => n.kind === "tabs")?.props.value).toBe(tab);
  }
  dispatch({ type: "setState", key: "draft", value: "New message" });
  for (const [label, name, args] of [
    ["Send", "agent.send", { sessionId: rackFixture.sessionId, message: "New message" }],
    ["Close container", "container.close", { containerId: rackFixture.containerId }],
  ] as const) {
    const intent = all().find((n) => n.props.label === label)?.events?.onPress;
    expect(intent).toEqual({ type: "action", name, args });
    expect(dispatch(intent).actions.at(-1)).toEqual(intent);
  }
  for (const intent of [
    { type: "setState", key: "tab", value: "forged" },
    { type: "setState", key: "draft", value: "x".repeat(10001) },
    { type: "action", name: "agent.send", args: { sessionId: rackFixture.sessionId, message: "forged" } },
    { type: "action", name: "shell.exec", args: {} },
  ])
    expect(() => dispatch(intent)).toThrow();
  dispatch({ type: "setState", key: "draft", value: "" });
  expect(all().find((n) => n.props.label === "Send")?.events?.onPress).toBeUndefined();
  for (const node of [...git(), ...all()]) {
    expect(definitions.some((d) => d.kind === node.kind)).toBe(true);
    for (const intent of Object.values(node.events ?? {}))
      if (intent.type === "action") expect(rackOptions.actions).toContain(intent.name);
  }
  expect(all().filter((n) => n.kind === "box" && n.style?.surface === "surface.selected").length).toBe(5);
  expect(JSON.stringify(openPage("full", "rack-module").snapshot().tree.root)).toContain("ContainerTrack.tsx");
});
