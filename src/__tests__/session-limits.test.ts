import { expect, test } from "bun:test";
import { LiveframeFailure, type UiTree } from "@arnilo/liveframe";
import { createAuthoring } from "@arnilo/liveframe/authoring";
import { createPreview, inProcessRunner, type Runner } from "@arnilo/liveframe/preview";
import type { RenderLimits } from "@arnilo/liveframe/sdk";
import { drafts, packageOptions, value } from "./fixtures/widgets/drafts.ts";

const draft = drafts[0]!;
const largeDraft = {
  ...draft,
  entry: "entry.ts",
  files: {
    "entry.ts": `import { primitive } from "@arnilo/liveframe/sdk";
import { jsx } from "@arnilo/liveframe/sdk/jsx-runtime";
const Stack = primitive("stack"), Text = primitive("text");
export default () => jsx(Stack, { children: Array.from({ length: 5000 }, (_, key) => jsx(Text, { text: "x" }, key)) });`,
  },
};

test("session_limits_raise_host_validation", async () => {
  const delegate = inProcessRunner();
  for (const limits of [undefined, { nodes: 20000 }]) {
    const runner: Runner = {
      render(pkg, inputs, options) {
        expect(options.limits).toEqual(limits);
        // Deliberately bypass the runner's bound to exercise host validation independently.
        return delegate.render(pkg, inputs, { ...options, limits: { nodes: 20000 }, timeoutMs: 5000 });
      },
    };
    const session = createPreview({ ...packageOptions, runner, ...(limits ? { limits } : {}) });
    value(session.update(largeDraft));
    const result = await session.render({ scenario: draft.scenarios[0]!.name });
    expect(result.ok).toBe(limits !== undefined);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ kind: "limit-exceeded" }));
    expect(value(await session.check())[0]!.result.ok).toBe(limits !== undefined);

    const authoring = createAuthoring({ ...packageOptions, runner, ...(limits ? { limits } : {}) });
    value(await authoring.packDraft(largeDraft));
    for (const outcomes of [false, true]) {
      const statuses = value(await authoring.renderScenarios({ outcomes }));
      expect(JSON.stringify(statuses).includes('"kind":"limit-exceeded"')).toBe(limits === undefined);
      if (limits) expect(statuses).toContainEqual(expect.objectContaining({ ok: true, nodes: 5001 }));
    }
    await authoring.close();
  }
});

test("session_limits_bound_untrusted_runner_nodes_depth_and_bytes", async () => {
  const runner: Runner = {
    async render(_pkg, _inputs, options) {
      return {
        ok: true,
        value: {
          format: "liveframe/1",
          catalogId: packageOptions.catalog.catalogId,
          surfaceId: options.surfaceId,
          revision: options.revision,
          root: {
            id: "root",
            kind: "stack",
            props: {},
            children: [{ id: "root/a", kind: "text", props: { text: "x" } }],
          },
        } satisfies UiTree,
      };
    },
  };
  for (const limits of [{ nodes: 1 }, { depth: 1 }, { bytes: 1 }]) {
    const session = createPreview({ ...packageOptions, runner, limits });
    value(session.update(draft));
    const result = await session.render({ scenario: draft.scenarios[0]!.name });
    expect(result).toMatchObject({ ok: false, errors: [expect.objectContaining({ kind: "limit-exceeded" })] });
  }
});

test("session_limits_invalid_document", () => {
  for (const limits of [
    null,
    [],
    1,
    "limits",
    { other: 1 },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined, "1"].flatMap((value) => [
      { nodes: value },
      { depth: value },
      { bytes: value },
    ]),
  ]) {
    for (const create of [createPreview, createAuthoring]) {
      try {
        create({ ...packageOptions, runner: inProcessRunner(), limits: limits as RenderLimits });
        throw new Error("Expected invalid limits to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(LiveframeFailure);
        expect((error as LiveframeFailure).errors).toMatchObject([{ kind: "invalid-document", pointer: "/limits" }]);
      }
    }
  }
  for (const limits of [undefined, {}, { nodes: 1, depth: 1, bytes: 1 }])
    expect(() =>
      createPreview({ ...packageOptions, runner: inProcessRunner(), ...(limits ? { limits } : {}) }),
    ).not.toThrow();
});

test("session_limits_are_owned_frozen_snapshots", async () => {
  const limits = { nodes: 20000 };
  const delegate = inProcessRunner();
  const runner: Runner = {
    render(pkg, inputs, options) {
      expect(options.limits).toEqual({ nodes: 20000 });
      expect(Object.isFrozen(options.limits)).toBe(true);
      expect(options.limits).not.toBe(limits);
      return delegate.render(pkg, inputs, options);
    },
  };
  const options = { ...packageOptions, runner, limits };
  const session = createPreview(options);
  const authoring = createAuthoring(options);
  limits.nodes = 1;
  options.limits = { nodes: 2 };
  value(session.update(draft));
  value(await session.render({ scenario: draft.scenarios[0]!.name }));
  value(await authoring.packDraft(draft));
  value(await authoring.renderScenarios({ outcomes: true }));
  await authoring.close();
});
