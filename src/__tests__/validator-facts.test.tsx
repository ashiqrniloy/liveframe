/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { checkOffered, type CompiledValidator, LiveframeFailure, type UiTree } from "../index.ts";
import { primitive, render, renderElements } from "../sdk/index.ts";
import { createSurfaceCore, type SurfaceEvent } from "../surface/index.ts";
import { renderTemplate } from "../template/index.ts";
import { UNKNOWN_VALIDATOR } from "../validate/compile.ts";
import * as catalogs from "./fixtures/react-catalogs.tsx";
import { catalog, renderer, surfaceProps, tree, validator } from "./fixtures/react-surface.tsx";

const options = (v: CompiledValidator) => ({ validator: v, surfaceId: "test", revision: 1 });
const inputs = { params: {}, state: {}, context: {}, data: {} } as never;
const Text = primitive<{ readonly text: string }>("text");
const shared = { kind: "invalid-document", pointer: "", message: UNKNOWN_VALIDATOR } as const;
const atValidator = (kind: "catalog-mismatch") => ({ kind, pointer: "/validator", message: UNKNOWN_VALIDATOR });

/** The `LiveframeFailure` a call throws; fails the test on any other outcome. */
function thrown(call: () => unknown): LiveframeFailure {
  try {
    call();
  } catch (error) {
    expect(error).toBeInstanceOf(LiveframeFailure);
    return error as LiveframeFailure;
  }
  throw new Error("Expected a LiveframeFailure");
}

describe("validator facts", () => {
  test("unknown_validator_is_named_the_same_way_everywhere", () => {
    const wrapper: CompiledValidator = { checkNode: validator.checkNode, validateTree: validator.validateTree };

    expect(thrown(() => render(() => <Text text="x" />, inputs, options(wrapper))).errors).toEqual([shared]);
    expect(thrown(() => renderElements({ kind: "text", props: { text: "x" } }, options(wrapper))).errors).toEqual([
      shared,
    ]);
    const template = { format: "liveframe-template/1", root: { kind: "text", props: { text: "x" } } } as const;
    expect(thrown(() => renderTemplate(template, inputs, options(wrapper))).errors).toEqual([shared]);

    const served = tree(1);
    const origin = { surfaceId: served.surfaceId, revision: served.revision, nodeId: "root/second", event: "onPress" };
    expect(checkOffered(served, origin, { type: "action", name: "x", args: {} }, wrapper)).toEqual({
      ok: false,
      errors: [{ kind: "invalid-prop", pointer: "/validator", message: UNKNOWN_VALIDATOR }],
    });

    const core = createSurfaceCore({ catalog, validator: wrapper, onIntent: () => {} });
    expect(core.accept(served)).toEqual({ ok: false, errors: [atValidator("catalog-mismatch")] });

    // One catalog: the surface core reports it on arrival.
    const single: SurfaceEvent[] = [];
    const Bound = renderer().Surface;
    renderToString(
      createElement(Bound, { ...surfaceProps, validator: wrapper, tree: served, onEvent: (e) => void single.push(e) }),
    );
    expect(single).toEqual([{ type: "arrival-rejected", errors: [atValidator("catalog-mismatch")] }]);

    // Several catalogs: the renderer cannot pick one and refuses the surface.
    const several: SurfaceEvent[] = [];
    const html = renderToString(
      createElement(catalogs.Surface, {
        ...surfaceProps,
        validator: { ...catalogs.validators.v1 },
        tree: catalogs.treeFor(catalogs.v1),
        onEvent: (e: SurfaceEvent) => void several.push(e),
      }),
    );
    expect(html).toContain("Unavailable");
    expect(several).toEqual([{ type: "arrival-rejected", errors: [atValidator("catalog-mismatch")] }]);
  });

  test("validator_from_a_second_copy_is_rejected_not_thrown", async () => {
    const built = new URL("../../dist/index.js", import.meta.url);
    if (!existsSync(built)) {
      console.warn("validator_from_a_second_copy_is_rejected_not_thrown: dist/ is absent, run `bun run build`");
      return;
    }
    const other = (await import(built.href)) as typeof import("../index.ts");
    const { default: manifest } = await import("./fixtures/proof/agent-home.manifest.json");
    const { default: capabilities } = await import("./fixtures/proof/capabilities.json");
    const foreign = other.compileValidator({ catalog, capabilities, manifest } as never);
    expect(foreign.validateTree(tree(1) as UiTree).ok).toBe(true);
    const failure = thrown(() => render(() => <Text text="x" />, inputs, options(foreign)));
    expect(failure.errors).toEqual([shared]);
  });

  test("render_reads_the_validator_facts_once", () => {
    // The deterministic half of the render bench's verdict: the facts table is read once per render, not per step.
    const get = spyOn(WeakMap.prototype, "get");
    try {
      const reads = () => get.mock.calls.filter(([key]) => key === validator).length;
      render(() => <Text text="x" />, inputs, options(validator));
      const perRender = reads();
      get.mockClear();
      renderElements({ kind: "text", props: { text: "x" } }, options(validator));
      expect([perRender, reads()]).toEqual([1, 1]);
    } finally {
      get.mockRestore();
    }
  });

  test("surface_core_reads_the_validator_facts_once_per_core", () => {
    const get = spyOn(WeakMap.prototype, "get");
    try {
      const core = createSurfaceCore({ catalog, validator, onIntent: () => {} });
      for (let revision = 1; revision <= 3; revision++) expect(core.accept(tree(revision)).ok).toBe(true);
      expect(get.mock.calls.filter(([key]) => key === validator).length).toBe(1);
    } finally {
      get.mockRestore();
    }
  });

  test("facts_are_not_reachable_from_the_validator_object", () => {
    expect(Reflect.ownKeys(validator)).toEqual(["checkNode", "validateTree"]);
    expect(Object.getOwnPropertySymbols(validator)).toEqual([]);
  });
});
