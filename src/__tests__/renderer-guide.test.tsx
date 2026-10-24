import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { GuideSurface, tree, validator } from "./fixtures/renderer-guide.tsx";

test("renderer_guide_example_runs", async () => {
  const example = await Bun.file(new URL("./fixtures/renderer-guide.tsx", import.meta.url)).text();
  const guide = await Bun.file(new URL("../../docs/renderer.md", import.meta.url)).text();
  expect(guide).toContain("```tsx\n" + example + "```");
  expect(validator.validateTree(tree).ok).toBe(true);
  expect(renderToString(<GuideSurface tree={tree} onIntent={() => {}} />)).toBe(
    '<div data-lf-theme="acme@1.0.0" data-lf-ds="acme@1.0.0" class="lf_surface">' +
      '<button type="button" class="lf_button_default_root"><span class="lf_button_default_label">Claim</span></button>' +
      '</div><div data-lf-theme="acme@1.0.0" data-lf-ds="acme@1.0.0" class="lf_surface" data-lf-portal=""></div>',
  );
  const invalid = { ...tree, catalogId: "other.ui@1" };
  const html = renderToString(<GuideSurface tree={invalid} onIntent={() => {}} />);
  expect(html).toContain("<p>Unavailable</p>");
  expect(html).not.toContain("<button");
});
