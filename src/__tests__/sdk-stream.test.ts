import { expect, test } from "bun:test";
import { renderElements, streamElements } from "@arnilo/liveframe/sdk";
import type { LiveframeError, Result } from "../errors.ts";
import type { UiTree } from "../formats/tree.ts";
import { applyPatch, compileValidator, diffTrees } from "../index.ts";
import { ephemeralManifest } from "../sdk/elements.ts";
import cases from "./fixtures/elements.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import { renderWorkloads } from "./fixtures/render-workloads.ts";

const workloads = renderWorkloads();
const documents = cases.map((entry, index) => {
  const workload = workloads[index];
  if (!workload) throw new Error("Missing workload");
  return { name: entry.name, doc: entry.elements as unknown, validator: workload.validator };
});
const first = documents[0];
if (!first) throw new Error("Missing documents");
const { validator } = first;
const options = { validator, surfaceId: "stream" };

/** A small deterministic generator, so a failing split can be replayed. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function chunked(text: string, next: () => number, largest: number): string[] {
  const out: string[] = [];
  for (let at = 0; at < text.length; ) {
    const size = 1 + Math.floor(next() * largest);
    out.push(text.slice(at, at + size));
    at += size;
  }
  return out;
}

type Run = { readonly trees: UiTree[]; readonly final: Result<UiTree>; readonly early: Result<UiTree>[] };

function run(doc: unknown, chunks: readonly string[], overrides: object = {}): Run {
  const stream = streamElements({ ...options, validator: validatorOf(doc), ...overrides });
  const trees: UiTree[] = [];
  const early: Result<UiTree>[] = [];
  for (const chunk of chunks) {
    const result = stream.push(chunk);
    if (result?.ok) trees.push(result.value);
    else if (result) early.push(result);
  }
  return { trees, final: stream.end(), early };
}

function validatorOf(doc: unknown) {
  return documents.find((entry) => entry.doc === doc)?.validator ?? validator;
}

function expectEquivalent(doc: unknown, chunks: readonly string[]): Run {
  const result = run(doc, chunks);
  const expected = renderElements(doc, { ...options, validator: validatorOf(doc), revision: result.trees.length + 1 });
  expect(result.final).toEqual(expected);
  return result;
}

test("stream_end_equals_renderElements", () => {
  for (const { name, doc } of documents) {
    const text = JSON.stringify(doc);
    const next = random(name.length);
    const label = `${name} (${text.length} chars)`;
    if (text.length <= 2000) {
      // Every split point, in two chunks.
      for (let at = 0; at <= text.length; at++) expectEquivalent(doc, [text.slice(0, at), text.slice(at)]);
    }
    expectEquivalent(doc, [text]);
    expectEquivalent(doc, [...text]);
    for (let round = 0; round < 6; round++) {
      const result = expectEquivalent(doc, chunked(text, next, 1 + round * 40));
      expect(result.early, label).toEqual([]);
    }
  }
});

test("stream_trees_are_valid_and_grow", () => {
  for (const { name, doc, validator: own } of documents) {
    const text = JSON.stringify(doc);
    const result = run(doc, chunked(text, random(7), 64));
    expect(result.trees.length, name).toBeGreaterThan(1);
    result.trees.forEach((tree, index) => {
      expect(tree.revision).toBe(index + 1);
      const checked = own.validateTree(tree);
      if (!checked.ok) throw new Error(`${name} tree ${index}: ${JSON.stringify(checked.errors.slice(0, 3))}`);
    });
    expect(result.final.ok).toBe(true);
    if (!result.final.ok) continue;
    expect(result.final.value.revision).toBe(result.trees.length + 1);
  }
});

test("incomplete_node_omitted", () => {
  const stream = streamElements(options);
  const first = stream.push(
    '{"kind":"stack","props":{},"children":[{"kind":"text","key":"a","props":{"text":"one"}},{"kind":"te',
  );
  expect(first?.ok && first.value.root.children?.map((child) => child.id)).toEqual(["root/a"]);
  // A half-written node, and everything after it, is not in a tree until its object closes.
  expect(stream.push('xt","key":"b","props":{"text":"two"')).toBeUndefined();
  const second = stream.push('}},{"kind":"text","key":"c","props":{"text":"three"}}');
  expect(second?.ok && second.value.root.children?.map((child) => child.id)).toEqual(["root/a", "root/b", "root/c"]);
  expect(stream.end().ok).toBe(false);
});

test("stream_trees_diff_cleanly", () => {
  for (const { name, doc } of documents.slice(0, 3)) {
    const result = run(doc, chunked(JSON.stringify(doc), random(11), 80));
    let held = result.trees[0] as UiTree;
    for (const next of result.trees.slice(1)) {
      const patch = diffTrees(held, next);
      if (!patch.ok) throw new Error(`${name}: ${JSON.stringify(patch.errors)}`);
      const applied = applyPatch(held, patch.value);
      expect(applied.ok && applied.value).toEqual(next);
      held = next;
    }
    // Earlier trees are never changed by later chunks.
    const again = run(doc, chunked(JSON.stringify(doc), random(11), 80));
    expect(result.trees).toEqual(again.trees);
  }
});

function failure(result: Result<UiTree> | undefined): LiveframeError {
  if (!result || result.ok) throw new Error("Expected a failure");
  return result.errors[0] as LiveframeError;
}

test("malformed_json_reports_offset", () => {
  const text = '{"kind":"text","props":{"text":x}}';
  const stream = streamElements(options);
  expect(stream.push(text.slice(0, 20))).toBeUndefined();
  const error = failure(stream.push(text.slice(20)));
  expect(error.kind).toBe("invalid-document");
  expect(error.pointer).toBe(`/$stream/${text.indexOf("x}")}`);
  // The failure stands from then on.
  expect(failure(stream.push("{}")).pointer).toBe(error.pointer);
  expect(failure(stream.end()).pointer).toBe(error.pointer);

  for (const [bad, offset] of [
    ['{"kind" "text"}', 8],
    ["[1,]", 3],
    ['{"a":1}x', 7],
    ['{"a":"\\q"}', 7],
    ['{"a":"\\u00zz"}', 10],
    ['{"a":tru}', 5],
    ['{"a":01}', 5],
    ['{"a":"\n"}', 6],
  ] as const) {
    const result = streamElements(options);
    const early = result.push(bad);
    const error = failure(early ?? result.end());
    expect(`${bad} ${error.kind} ${error.pointer}`).toBe(`${bad} invalid-document /$stream/${offset}`);
  }
  expect(failure(streamElements(options).end()).pointer).toBe("/$stream/0");
  const open = streamElements(options);
  open.push('{"kind":"text"');
  expect(failure(open.end()).pointer).toBe("/$stream/14");
});

test("stream_respects_byte_limit", () => {
  const stream = streamElements({ ...options, limits: { bytes: 400 } });
  const rows = Array.from({ length: 12 }, (_, i) => ({ kind: "text", key: `r${i}`, props: { text: "x".repeat(60) } }));
  const text = JSON.stringify({ kind: "stack", props: {}, children: rows });
  let reported: Result<UiTree> | undefined;
  for (const chunk of chunked(text, random(3), 50)) {
    const result = stream.push(chunk);
    if (result && !result.ok) reported ??= result;
  }
  expect(failure(reported).kind).toBe("limit-exceeded");
  expect(failure(stream.end()).kind).toBe("limit-exceeded");

  // A document far past the budget is refused before it is held.
  const huge = streamElements({ ...options, limits: { bytes: 100 } });
  const error = failure(huge.push(`{"kind":"text","props":{"text":"${"y".repeat(500)}"}}`));
  expect(error.kind).toBe("limit-exceeded");
  expect(error.pointer).toStartWith("/$stream/");
});

test("invalid_node_is_omitted_then_reported", () => {
  const doc = {
    kind: "stack",
    props: {},
    children: [
      { kind: "text", key: "a", props: { text: "fine" } },
      { kind: "text", key: "b", props: { text: 3 } },
      { kind: "text", key: "c", props: { text: "also fine" } },
    ],
  };
  const result = expectEquivalent(doc, chunked(JSON.stringify(doc), random(5), 9));
  const last = result.trees.at(-1);
  expect(last?.root.children?.map((child) => child.id)).toEqual(["root/a", "root/c"]);
  expect(result.final.ok).toBe(false);
});

test("members_after_children_still_end_exactly", () => {
  const doc = {
    children: [{ kind: "text", props: { text: "inside" } }],
    props: {},
    key: "late",
    kind: "stack",
  };
  const result = expectEquivalent(doc, chunked(JSON.stringify(doc), random(9), 7));
  expect(result.final.ok && result.final.value.root.id).toBe("root");
  expect(result.trees.length).toBeLessThanOrEqual(1);
});

test("fragments_references_and_strays_end_exactly", () => {
  const docs: unknown[] = [
    {
      kind: "stack",
      props: {},
      children: [
        {
          kind: "fragment",
          key: "f",
          children: [
            { kind: "text", key: "a", props: { text: "a" } },
            { kind: "text", key: "b", props: { text: "b" } },
          ],
        },
      ],
    },
    { kind: "stack", props: {}, children: [{ kind: "text", props: { text: "a" } }, 5] },
    { kind: "stack", props: {}, children: "no" },
    { kind: "stack", props: {}, children: [[{ kind: "text", props: { text: "a" } }]] },
    [{ kind: "text", props: { text: "a" } }],
    { kind: "stack", props: {}, extra: 1, children: [{ kind: "text", props: { text: "a" } }] },
    { kind: "text", props: { text: "leaf root" } },
    { kind: "stack", props: {}, children: [] },
    { kind: "stack", props: {}, children: [{ kind: "text", props: { text: "__proto__" }, __proto__: 1 }] },
  ];
  for (const doc of docs) {
    const text = JSON.stringify(doc);
    for (const chunks of [[text], [...text], chunked(text, random(2), 5)]) {
      const result = run(doc, chunks);
      const expected = renderElements(doc, { ...options, revision: result.trees.length + 1 });
      expect(result.final, text).toEqual(expected);
    }
  }
});

test("revision_option_continues_numbering", () => {
  const text = JSON.stringify({ kind: "stack", props: {}, children: [{ kind: "text", props: { text: "a" } }] });
  const result = run(undefined, chunked(text, random(1), 20), { revision: 41 });
  expect(result.trees[0]?.revision).toBe(42);
  expect(result.final.ok && result.final.value.revision).toBe(42 + result.trees.length);
});

test("bad_options_fail_at_the_first_call", () => {
  const stream = streamElements({ ...options, surfaceId: "" });
  expect(failure(stream.push("{}")).kind).toBe("invalid-prop");
  expect(failure(stream.end()).kind).toBe("invalid-prop");
});

test("references_draw_when_the_text_ends", () => {
  const catalog = {
    ...catalogDocument,
    definitions: catalogDocument.definitions.map((d) =>
      d.kind === "text"
        ? {
            ...d,
            refProps: ["describedBy"],
            props: {
              ...d.props,
              properties: { ...d.props.properties, describedBy: { type: "string", maxLength: 1024 } },
            },
          }
        : d,
    ),
  };
  const manifest = ephemeralManifest({ catalogId: catalog.catalogId, actions: [] });
  const refs = { validator: compileValidator({ catalog, capabilities, manifest }), surfaceId: "refs" };
  const doc = {
    kind: "stack",
    props: {},
    children: [
      { kind: "text", key: "plain", props: { text: "Plain" } },
      { kind: "text", key: "field", props: { text: "Field", describedBy: { $ref: "hint" } } },
      { kind: "text", key: "hint", $anchor: "hint", props: { text: "Hint" } },
    ],
  };
  const text = JSON.stringify(doc);
  const stream = streamElements(refs);
  const seen: string[][] = [];
  for (const chunk of chunked(text, random(4), 12)) {
    const tree = stream.push(chunk);
    if (tree?.ok) seen.push((tree.value.root.children ?? []).map((child) => child.id));
  }
  // The node waiting on a reference is never drawn early; the anchor and the plain node are.
  expect(seen.flat()).not.toContain("root/field");
  expect(seen.flat()).toContain("root/plain");
  const final = stream.end();
  expect(final).toEqual(renderElements(doc, { ...refs, revision: seen.length + 1 }));
  expect(final.ok && final.value.root.children?.[1]?.props.describedBy).toBe("root/hint");
});
