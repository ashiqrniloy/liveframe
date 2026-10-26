import { expect, test } from "bun:test";
import { Glob } from "bun";

const root = new URL("../", import.meta.url).pathname;
const installed = (await Bun.file(`${root}node_modules/@arnilo/liveframe/package.json`).json()) as {
  exports: Record<string, unknown>;
};

test("demo_uses_public_exports_only", async () => {
  const exported = new Set(Object.keys(installed.exports).map((key) => key.replace(/^\./, "@arnilo/liveframe")));
  const imports: string[] = [];
  for await (const file of new Glob("**/*.{ts,tsx}").scan({ cwd: root })) {
    if (file.startsWith("node_modules/") || file.startsWith("tests/") || file.endsWith(".gen.ts")) continue;
    const source = await Bun.file(`${root}${file}`).text();
    for (const [, specifier] of source.matchAll(/from "([^"]+)"/g)) {
      if (!specifier?.startsWith("@arnilo/liveframe")) {
        // Relative imports stay inside the demo.
        if (specifier?.startsWith(".."))
          expect(specifier, `${file} imports outside the demo`).not.toMatch(/\.\.\/\.\./);
        continue;
      }
      imports.push(specifier);
      expect(exported.has(specifier), `${file}: ${specifier} is not a public export`).toBe(true);
    }
  }
  expect(imports.length).toBeGreaterThan(5);
});
