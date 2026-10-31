import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { applyPatch, diffTrees } from "../index.ts";
import { GuideSurface, tree, validator } from "./fixtures/renderer-guide.tsx";

const patchSnippet = `import { applyPatch, type TreePatch, type UiTree } from "@arnilo/liveframe";

function receivePatch(current: UiTree, patch: TreePatch) {
  const result = applyPatch(current, patch);
  if (!result.ok) return requestWholeTree();
  const checked = validator.validateTree(result.value);
  if (!checked.ok) return requestWholeTree();
  setTree(checked.value); // host state passed to <Surface tree={...} />
}`;

test("renderer_guide_example_runs", async () => {
  const example = await Bun.file(new URL("./fixtures/renderer-guide.tsx", import.meta.url)).text();
  const guide = await Bun.file(new URL("../../docs/renderer.md", import.meta.url)).text();
  expect(guide).toContain("```tsx\n" + example + "```");
  expect(guide).toContain(["```ts", patchSnippet, "```"].join("\n"));
  expect(validator.validateTree(tree).ok).toBe(true);
  expect(renderToString(<GuideSurface tree={tree} onIntent={() => {}} />)).toBe(
    '<div data-lf-theme="acme@1.0.0" data-lf-ds="acme@1.0.0" class="lf_surface">' +
      '<button type="button" class="lf_button_default_root"><span class="lf_button_default_label">Claim</span></button>' +
      '</div><div data-lf-theme="acme@1.0.0" data-lf-ds="acme@1.0.0" class="lf_surface" data-lf-portal=""></div>',
  );
  const next = { ...tree, revision: 2, root: { ...tree.root, props: { label: "Claimed" } } };
  const patch = diffTrees(tree, next);
  expect(patch.ok).toBe(true);
  if (!patch.ok) return;
  const applied = applyPatch(tree, patch.value);
  expect(applied.ok && validator.validateTree(applied.value).ok).toBe(true);
  if (!applied.ok) return;
  expect(renderToString(<GuideSurface tree={applied.value} onIntent={() => {}} />)).toContain(">Claimed<");

  const invalid = { ...tree, catalogId: "other.ui@1" };
  const html = renderToString(<GuideSurface tree={invalid} onIntent={() => {}} />);
  expect(html).toContain("<p>Unavailable</p>");
  expect(html).not.toContain("<button");
});
