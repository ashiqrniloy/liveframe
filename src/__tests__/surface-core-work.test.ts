import { describe, expect, test } from "bun:test";
import { compileValidator, type UiNode, type UiTree, validateCatalog } from "@arnilo/liveframe";
import { createSurfaceCore } from "@arnilo/liveframe/surface";
import catalogJson from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

/**
 * The surface core's work per arrival and per event, as counts that do not depend on the host: table lookups
 * and writes, the `Set`s it creates, and the objects it freezes (each context's events, every snapshot and
 * origin). A change that only restructures the core leaves them as they are.
 */
function work(run: () => void): Record<string, number> {
  const NativeSet = globalThis.Set;
  const nativeFreeze = Object.freeze;
  let sets = 0;
  let freezes = 0;
  globalThis.Set = class extends NativeSet<unknown> {
    constructor(values?: Iterable<unknown> | null) {
      super(values);
      sets++;
    }
  } as SetConstructor;
  Object.freeze = ((value: unknown) => {
    freezes++;
    return nativeFreeze(value);
  }) as typeof Object.freeze;
  const counts: Record<string, number> = {};
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
  watch("mapGet", Map.prototype, "get");
  watch("setHas", NativeSet.prototype, "has");
  try {
    run();
  } finally {
    globalThis.Set = NativeSet;
    Object.freeze = nativeFreeze;
    for (const undo of restore) undo();
  }
  return { ...counts, sets, freezes };
}

const checked = validateCatalog(catalogJson);
if (!checked.ok) throw new Error("catalog");
const catalog = checked.value;
const validator = compileValidator({
  catalog: catalogJson,
  capabilities: {
    ...capabilities,
    actions: {
      ...capabilities.actions,
      "tasks.escalate": { ...capabilities.actions["tasks.escalate"], confirm: true, irreversible: true },
    },
  },
  manifest: {
    ...(proofWidgets[0]?.manifest as unknown as Record<string, unknown>),
    local: {
      type: "object",
      properties: { q: { type: "string", maxLength: 64 } },
      required: ["q"],
      additionalProperties: false,
    },
    initialLocal: { q: "" },
  },
});

/** A filter field, a confirmed action, and 100 rows of which half are hidden by the filter. */
function tree(revision: number): UiTree {
  const rows: UiNode[] = Array.from({ length: 100 }, (_, i) => ({
    id: `root/r${i}`,
    kind: "text",
    props: { text: `row ${i} r${revision}` },
    ...(i % 2 ? { when: { $contains: [`row ${i}`, { $path: "local.q" }] } } : {}),
  }));
  return {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId: "s",
    revision,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: [
        {
          id: "root/field",
          kind: "textField",
          props: { label: "F" },
          events: { onChange: { type: "setLocal", key: "q" } },
        },
        {
          id: "root/b",
          kind: "button",
          props: { label: "Go" },
          events: { onPress: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "r" } } },
        },
        ...rows,
      ],
    },
  };
}

describe("surface core work", () => {
  test("surface_core_work_per_arrival_and_event_is_unchanged", () => {
    // Warm the module-level caches (per-catalog specs, compiled schemas), which another test file may already
    // have filled, so every count is the work of one core.
    createSurfaceCore({ catalog, validator, onIntent: () => {} }).accept(tree(0));
    const core = createSurfaceCore({ catalog, validator, onIntent: () => {}, confirm: async () => true });
    core.attach();
    const first = tree(1);
    const second = tree(2);
    const counts = {
      firstArrival: work(() => void core.accept(first)),
      nextRevision: work(() => void core.accept(second)),
      sameInput: work(() => void core.accept(second)),
      setLocal: work(() => void core.snapshot().root?.items[0]?.emit("onChange", "row 1")),
      confirmedAction: work(() => void core.snapshot().root?.items[1]?.emit("onPress")),
    };
    // Recorded before intent raising and context construction left the core's closure. The frame slots of
    // `local`, `self` and `shown` are fixed once per module, so compiling a node's bindings builds one scope fewer.
    const none = { freezes: 0, mapGet: 0, setHas: 0, sets: 0, weakMapGet: 0, weakMapSet: 0, weakSetHas: 0 };
    expect(counts).toEqual({
      firstArrival: {
        freezes: 157,
        mapGet: 827,
        setHas: 1245,
        sets: 206,
        weakMapGet: 618,
        weakMapSet: 309,
        weakSetHas: 0,
      },
      nextRevision: {
        freezes: 153,
        mapGet: 822,
        setHas: 1245,
        sets: 204,
        weakMapGet: 609,
        weakMapSet: 303,
        weakSetHas: 103,
      },
      sameInput: none,
      setLocal: { ...none, freezes: 3, mapGet: 3, weakMapGet: 155, weakMapSet: 51 },
      confirmedAction: { ...none, freezes: 4, mapGet: 1 },
    });
  });
});
