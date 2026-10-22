import { describe, expect, mock, spyOn, test } from "bun:test";
import { compileValidator, type LiveframeError, obj, str, type UiNode, type UiTree } from "../index.ts";
import { compileTree } from "../validate/tree.ts";
import { stringBytes } from "../validate/bytes.ts";
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import proof from "./fixtures/proof/agent-home.tree.json" with { type: "json" };

const definition = catalog.definitions.find((d) => d.kind === "stack");
if (!definition) throw new Error("Missing stack fixture");
const options = {
  catalog: {
    ...catalog,
    definitions: [
      ...catalog.definitions,
      { ...definition, kind: "probe", props: obj({}, { text: str({ maxLength: 2_000_000 }) }), children: "any" },
      { ...definition, kind: "restricted", props: obj({}), children: [{ kind: "probe", min: 1, max: 2 }] },
    ],
  },
  capabilities,
  manifest,
};
const validator = compileValidator(options);
const node = (id = "root", children?: readonly UiNode[]): UiNode => ({
  id,
  kind: "probe",
  props: {},
  ...(children ? { children } : {}),
});
const tree = (root = node()): UiTree => ({
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "test",
  revision: 0,
  root,
});
function errors(value: unknown, settings?: Parameters<typeof validator.validateTree>[1]) {
  const result = validator.validateTree(value, settings);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected rejection");
  for (const error of result.errors) {
    expect(typeof error.nodeId).toBe("string");
    expect(typeof error.pointer).toBe("string");
    expect(error.expected?.length).toBeGreaterThan(0);
  }
  return result.errors;
}
function fails(value: unknown, kind: LiveframeError["kind"], pointer: string) {
  expect(errors(value)).toContainEqual(expect.objectContaining({ kind, pointer }));
}

