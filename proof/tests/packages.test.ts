import { expect, test } from "bun:test";
import { compileValidator } from "@arnilo/liveframe";
import { pack } from "@arnilo/liveframe/pack";
import { render } from "@arnilo/liveframe/sdk";
import { drafts, packageOptions, value } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../src/__tests__/fixtures/widgets/index.ts";
import { createSession, openPage, packages } from "../host/pages.ts";

test("host_pages_render_through_packages_and_runner", async () => {
  expect(drafts).toHaveLength(proofWidgets.length);
  for (const fixture of proofWidgets) {
    const pkg = packages.get(fixture.name);
    if (!pkg) throw new Error("Missing package");
    const validator = compileValidator({ ...packageOptions, manifest: pkg.manifest });
    for (const scenario of pkg.scenarios) {
      const session = await openPage(
        String((scenario.context as Record<string, unknown>).size),
        fixture.name,
        scenario.name,
      );
      const snapshot = session.snapshot();
      expect(snapshot.manifest).toEqual(pkg.manifest);
      expect(snapshot.tree).toEqual(
        value(
          render(
            fixture.widget,
            {
              ...scenario,
              state: scenario.state ?? pkg.manifest.initialState,
            },
            { ...packageOptions, validator, surfaceId: snapshot.tree.surfaceId, revision: 1 },
          ),
        ),
      );
    }
  }
});

test("host_rechecks_intents_against_manifest_and_capabilities", async () => {
  const session = await openPage("full", "harness");
  for (const intent of [
    { type: "action", name: "shell.exec", args: {} },
    { type: "action", name: "tasks.claim", args: { id: 1 } },
    { type: "setState", key: "unknown", value: "x" },
  ])
    await expect(session.dispatch(1, intent)).rejects.toThrow();
  await expect(session.dispatch(0, { type: "setState", key: "query", value: "x" })).rejects.toThrow("revision");
  expect(session.snapshot().tree.revision).toBe(1);
  expect(session.snapshot().actions).toEqual([]);
});

test("bound_action_values_are_checked_against_capability_args", async () => {
  const draft = drafts.at(-1);
  if (!draft) throw new Error("Missing harness draft");
  const pkg = value(
    pack(
      {
        ...draft,
        entry: "entry.tsx",
        files: {
          ...draft.files,
          "entry.tsx": `import { TextField } from "./ui.gen.ts";
import { action } from "@arnilo/liveframe/sdk";
export default () => <TextField label="Claim id" onCommit={action("tasks.claim", {}, { bind: "id" })} />;`,
        },
      },
      packageOptions,
    ),
  );
  const scenario = pkg.scenarios[0];
  if (!scenario) throw new Error("Missing harness scenario");
  const session = await createSession(pkg, { ...scenario, state: scenario.state ?? pkg.manifest.initialState });
  for (const args of [{}, { id: 1 }, { id: "x".repeat(129) }, { id: "task:0", extra: true }])
    await expect(session.dispatch(1, { type: "action", name: "tasks.claim", args })).rejects.toThrow();
  expect(session.snapshot().actions).toEqual([]);
  const intent = { type: "action", name: "tasks.claim", args: { id: "task:0" } } as const;
  expect((await session.dispatch(1, intent)).actions).toEqual([intent]);
});

test("concurrent_state_requests_cannot_overwrite_an_accepted_revision", async () => {
  const session = await openPage("full", "harness");
  const results = await Promise.allSettled(
    ["first", "second"].map((value) => session.dispatch(1, { type: "setState", key: "query", value })),
  );
  expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
  expect(session.snapshot().tree.revision).toBe(2);
  expect(session.snapshot().tree.root.children?.find((node) => node.kind === "textField")?.props.value).toBe("first");
});
