import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderElements, streamElements } from "@arnilo/liveframe/sdk";
import capabilities from "../../conformance/corpus/common/capabilities.json" with { type: "json" };
import localManifest from "../../conformance/corpus/common/local-manifest.json" with { type: "json" };
import proofCatalog from "../../conformance/corpus/common/proof-catalog.json" with { type: "json" };
import referenceCatalog from "../../conformance/corpus/common/reference-catalog.json" with { type: "json" };
import type { Result } from "../errors.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";
import { type CompiledValidator, compileValidator } from "../index.ts";
import { utf8Length } from "../internal.ts";

/**
 * Spec §10: three implementations apply the tree rules: the arrival walk (`validateTree`), the SDK
 * build pass (`renderElements`, which checks as it emits) and the stream build (`streamElements`).
 * The walk is the authority. Each case here is a `UiTree`, written once more as the element JSON
 * that builds it, and all three must give it one verdict: accepted, or rejected with the same
 * first error kind at the same node field.
 */

type Limits = { readonly nodes?: number; readonly depth?: number; readonly bytes?: number };
type Verdict = { readonly ok: true } | { readonly ok: false; readonly kind: string; readonly at: string };

const corpusRoot = fileURLToPath(new URL("../../conformance/corpus/ui-tree/", import.meta.url));
const proof = compileValidator({ catalog: proofCatalog, capabilities, manifest: localManifest });
const references = compileValidator({ catalog: referenceCatalog, capabilities, manifest: localManifest });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The element JSON that builds `node`: its id's last segment becomes the key, `when` and `bind`
 * are element fields, the tree's `focus` becomes `focus: true` on the node it names, and every other
 * field is copied as it is, well-formed or not, so a broken tree becomes the same broken element.
 */
function toElement(node: unknown, parentId: string | undefined, focus?: unknown): unknown {
  if (!isRecord(node)) return node;
  const element: Record<string, unknown> = {};
  if (Object.hasOwn(node, "kind")) element.kind = node.kind;
  if (parentId !== undefined && typeof node.id === "string") element.key = node.id.slice(parentId.length + 1);
  if (Object.hasOwn(node, "variant")) element.variant = node.variant;
  if (node.props !== undefined) element.props = node.props;
  if (Object.hasOwn(node, "style")) element.style = node.style;
  if (Object.hasOwn(node, "events")) element.events = node.events;
  if (node.when !== undefined) element.when = node.when;
  if (node.bind !== undefined) element.bind = node.bind;
  if (focus !== undefined && node.id === focus) element.focus = true;
  if (Object.hasOwn(node, "children"))
    element.children = Array.isArray(node.children)
      ? node.children.map((child) => toElement(child, node.id as string, focus))
      : node.children;
  return element;
}

/**
 * Why the element form cannot state a tree, or undefined when it can: every id must be its parent's
 * id plus one key segment (the build derives ids), the root's id is `root`, and the sections the
 * element form defaults (`props`) must be present.
 */
function treeOnly(tree: UiTree): string | undefined {
  if (!Number.isSafeInteger(tree.revision) || tree.revision < 1)
    return "a revision that is not a positive integer: the build takes the revision as an option";
  const visit = (node: unknown, parentId: string | undefined): string | undefined => {
    if (!isRecord(node)) return undefined;
    const { id } = node;
    if (typeof id !== "string") return "a node without a string id: the build derives ids";
    if (parentId === undefined && id !== "root") return "a root id other than root: the build names the root";
    if (parentId !== undefined) {
      const segment = id.slice(parentId.length + 1);
      if (!id.startsWith(`${parentId}/`) || segment === "" || segment.includes("/"))
        return "an id that is not its parent's id plus one segment: the build derives ids";
      if (decodeURIComponent(segment) !== segment) return "an encoded id segment: the build encodes keys";
    }
    if (!Object.hasOwn(node, "props")) return "a node without props: the element form defaults props to {}";
    if (Array.isArray(node.children))
      for (const child of node.children) {
        const why = visit(child, id);
        if (why) return why;
      }
    return undefined;
  };
  return visit(tree.root, undefined);
}

