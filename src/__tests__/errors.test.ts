import { expect, test } from "bun:test";

test("error_kinds_match_spec", async () => {
  const source = await Bun.file(new URL("../errors.ts", import.meta.url)).text();
  const spec = await Bun.file(new URL("../../docs/spec.md", import.meta.url)).text();
  const union = source.split("readonly kind:")[1]?.split("readonly pointer:")[0] ?? "";
  const validation = spec.split("## 10. Validation\n")[1]?.split("\n## 11.")[0] ?? "";
  const kinds = Array.from(union.matchAll(/"([a-z-]+)"/g), (match) => match[1]);
  const documented = Array.from(validation.matchAll(/^\| `([a-z-]+)` \|/gm), (match) => match[1]);

  expect(kinds.length).toBeGreaterThan(0);
  expect(documented.sort()).toEqual(kinds.sort());
});
