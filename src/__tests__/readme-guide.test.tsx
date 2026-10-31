import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { applyPatch, diffTrees } from "../index.ts";
import { Hello, tree } from "./fixtures/readme-quickstart.tsx";

const patchSnippet = `import { applyPatch, diffTrees } from "@arnilo/liveframe";

const next = {
  ...tree,
  revision: 2,
  root: { id: "root", kind: "text", props: { value: "Hello again" } },
};
const patch = diffTrees(tree, next);
if (patch.ok) {
  const updated = applyPatch(tree, patch.value);
  if (updated.ok) Hello({ tree: updated.value, onIntent: () => {} });
}`;

test("readme_quickstart_runs", async () => {
  const example = await Bun.file(new URL("./fixtures/readme-quickstart.tsx", import.meta.url)).text();
  const readme = await Bun.file(new URL("../../README.md", import.meta.url)).text();
  expect(readme).toContain(["```tsx", example.trimEnd(), "```"].join("\n"));
  expect(readme).toContain(["```ts", patchSnippet, "```"].join("\n"));
  const html = renderToString(<Hello tree={tree} onIntent={() => {}} />);
  expect(html).toContain("Hello from Liveframe");
  expect(html).toContain('class="lf_surface"');

  const next = {
    ...tree,
    revision: 2,
    root: { id: "root", kind: "text", props: { value: "Hello again" } },
  };
  const patch = diffTrees(tree, next);
  expect(patch.ok).toBe(true);
  if (!patch.ok) return;
  const updated = applyPatch(tree, patch.value);
  expect(updated.ok).toBe(true);
  if (!updated.ok) return;
  const patchedHtml = renderToString(<Hello tree={updated.value} onIntent={() => {}} />);
  expect(patchedHtml).toContain("Hello again");
});