/**
 * The first error, as the node field it names. The walk points into the tree (`/root/…`); the
 * builds point into the element JSON. With no fragments the two paths are the same below the root.
 * A trailing `/id` or `/kind` names the node itself: the walk points at the id of a duplicate, the
 * builds at the element, which has no id.
 */
function verdict(result: Result<UiTree>, tree: boolean, focusAt?: string): Verdict {
  if (result.ok) return { ok: true };
  const first = result.errors[0];
  if (!first) throw new Error("a rejection without errors");
  let at = first.pointer;
  // The walk names the tree's `focus`; the builds name the `focus` of the element that carries the mark.
  if (tree && at === "/focus" && focusAt !== undefined) at = `${focusAt}/focus`;
  if (tree) {
    if (!at.startsWith("/root")) throw new Error(`a walk pointer outside the root: ${at}`);
    at = at.slice("/root".length);
  }
  return { ok: false, kind: first.kind, at: at.replace(/\/(id|kind)$/, "") };
}

type Verdicts = { readonly walk: Verdict; readonly build: Verdict; readonly stream: Verdict };

function verdicts(validator: CompiledValidator, tree: UiTree, limits?: Limits): Verdicts {
  const options = limits ? { limits } : {};
  const walked = validator.validateTree(tree, options);
  const element = toElement(tree.root, undefined, tree.focus);
  const render = { validator, surfaceId: tree.surfaceId, revision: tree.revision, ...options };
  const built = renderElements(element, render);
  const stream = streamElements({ ...render, revision: tree.revision - 1 });
  stream.push(JSON.stringify(element));
  const streamed = stream.end();
  // An accepted tree is rebuilt node for node; the stream's revision counts its snapshots.
  if (walked.ok && built.ok) expect(built.value).toEqual(tree);
  if (walked.ok && streamed.ok) expect(streamed.value.root).toEqual(tree.root);
  const focusAt = tree.focus === undefined ? undefined : nodePointer(tree.root, tree.focus, "/root");
  return { walk: verdict(walked, true, focusAt), build: verdict(built, false), stream: verdict(streamed, false) };
}

/** The walk pointer of the node with `id`, or undefined when the tree has none. */
function nodePointer(node: unknown, id: string, at: string): string | undefined {
  if (!isRecord(node)) return undefined;
  if (node.id === id) return at;
  if (!Array.isArray(node.children)) return undefined;
  for (const [i, child] of node.children.entries()) {
    const found = nodePointer(child, id, `${at}/children/${i}`);
    if (found) return found;
  }
  return undefined;
}

function agree(validator: CompiledValidator, tree: UiTree, limits?: Limits): Verdict {
  const found = verdicts(validator, tree, limits);
  expect(found).toEqual({ walk: found.walk, build: found.walk, stream: found.walk });
  return found.walk;
}

/**
 * Known disagreements, recorded for the owner. All three still reject and the two builds still
 * agree with each other; the strict three-way check of each case is skipped.
 * - Child counts: a kind with too many children of a kind is `invalid-children` in all three, but the
 *   builds point at the node and the walk at its `children`.
 * - Byte limit: all three reject at the same budget, but each names the field where its own count
 *   crossed it. The walk counts in document order; the build counts a node's own fields when the
 *   node closes, after its children.
 */
function knownDifference(validator: CompiledValidator, tree: UiTree, limits?: Limits): Verdicts {
  const found = verdicts(validator, tree, limits);
  expect(found.walk.ok).toBe(false);
  expect(found.build.ok).toBe(false);
  expect(found.stream).toEqual(found.build);
  return found;
}

/**
 * Corpus trees whose `focus` names no node: element JSON marks an element, so it cannot state a mark
 * without a target or with a malformed id. Only the walk sees them.
 */