describe("compiled tree validator", () => {
  test("metadata_is_closed_and_validated", () => {
    for (const [key, value] of [
      ["format", "other"],
      ["catalogId", "other.ui@1"],
      ["surfaceId", ""],
      ["surfaceId", "x".repeat(129)],
      ["revision", -1],
      ["revision", 0.5],
      ["revision", Number.MAX_SAFE_INTEGER + 1],
      ["revision", Infinity],
      ["extra~/", true],
    ] as const)
      fails({ ...tree(), [key]: value }, "invalid-prop", `/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
    for (const key of ["format", "catalogId", "surfaceId", "revision", "root"]) {
      const value = { ...tree() } as Record<string, unknown>;
      delete value[key];
      expect(errors(value).some((e) => e.pointer === `/${key}`)).toBe(true);
    }
    for (const value of [null, [], true, {}, { ...tree(), root: null }])
      expect(errors(value).length).toBeGreaterThan(0);
    expect(validator.validateTree({ ...tree(), surfaceId: "😀".repeat(128) }).ok).toBe(true);
  });

  test("identity_rules", () => {
    fails(tree(node("other")), "invalid-prop", "/root/id");
    for (const id of ["other/child", "rootish/a", "root/", "root/raw key", "root/%zz", "root/%2f"])
      fails(tree(node("root", [node(id)])), "invalid-prop", "/root/children/0/id");
    fails(tree(node("root", [node("root/a"), node("root/a")])), "duplicate-key", "/root/children/1/id");
    expect(validator.validateTree(tree(node("root", [node("root/a%2Fb:0_~")]))).ok).toBe(true);
    expect(validator.validateTree(tree(node("root", [node("root/fragment/child")]))).ok).toBe(true);
  });

  test("children_and_terms_rules", () => {
    fails(tree({ ...node(), kind: "restricted" }), "invalid-children", "/root/children");
    fails(
      tree({ ...node("root", [node("root/a"), node("root/b"), node("root/c")]), kind: "restricted" }),
      "invalid-children",
      "/root/children",
    );
    fails(
      tree({ ...node("root", [{ ...node("root/a"), kind: "stack" }]), kind: "restricted" }),
      "invalid-children",
      "/root/children/0/kind",
    );
    fails(tree({ ...node("root", [node("root/a")]), kind: "separator" }), "invalid-children", "/root/children");
    for (const kind of ["term", "detail"])
      fails(tree({ ...node(), kind, props: { text: "text" } }), "invalid-children", "/root/kind");
    fails(tree({ ...node("root", [node("root/a")]), kind: "terms" }), "invalid-children", "/root/children/0/kind");
    expect(validator.validateTree(tree({ ...node("root", [node("root/a")]), kind: "restricted" })).ok).toBe(true);
  });

  test("byte_count_equals_stringify", async () => {
    // Isolate byte accounting from widget-specific manifest and intent checks.
    const count = compileTree(catalog as unknown as Parameters<typeof compileTree>[0], () => true);
    const values: unknown[] = [];
    values.push(
      tree({ ...node(), props: { 'key"\\~/': [null, true, false, 0, -0, 1.5, -1e-7, 1e21, { cjk: "漢" }] } }),
    );
    for await (const file of new Bun.Glob("*.tree.json").scan(new URL("./fixtures/proof", import.meta.url).pathname))
      values.push(await Bun.file(new URL(`./fixtures/proof/${file}`, import.meta.url)).json());
    for (const text of [
      '"\\\b\f\n\r\t\u0000\u001f',
      "😀漢字é\u2028\u2029",
      "\ud800",
      "\udc00",
      "\ud800x\udc00",
      "",
      "ascii",
    ]) {
      values.push(tree({ ...node(), props: { text } }));
      expect(stringBytes(text)).toBe(new TextEncoder().encode(JSON.stringify(text)).length);
    }
    for (const value of values) {
      const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
      expect(count(value, { limits: { bytes } }).ok).toBe(true);
      const result = count(value, { limits: { bytes: bytes - 1 } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.at(-1)?.kind).toBe("limit-exceeded");
    }
    for (let i = 0; i <= 0xffff; i++) {
      const text = String.fromCharCode(i);
      expect(stringBytes(text)).toBe(new TextEncoder().encode(JSON.stringify(text)).length);
    }
  });

  test("string_bytes_respects_remaining_budget", () => {
    for (const text of ["plain ascii".repeat(100), 'quote"', "slash\\", "control\n", "é漢😀\ud800"]) {
      const exact = new TextEncoder().encode(JSON.stringify(text)).length;
      for (const maximum of [0, 2, 5, text.length + 2, exact, exact + 1]) {
        const counted = stringBytes(text, maximum);
        if (exact <= maximum) expect(counted).toBe(exact);
        else {
          expect(counted).toBeGreaterThan(maximum);
          expect(counted).toBeLessThanOrEqual(exact);
        }
      }
    }
  });

  test("limits_fail_closed", () => {
    const check = mock(validator.checkNode);
    const validate = compileTree(options.catalog as unknown as Parameters<typeof compileTree>[0], check);
    const wide = tree(
      node(
        "root",
        Array.from({ length: 5000 }, (_, i) => node(`root/${i}`)),
      ),
    );
    expect(validate(wide).ok).toBe(false);
    expect(check).toHaveBeenCalledTimes(5000);
    check.mockClear();
    let root = node(`root${"/a".repeat(64)}`);
    for (let i = 63; i >= 0; i--) root = node(`root${"/a".repeat(i)}`, [root]);
    expect(validate(tree(root)).ok).toBe(false);
    expect(check).toHaveBeenCalledTimes(64);
    check.mockClear();
    const large = tree({ ...node(), props: { text: "x".repeat(1024 * 1024) } });
    const overhead = new TextEncoder().encode(JSON.stringify(tree({ ...node(), props: { text: "" } }))).length;
    const exact = tree({ ...node(), props: { text: "x".repeat(1024 * 1024 - overhead) } });
    expect(validate(exact).ok).toBe(true);
    expect(validate({ ...exact, root: { ...exact.root, props: { text: `${exact.root.props.text}x` } } }).ok).toBe(
      false,
    );
    expect(validate(large).ok).toBe(false);
    expect(validate(wide, { limits: { nodes: 5001, bytes: 2_000_000 } }).ok).toBe(true);
    expect(validate(tree(root), { limits: { depth: 65 } }).ok).toBe(true);
    const blocked = {
      ...node("root/blocked"),
      get props(): never {
        throw new Error("Visited after byte limit");
      },
    };
    expect(validate(tree({ ...large.root, children: [blocked] })).ok).toBe(false);
  });

  test("errors_are_collected_and_bounded", () => {
    const bad = tree(
      node(
        "root",
        Array.from({ length: 25 }, (_, i) => ({ ...node(`root/${i}`), props: { extra: true } })),
      ),
    );
    const result = errors(bad);
    expect(result).toHaveLength(21);
    expect(result.at(-1)).toMatchObject({
      kind: "limit-exceeded",
      expected: "fix the errors above and validate again",
    });
    expect(errors(bad, { maxErrors: 2 })).toHaveLength(3);
    expect(errors(bad, { maxErrors: 30 })).toHaveLength(25);
    const check = mock(validator.checkNode);
    const validate = compileTree(options.catalog as unknown as Parameters<typeof compileTree>[0], check);
    validate(bad);
    expect(check).toHaveBeenCalledTimes(21); // Root plus the first 20 faulty children.
    expect(result.at(-1)?.pointer).toBe("/root/children/19/props/extra");
  });

  test("invalid_options_fail_closed", () => {
    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(errors(tree(), { maxErrors: value }).length).toBeGreaterThan(0);
      for (const key of ["nodes", "depth", "bytes"] as const)
        expect(errors(tree(), { limits: { [key]: value } }).length).toBeGreaterThan(0);
    }
  });

  test("non_json_and_cycles_are_rejected_without_throwing", () => {
    for (const value of [undefined, NaN, Infinity, () => 1, 1n, new Date()])
      expect(errors(tree({ ...node(), props: { text: value as never } })).length).toBeGreaterThan(0);
    const cycle: { id: string; kind: string; props: UiNode["props"]; children: unknown[] } = {
      ...node(),
      children: [],
    };
    cycle.children.push(cycle);
    expect(errors(tree(cycle as UiNode)).length).toBeGreaterThan(0);
    const shared = {};
    expect(
      validator.validateTree(
        tree(
          node("root", [
            { ...node("root/a"), props: shared },
            { ...node("root/b"), props: shared },
          ]),
        ),
      ).ok,
    ).toBe(true);
  });

  test("valid_tree_returned_unchanged", () => {
    for (const value of [tree(), proof]) {
      const result = validator.validateTree(value);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value as unknown).toBe(value);
      expect(Object.isFrozen(value)).toBe(false);
      expect(Object.isFrozen(value.root)).toBe(false);
    }
  });

  test("validation_does_not_serialise", () => {
    const stringify = spyOn(JSON, "stringify");
    try {
      expect(validator.validateTree(proof).ok).toBe(true);
      expect(stringify).not.toHaveBeenCalled();
    } finally {
      stringify.mockRestore();
    }
  });
});
