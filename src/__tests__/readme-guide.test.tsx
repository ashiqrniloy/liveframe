import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Hello, tree } from "./fixtures/readme-quickstart.tsx";

test("readme_quickstart_runs", async () => {
  const example = await Bun.file(new URL("./fixtures/readme-quickstart.tsx", import.meta.url)).text();
  const readme = await Bun.file(new URL("../../README.md", import.meta.url)).text();
  expect(readme).toContain(["```tsx", example.trimEnd(), "```"].join("\n"));
  const html = renderToString(<Hello tree={tree} onIntent={() => {}} />);
  expect(html).toContain("Hello from Liveframe");
  expect(html).toContain('class="lf_surface"');
});
