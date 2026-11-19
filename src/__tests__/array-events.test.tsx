import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import {
  arr,
  bool,
  checkOffered,
  classifyCatalogChange,
  compileValidator,
  type Intent,
  int,
  num,
  obj,
  str,
  validateCatalog,
} from "../index.ts";
import { createRenderer, type ImplementationProps, implement } from "../react/index.ts";
import { validateTemplate } from "../template/index.ts";
import * as select from "./fixtures/array-events.ts";
import { surfaceProps } from "./fixtures/react-surface.tsx";

function withCarry(carries: unknown) {
  const catalog = structuredClone(select.catalog);
  const definition = catalog.definitions.find((d) => d.kind === "stack");
  if (!definition) throw new Error("Missing stack");
  Object.assign(definition, { events: { onSelect: { carries, description: "Select." } } });
  return catalog;
}

test("array_carry_definition_is_validated", () => {
  expect(validateCatalog(select.catalog).ok).toBe(true);
  for (const items of [bool(), num(), int({ minimum: 0 }), { ...str({ maxLength: 8 }), nullable: true }])
    expect(validateCatalog(withCarry({ array: { items, maxItems: 256 } })).ok).toBe(true);
  for (const [array, pointer] of [
    [{ items: str({ maxLength: 8 }), maxItems: 0 }, "/array/maxItems"],
    [{ items: str({ maxLength: 8 }), maxItems: 257 }, "/array/maxItems"],
    [{ items: str({ maxLength: 8 }), maxItems: 1.5 }, "/array/maxItems"],
    [{ items: str({ maxLength: 8 }) }, "/array"],
    [{ items: { type: "string" }, maxItems: 4 }, "/array/items"],
    [{ items: arr(bool(), { maxItems: 2 }), maxItems: 4 }, "/array/items"],
    [{ items: obj({ a: bool() }), maxItems: 4 }, "/array/items"],
    [{ items: str({ maxLength: 8 }), maxItems: 4, minItems: 1 }, "/array"],
    [{ items: { type: "string", minLength: 9, maxLength: 8 }, maxItems: 4 }, "/array/items"],
  ] as const) {
    const result = validateCatalog(withCarry({ array }));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0]).toMatchObject({
        kind: "invalid-document",
        pointer: expect.stringContaining(`/events/onSelect/carries${pointer}`),
      });
  }
});

test("changed_array_carry_is_a_major_catalog_change", () => {
  expect(classifyCatalogChange(select.catalog, structuredClone(select.catalog)).level).toBe("none");
  for (const carries of [
    { array: { ...select.carry, maxItems: 4 } },
    { array: { ...select.carry, maxItems: 2 } },
    { array: { ...select.carry, items: str({ maxLength: 65 }) } },
    { array: { ...select.carry, items: int() } },
    { object: obj({ ids: str({ maxLength: 64 }) }) },
    "string",
  ])
    expect(classifyCatalogChange(select.catalog, withCarry(carries)).level).toBe("major");
  const added = structuredClone(select.catalog);
  const definition = added.definitions.find((d) => d.kind === "stack");
  Object.assign(definition ?? {}, {
    events: {
      ...definition?.events,
      onPick: { carries: { array: select.carry }, description: "Pick." },
    },
  });
  expect(classifyCatalogChange(select.catalog, added).level).toBe("minor");
});

test("array_event_fills_an_array_argument_and_state_key", () => {
  for (const intent of [
    { type: "action", name: "tasks.pick", args: { list: "l1" }, bind: "ids" },
    { type: "setState", key: "picked" },
  ] as const)
    expect(select.validator.validateTree(select.selectTree(intent)).ok).toBe(true);
  // Bounds are checked on the completed value; the fit compares item types only.
  const numeric = compileValidator({
    ...select,
    catalog: withCarry({ array: { items: int(), maxItems: 3 } }),
    manifest: {
      ...select.manifest,
      state: obj({ ...select.manifest.state.properties, picked: arr(num(), { maxItems: 9 }) }),
    },
  });
  expect(numeric.validateTree(select.selectTree({ type: "setState", key: "picked" })).ok).toBe(true);
});

