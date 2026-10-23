import { expect, test } from "bun:test";

test("src_is_host_api_free", async () => {
  const root = new URL("../", import.meta.url).pathname;
  const forbidden =
    /\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis)\s*[.[]/;
  const transpiler = new Bun.Transpiler({ loader: "tsx" });
  for await (const path of new Bun.Glob("**/*.{ts,tsx,js,jsx}").scan(root)) {
    if (path.split("/").includes("__tests__")) continue;
    // Only the CLI reads catalogs and writes generated modules; the SDK emitter remains host-free.
    if (path.startsWith("cli/")) continue;
    const source = await Bun.file(`${root}${path}`).text();
    expect(source, path).not.toMatch(forbidden);
    expect(source, path).not.toMatch(/\bimport\s*\(/);
    // Core imports must remain relative, so a dependency cannot hide a host API.
    for (const dependency of transpiler.scanImports(source)) {
      expect(dependency.path, path).toMatch(/^\.\.?\//);
      expect(dependency.path, path).not.toContain("proof/");
    }
  }
  const bundle = await Bun.build({
    entrypoints: [new URL("../index.ts", import.meta.url).pathname],
    target: "browser",
  });
  expect(bundle.success).toBe(true);
});
