import { expect, test } from "bun:test";
import { join, relative } from "node:path";

// Each helper has one definition in src/internal.ts (or src/validate/patch.ts for findNode).
const patterns: readonly { readonly helper: string; readonly pattern: RegExp }[] = [
  { helper: "pointerSegment", pattern: /replaceAll\("~", "~0"\)|replace\(\/~\/g/ },
  // Other fallbacks than String(error), such as a conformance suite's fixed text, are distinct messages.
  { helper: "errorMessage", pattern: /instanceof Error \? \w+\.message : String\(/ },
  { helper: "queue", pattern: /=\s*\w+\.catch\(\(\) => \{\}\)/ },
  { helper: "isThenable", pattern: /typeof [^;]*\.then\s*[!=]==\s*"function"/ },
  { helper: "findNode", pattern: /\.children\?\.map\(\w+\)\.find\(/ },
];

test("no_duplicate_helpers", async () => {
  const src = join(import.meta.dir, "..");
  const found: string[] = [];
  for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan(src)) {
    if (path.startsWith("__tests__/") || path === "internal.ts") continue;
    const lines = (await Bun.file(join(src, path)).text()).split("\n");
    lines.forEach((line, i) => {
      for (const { helper, pattern } of patterns)
        if (pattern.test(line)) found.push(`${relative(src, join(src, path))}:${i + 1} re-implements ${helper}`);
    });
  }
  expect(found).toEqual([]);
});