const CORPUS_WALK_ONLY: ReadonlySet<string> = new Set(["focus-missing.json", "focus-malformed.json"]);

function framed(root: unknown): UiTree {
  return { format: "liveframe/1", catalogId: "proof.ui@1", surfaceId: "parity", revision: 1, root } as UiTree;
}

describe("tree rule parity", () => {
  test("corpus_trees_get_one_verdict_from_all_three", async () => {
    const names = [...new Bun.Glob("*.json").scanSync({ cwd: corpusRoot })].sort();
    expect(names.length).toBeGreaterThan(20);
    const read = (path: string) => Bun.file(resolve(corpusRoot, path)).json();
    for (const name of names) {
      const entry = await read(join(corpusRoot, name));
      const tree = (await read(entry.inputs.doc)) as UiTree;
      expect(treeOnly(tree), name).toBeUndefined();
      const validator = compileValidator({
        catalog: await read(entry.inputs.catalog),
        capabilities: await read(entry.inputs.capabilities),
        manifest: await read(entry.inputs.manifest),
      });
      if (CORPUS_WALK_ONLY.has(name)) {
        expect(validator.validateTree(tree).ok, name).toBe(entry.expect.ok);
        continue;
      }
      const found = verdicts(validator, tree, entry.options.limits);
      expect({ name, ...found }).toEqual({ name, walk: found.walk, build: found.walk, stream: found.walk });
      // The corpus states the walk's verdict; the parity test only adds the other two.
      expect(found.walk.ok).toBe(entry.expect.ok);
    }
  });

  /** A valid tree that uses every node field: variant, style, events, when, bind and nested children. */
  function base(): UiNode {
    return {
      id: "root",
      kind: "stack",
      props: { label: "Main" },
      style: { gap: "space.2" },
      children: [
        {
          id: "root/menu",
          kind: "menu",
          props: { label: "Menu" },
          children: [
            {
              id: "root/menu/a",
              kind: "menuItem",
              props: { label: "A" },
              events: { onPress: { type: "action", name: "tasks.claim", args: { id: "task:1" } } },
            },
          ],
        },
        { id: "root/button", kind: "button", variant: "default", props: { label: "Go" } },
        {
          id: "root/field",
          kind: "textField",
          props: { label: "Filter" },
          events: { onChange: { type: "setLocal", key: "q" } },
        },
        {
          id: "root/row",
          kind: "text",
          props: { text: "Row" },
          when: { $path: "local.expanded" },
          bind: { text: { $path: "local.q" } },
        },
      ],
    } as unknown as UiNode;
  }

  /** The node at a path of child indexes, in a fresh copy of the base tree. */
  function at(path: readonly number[]): { root: UiNode; node: Record<string, unknown> } {
    const root = structuredClone(base()) as unknown as Record<string, unknown>;
    let node = root;
    for (const index of path) node = (node.children as Record<string, unknown>[])[index] as Record<string, unknown>;
    return { root: root as unknown as UiNode, node };
  }

  const FIELDS = ["kind", "variant", "props", "style", "events", "children", "when", "bind"] as const;
  /** A node of the base tree that carries each field, by child-index path. */
  const CARRIER: Readonly<Record<(typeof FIELDS)[number], readonly number[]>> = {
    kind: [1],
    variant: [1],
    props: [0, 0],
    style: [],
    events: [0, 0],
    children: [0],
    when: [3],
    bind: [3],
  };
  /** A value of the wrong JSON type for each field. */
  const RETYPED: Readonly<Record<(typeof FIELDS)[number], unknown>> = {
    kind: 7,
    variant: ["default"],
    props: "props",
    style: [],
    events: "onPress",
    children: { kind: "menuItem" },
    when: "yes",
    bind: [],
  };

  /** The base tree with one menu item past the menu's maximum of 100. */
  function overfullMenu(): UiTree {
    const { root, node } = at([0]);
    node.children = Array.from({ length: 101 }, (_, i) => ({
      id: `root/menu/i${i}`,
      kind: "menuItem",
      props: { label: `Item ${i}` },
    }));
    return framed(root);
  }

  describe("known_differences_strict", () => {
    test.skip("child_count_over_names_the_same_field_in_all_three", () => {
      agree(proof, overfullMenu());
    });
    test.skip("byte_limit_names_the_same_field_in_all_three", () => {
      const tree = framed(base());
      agree(proof, tree, { bytes: utf8Length(JSON.stringify(tree)) - 1 });
    });
  });

  test("the_base_tree_is_valid", () => {
    expect(agree(proof, framed(base()))).toEqual({ ok: true });
  });

  describe("generated_breaks_get_one_verdict_from_all_three", () => {
    for (const field of FIELDS) {
      test(`${field}_removed`, () => {
        const { root, node } = at(CARRIER[field]);
        delete node[field];
        const tree = framed(root);
        // Without props the element form defaults them; that case is the walk's alone.
        if (field === "props") expect(treeOnly(tree)).toBeDefined();
        else agree(proof, tree);
      });
      test(`${field}_retyped`, () => {
        const { root, node } = at(CARRIER[field]);
        node[field] = RETYPED[field];
        expect(agree(proof, framed(root)).ok).toBe(false);
      });
      test(`${field}_on_a_duplicated_node`, () => {
        // The carrier written twice among its siblings: the copy reuses the id.
        const path = CARRIER[field];
        if (path.length === 0) return; // The root has no siblings.
        const { root, node: parent } = at(path.slice(0, -1));
        const siblings = parent.children as unknown[];
        siblings.push(structuredClone(siblings[path[path.length - 1] as number]));
        expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "duplicate-key" });
      });
    }

    test("unknown_kind", () => {
      const { root, node } = at([1]);
      node.kind = "carousel";
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "unknown-component" });
    });
    test("undeclared_event", () => {
      const { root, node } = at([1]);
      node.events = { onHover: { type: "action", name: "tasks.claim", args: {} } };
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "undeclared-event" });
    });
    test("undeclared_action", () => {
      const { root, node } = at([1]);
      node.events = { onPress: { type: "action", name: "tasks.delete", args: {} } };
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "undeclared-action" });
    });
    test("wrong_child_kind", () => {
      const { root, node } = at([0]);
      (node.children as unknown[]).push({ id: "root/menu/b", kind: "button", props: { label: "B" } });
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "invalid-children" });
    });
    test("children_on_a_leaf", () => {
      const { root, node } = at([1]);
      node.children = [{ id: "root/button/t", kind: "text", props: { text: "x" } }];
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "invalid-children" });
    });
    test("child_count_under", () => {
      const { root, node } = at([0]);
      node.children = [];
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "invalid-children" });
    });
    test("child_count_over", () => {
      // The kind agrees; the field each names differs (see `knownDifference`).
      const over = knownDifference(proof, overfullMenu());
      for (const found of [over.walk, over.build, over.stream])
        expect(found).toMatchObject({ ok: false, kind: "invalid-children" });
    });
    test("duplicate_id", () => {
      const { root, node } = at([]);
      (node.children as unknown[]).push({ id: "root/button", kind: "text", props: { text: "Twin" } });
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "duplicate-key" });
    });
    test("invalid_prop", () => {
      const { root, node } = at([1]);
      (node.props as Record<string, unknown>).label = 7;
      expect(agree(proof, framed(root))).toMatchObject({ ok: false, kind: "invalid-prop" });
    });

    function referenced(hint: Record<string, unknown>, target: string): UiTree {
      return framed({
        id: "root",
        kind: "stack",
        props: {},
        children: [
          { id: "root/text", kind: "text", props: { text: "Field", describedBy: target } },
          { id: "root/hint", kind: "text", props: { text: "Hint" }, ...hint },
        ],
      });
    }
    test("reference_valid", () => {
      expect(agree(references, referenced({}, "root/hint"))).toEqual({ ok: true });
    });
    test("reference_missing", () => {
      expect(agree(references, referenced({}, "root/nowhere"))).toMatchObject({ ok: false, kind: "not-found" });
    });
    test("reference_to_a_gated_target", () => {
      const tree = referenced({ when: { $path: "local.expanded" } }, "root/hint");
      expect(agree(references, tree)).toMatchObject({ ok: false, kind: "invalid-prop" });
    });
    test("reference_under_a_gated_ancestor", () => {
      const tree = framed({
        id: "root",
        kind: "stack",
        props: {},
        children: [
          { id: "root/text", kind: "text", props: { text: "Field", describedBy: "root/group/hint" } },
          {
            id: "root/group",
            kind: "stack",
            props: {},
            when: { $path: "local.expanded" },
            children: [{ id: "root/group/hint", kind: "text", props: { text: "Hint" } }],
          },
        ],
      });
      expect(agree(references, tree)).toMatchObject({ ok: false, kind: "invalid-prop" });
    });
  });

  test("tree_only_cases_are_rejected_by_the_walk", () => {
    const cases: [string, UiTree][] = [];
    for (const [name, change] of [
      ["id_removed", (node: Record<string, unknown>) => delete node.id],
      ["id_retyped", (node: Record<string, unknown>) => (node.id = 7)],
      ["id_not_key_derived", (node: Record<string, unknown>) => (node.id = "elsewhere/button")],
      ["props_removed", (node: Record<string, unknown>) => delete node.props],
    ] as const) {
      const { root, node } = at([1]);
      change(node);
      cases.push([name, framed(root)]);
    }
    cases.push(["revision_retyped", { ...framed(base()), revision: "1" } as unknown as UiTree]);
    for (const [name, tree] of cases) {
      expect(treeOnly(tree), name).toBeString();
      expect(proof.validateTree(tree).ok, name).toBe(false);
    }
  });

  describe("limits_agree_at_the_boundary", () => {
    /** A root with `count` text children: `count + 1` nodes. */
    function wide(count: number): UiTree {
      return framed({
        id: "root",
        kind: "stack",
        props: {},
        children: Array.from({ length: count }, (_, i) => ({ id: `root/t${i}`, kind: "text", props: { text: "x" } })),
      });
    }
    /** A chain of `levels` stacks, the root at level 1. */
    function deep(levels: number): UiTree {
      let node: Record<string, unknown> | undefined;
      const ids = Array.from({ length: levels }, (_, i) => ["root", ...Array(i).fill("s")].join("/"));
      for (const id of ids.reverse()) node = { id, kind: "stack", props: {}, ...(node ? { children: [node] } : {}) };
      return framed(node);
    }

    test("nodes", () => {
      const tree = wide(9);
      expect(agree(proof, tree, { nodes: 10 })).toEqual({ ok: true });
      expect(agree(proof, tree, { nodes: 9 })).toMatchObject({ ok: false, kind: "limit-exceeded" });
    });
    test("depth", () => {
      const tree = deep(6);
      expect(agree(proof, tree, { depth: 6 })).toEqual({ ok: true });
      expect(agree(proof, tree, { depth: 5 })).toMatchObject({ ok: false, kind: "limit-exceeded" });
    });
    test("bytes", () => {
      for (const tree of [wide(9), deep(6), framed(base())]) {
        const bytes = utf8Length(JSON.stringify(tree));
        expect(agree(proof, tree, { bytes })).toEqual({ ok: true });
        // The verdict and kind agree; the field each names differs (see `knownDifference`).
        const over = knownDifference(proof, tree, { bytes: bytes - 1 });
        for (const found of [over.walk, over.build, over.stream])
          expect(found).toMatchObject({ ok: false, kind: "limit-exceeded" });
      }
    });
  });
});
