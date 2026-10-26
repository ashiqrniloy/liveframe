import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

const root = new URL("../../", import.meta.url).pathname;

/** Relative links in a Markdown file, outside fenced code blocks. */
function relativeLinks(markdown: string): string[] {
  const body = markdown.replace(/^```[\s\S]*?^```/gm, "");
  return [...body.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1] ?? "")
    .filter((target) => target && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target))
    .map((target) => target.replace(/[?#].*$/, ""))
    .filter((target) => target !== "");
}

test("docs_links_resolve", async () => {
  const files = [join(root, "README.md")];
  for (const name of await readdir(join(root, "docs"))) files.push(join(root, "docs", name));

  const broken: string[] = [];
  for (const file of files) {
    const markdown = await Bun.file(file).text();
    for (const target of relativeLinks(markdown)) {
      const resolved = join(dirname(file), decodeURIComponent(target));
      if (!(await Bun.file(resolved).exists())) broken.push(`${relative(root, file)} -> ${target}`);
    }
  }
  expect(broken).toEqual([]);
});
