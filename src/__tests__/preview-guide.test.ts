import { expect, test } from "bun:test";
import { filtered, log, pkg, store, tree } from "./fixtures/preview-guide.ts";

test("preview_guide_example_runs", async () => {
  const source = await Bun.file(new URL("./fixtures/preview-guide.ts", import.meta.url)).text();
  const example = source.replaceAll("./preview-guide-host.ts", "./host.ts");
  const guide = await Bun.file(new URL("../../docs/preview.md", import.meta.url)).text();
  expect(guide).toContain(`\`\`\`ts\n${example}\`\`\``);
  expect(tree.root.id).toBe("root");
  expect(filtered.revision).toBeGreaterThan(tree.revision);
  expect(log).toEqual([{ type: "action", name: "tasks.claim", args: { id: "t1" } }]);
  expect((await store.getPackage(pkg.manifest.id, pkg.manifest.version))?.hash).toBe(pkg.hash);
});