test("array_event_with_unfitting_items_is_invalid_prop", () => {
  for (const [intent, pointer] of [
    [{ type: "action", name: "tasks.pick", args: { ids: ["a"] }, bind: "list" }, "/bind"],
    [{ type: "action", name: "tasks.pick", args: { list: "l1" }, bindAll: true }, "/bindAll"],
    [{ type: "setState", key: "reason" }, "/value"],
    [{ type: "setLocal", key: "q" }, "/value"],
    [
      { type: "action", name: "tasks.pick", args: { list: "l1" }, bind: "ids", local: [{ key: "q" }] },
      "/local/0/value",
    ],
  ] as const) {
    const result = select.validator.validateTree(select.selectTree(intent as Intent));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0]).toMatchObject({ kind: "invalid-prop", pointer: `/root/events/onSelect${pointer}` });
  }
  for (const [carries, isString] of [
    [{ array: { items: str({ maxLength: 8 }), maxItems: 3 } }, true],
    [{ array: { items: num(), maxItems: 3 } }, false],
    [{ array: { items: { ...str({ maxLength: 8 }), nullable: true }, maxItems: 3 } }, false],
  ] as const) {
    const intItems = compileValidator({
      ...select,
      catalog: withCarry(carries),
      manifest: {
        ...select.manifest,
        state: obj({ ...select.manifest.state.properties, picked: arr(int(), { maxItems: 3 }) }),
      },
    });
    expect(intItems.validateTree(select.selectTree({ type: "setState", key: "picked" })).ok).toBe(false);
    if (isString) expect(intItems.validateTree(select.selectTree()).ok).toBe(true);
  }
});

test("emit_rejects_an_array_outside_its_carry", () => {
  const intents: readonly Intent[] = [
    { type: "action", name: "tasks.pick", args: { list: "l1" }, bind: "ids" },
    { type: "setState", key: "picked" },
  ];
  for (const intent of intents) {
    let context: ImplementationProps | undefined;
    const intents: Intent[] = [];
    const { Surface } = createRenderer({
      catalog: select.catalog,
      implementations: select.catalog.definitions.map((definition) =>
        implement(definition, (input) => {
          context = input;
          return null;
        }),
      ),
    });
    renderToString(
      <Surface
        {...surfaceProps}
        validator={select.validator}
        tree={select.selectTree(intent)}
        onIntent={(i) => intents.push(i)}
      />,
    );
    if (!context) throw new Error("Missing select context");
    for (const invalid of [undefined, null, "a", {}, ["a", "b", "c", "d"], [1], ["x".repeat(65)], [null], [["a"]]]) {
      expect(() => context?.emit("onSelect", invalid as never)).toThrow("Invalid event value");
      expect(intents).toEqual([]);
    }
    const value = ["t1", "t2"];
    context.emit("onSelect", value);
    expect(intents).toEqual([
      intent.type === "action"
        ? { type: "action", name: "tasks.pick", args: { list: "l1", ids: ["t1", "t2"] } }
        : { type: "setState", key: "picked", value: ["t1", "t2"] },
    ]);
    value.push("t3");
    expect(JSON.stringify(intents[0])).not.toContain("t3");
  }
});

test("host_rechecks_an_array_against_the_carry_and_the_capability", () => {
  const tree = select.selectTree();
  const origin = { surfaceId: tree.surfaceId, revision: tree.revision, nodeId: tree.root.id, event: "onSelect" };
  const posted = (ids: unknown): Intent => ({ type: "action", name: "tasks.pick", args: { list: "l1", ids } as never });
  expect(checkOffered(tree, origin, posted(["t1", "t2"]), select.validator).ok).toBe(true);
  for (const [ids, pointer] of [
    [["a", "b", "c", "d"], "/args/ids"],
    [[1], "/args/ids/0"],
    ["t1", "/args/ids"],
    [["t1", "t2", "t3"], "/args/ids"],
    [[], "/args/ids"],
    [["123456789"], "/args/ids/0"],
  ] as const) {
    const result = checkOffered(tree, origin, posted(ids), select.validator);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ kind: "invalid-prop", pointer });
  }
});

test("templates_apply_the_array_fit_rule", () => {
  const context = { catalog: select.catalog, capabilities: select.capabilities, manifest: select.manifest } as never;
  const problems = (intent: Record<string, unknown>) => {
    const result = validateTemplate(
      {
        format: "liveframe-template/1",
        root: { kind: "stack", props: { semantics: "group" }, events: { onSelect: intent } },
      },
      context,
    );
    return result.ok ? [] : result.errors.map((error) => `${error.kind} ${error.pointer}`);
  };
  expect(problems({ type: "action", name: "tasks.pick", args: { list: "l1" }, bind: "ids" })).toEqual([]);
  expect(problems({ type: "setState", key: "picked" })).toEqual([]);
  const at = "/root/events/onSelect";
  expect(problems({ type: "action", name: "tasks.pick", args: { ids: ["a"] }, bind: "list" })).toEqual([
    `invalid-prop ${at}/bind`,
  ]);
  expect(problems({ type: "action", name: "tasks.pick", args: { list: "l1" }, bindAll: true })).toEqual([
    `invalid-prop ${at}/bindAll`,
  ]);
  expect(problems({ type: "setState", key: "reason" })).toEqual([`invalid-prop ${at}/value`]);
  expect(problems({ type: "setLocal", key: "q" })).toEqual([`invalid-prop ${at}/value`]);
});
