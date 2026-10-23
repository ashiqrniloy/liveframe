import { expect, test } from "bun:test";

test("sdk_bundles_for_browser_without_host_apis", async () => {
  const bundle = await Bun.build({
    entrypoints: ["../sdk/index.ts", "../sdk/jsx-runtime.ts", "../sdk/jsx-dev-runtime.ts"].map(
      (path) => new URL(path, import.meta.url).pathname,
    ),
    target: "browser",
  });
  expect(bundle.success).toBe(true);
  expect(bundle.outputs).toHaveLength(3);
  for (const output of bundle.outputs) {
    const source = await output.text();
    expect(source, output.path).not.toMatch(
      /\b(?:node|bun):|\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\bimport\s*\(/,
    );
    expect(source, output.path).not.toMatch(
      /\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis)\s*[.[]/,
    );
  }
});

test("src_is_host_api_free", async () => {
  const root = new URL("../", import.meta.url).pathname;
  const forbidden =
    /\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis)\s*[.[]/;
  const transpiler = new Bun.Transpiler({ loader: "tsx" });
  for await (const path of new Bun.Glob("**/*.{ts,tsx,js,jsx}").scan(root)) {
    if (path.split("/").includes("__tests__")) continue;
    // Only the CLI reads catalogs and writes generated modules; the SDK emitter remains host-free.
    if (path.startsWith("cli/")) continue;
    // The file-store subpath is the explicit filesystem exception in spec §13.
    if (path.startsWith("store/fs/")) continue;
    const source = await Bun.file(`${root}${path}`).text();
    expect(source, path).not.toMatch(forbidden);
    expect(source, path).not.toMatch(/\bimport\s*\(/);
    // Only the packer's syntax tools may be external; their browser bundle is checked below.
    for (const dependency of transpiler.scanImports(source)) {
      if (path === "pack/bundle.ts" && ["sucrase", "acorn"].includes(dependency.path)) continue;
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

test("pack_bundle_has_no_host_apis", async () => {
  const bundle = await Bun.build({
    entrypoints: [new URL("../pack/index.ts", import.meta.url).pathname],
    target: "browser",
    metafile: true,
  });
  expect(bundle.success).toBe(true);
  if (!bundle.metafile) throw new Error("Missing pack bundle metafile");
  for (const input of Object.keys(bundle.metafile.inputs)) {
    expect(input).not.toMatch(/node_modules\/(?:commander|tinyglobby|mz|pirates)\//);
  }
  expect(bundle.outputs).toHaveLength(1);
  const output = bundle.outputs[0];
  if (!output) throw new Error("Missing pack bundle output");
  let source = await output.text();
  // Exact pinned-dependency snippets: two Buffer paths (one guarded, one in an
  // unused type checker), plus text emitted by transforms we never enable.
  const knownSnippets = [
    "return Buffer.isBuffer(v);",
    'typeof Buffer !== "undefined" ? {\n  decode(buf) {\n    const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);',
    'this.tokens.appendCode("__reactstandin__regenerateByEval(key, code) {this[key] = eval(code);}");',
    'this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");',
    `prefix += \`var \${resolvedName} = require("\${path}");\`;`,
    `this.importsToReplace.set(path, \`require('\${path}');\`);`,
    `let requireCode = \`var \${primaryImportName} = require('\${path}');\`;`,
    "this.tokens.appendCode(' = require(\"flow-enums-runtime\")');",
    "var enterModule = require('react-hot-loader').enterModule;",
    "var reactHotLoader = require('react-hot-loader').default;",
    "var leaveModule = require('react-hot-loader').leaveModule;",
  ];
  for (const snippet of knownSnippets) {
    expect(source, snippet).toContain(snippet);
    source = source.replace(snippet, "");
  }
  expect(source).not.toMatch(
    // Match host specifiers without mistaking the JSON Schema's `node: {` property for an import.
    /\b(?:node|bun):[a-z]|\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\bimport\s*\(/,
  );
  expect(source).not.toMatch(
    /\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis)\s*[.[]/,
  );
});
