import { describe, expect, test } from "bun:test";
import { toElements } from "../../scripts/fixtures/elements.ts";
import { renderElements } from "../sdk/elements.ts";
import { renderWorkloads } from "./fixtures/render-workloads.ts";

/**
 * The build pass's work per render, as counts that do not depend on the host: table lookups and
 * writes, and the `Set`s it creates. A change that only restructures the pass leaves them as they are.
 */
function work(run: () => void): Record<string, number> {
  const NativeSet = globalThis.Set;
  let sets = 0;
  globalThis.Set = class extends NativeSet<unknown> {
    constructor(values?: Iterable<unknown> | null) {
      super(values);
      sets++;
    }
  } as SetConstructor;
  const counts: Record<string, number> = { sets };
  const restore: (() => void)[] = [];
  const watch = (name: string, proto: object, method: string): void => {
    const target = proto as Record<string, (...args: unknown[]) => unknown>;
    const original = target[method] as (...args: unknown[]) => unknown;
    counts[name] = 0;
    target[method] = function (this: unknown, ...args: unknown[]) {
      (counts[name] as number)++;
      return original.apply(this, args);
    };
    restore.push(() => {
      target[method] = original;
    });
  };
  watch("weakMapGet", WeakMap.prototype, "get");
  watch("weakMapSet", WeakMap.prototype, "set");
  watch("weakSetHas", WeakSet.prototype, "has");
  watch("weakSetAdd", WeakSet.prototype, "add");
  watch("mapGet", Map.prototype, "get");
  watch("setHas", NativeSet.prototype, "has");
  try {
    run();
  } finally {
    globalThis.Set = NativeSet;
    for (const undo of restore) undo();
  }
  counts.sets = sets;
  return counts;
}

describe("sdk build work", () => {
  const agent = renderWorkloads().find((workload) => workload.name === "agent-home");
  if (!agent) throw new Error("agent-home workload missing");
  const tree = agent.run(0);
  const elements = toElements(tree.root);
  const options = { validator: agent.validator, surfaceId: "proof", revision: 0 };
  // Warm caches (compiled checks, input copies) so a count is one steady-state render.
  agent.run(0);
  renderElements(elements, options);

  test("build_pass_work_per_render_is_unchanged", () => {
    const counts = {
      render: work(() => agent.run(0)),
      elements: work(() => {
        expect(renderElements(elements, options).ok).toBe(true);
      }),
    };
    // Recorded before the build pass took its parent as one value, on the agent-home
    // workload (679 nodes), through `render()` and through `renderElements`.
    expect(counts).toEqual({
      render: { sets: 736, weakMapGet: 5, weakMapSet: 0, weakSetHas: 58, weakSetAdd: 3, mapGet: 6950, setHas: 14117 },
      elements: {
        sets: 684,
        weakMapGet: 680,
        weakMapSet: 679,
        weakSetHas: 0,
        weakSetAdd: 0,
        mapGet: 6891,
        setHas: 17812,
      },
    });
  });
});
