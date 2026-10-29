import { expect, test } from "bun:test";

// Per-subpath exceptions from spec §13 and plan 006 Tasks 4, 7–9.
// Store reaches the packer through loadPlacement → verifyPackage.
const subpaths = [
  { path: "preview/capture", dependencies: false, loader: false, host: "none" },
  { path: "conformance/react", dependencies: false, loader: false, host: "DOM" },
  { path: "conformance", dependencies: true, loader: false, host: "none" },
  { path: "pack", dependencies: true, loader: false, host: "none" },
  { path: "store", dependencies: true, loader: false, host: "none" },
  { path: "store/fs", dependencies: false, loader: false, host: "filesystem" },
  { path: "preview", dependencies: true, loader: true, host: "none" },
  { path: "preview/worker", dependencies: false, loader: true, host: "Worker/self" },
  { path: "preview/react", dependencies: false, loader: false, host: "DOM" },
  { path: "react", dependencies: false, loader: false, host: "DOM" },
] as const;

test("sdk_bundles_for_browser_without_host_apis", async () => {
  const bundle = await Bun.build({
    entrypoints: ["../sdk/index.ts", "../sdk/gen.ts", "../sdk/jsx-runtime.ts", "../sdk/jsx-dev-runtime.ts"].map(
      (path) => new URL(path, import.meta.url).pathname,
    ),
    target: "browser",
  });
  expect(bundle.success).toBe(true);
  expect(bundle.outputs).toHaveLength(4);
  for (const output of bundle.outputs) {
    const source = await output.text();
    expect(source, output.path).not.toMatch(
      /\b(?:node|bun):|\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\bimport\s*\(/,
    );
    expect(source, output.path).not.toMatch(
      /\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis|self)\s*[.[]/,
    );
  }
});

test("css_bundles_for_browser_without_host_apis", async () => {
  const bundle = await Bun.build({
    entrypoints: [new URL("../css/index.ts", import.meta.url).pathname],
    target: "browser",
  });
  expect(bundle.success).toBe(true);
  expect(bundle.outputs).toHaveLength(1);
  for (const output of bundle.outputs) {
    const source = await output.text();
    expect(source, output.path).not.toMatch(
      /\b(?:node|bun):|\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\bimport\s*\(/,
    );
    expect(source, output.path).not.toMatch(
      /\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis|self)\s*[.[]/,
    );
  }
});

async function scanHostApiFree(root: string): Promise<void> {
  const forbidden =
    /\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis|self)\s*[.[]/;
  const transpiler = new Bun.Transpiler({ loader: "tsx" });
  for await (const path of new Bun.Glob("**/*.{ts,tsx,js,jsx}").scan(root)) {
    if (path.split("/").includes("__tests__")) continue;
    // Declarations hold types only, including `import("...")` type references.
    if (path.endsWith(".d.ts")) continue;
    // Only the CLI reads catalogs and writes generated modules; the SDK emitter remains host-free.
    if (path.startsWith("cli/")) continue;
    // The file-store subpath is the explicit filesystem exception in spec §13.
    const subpath = subpaths.find((entry) => path.startsWith(`${entry.path}/`) && entry.host !== "none");
    if (subpath?.host === "filesystem") continue;
    // The backend worker subpath is the explicit Worker/self exception in spec §13.
    const workerSubpath = subpath?.host === "Worker/self";
    const source = await Bun.file(`${root}${path}`).text();
    // Relative specifiers such as "./in-process.ts" are not process member access.
    const executable = source.replace(/\bfrom\s+(["'])\.\.?\/[^"'\n]+\1/g, 'from ""');
    const checked = workerSubpath
      ? executable.replace(/\b(?:Worker|self)\b/g, "workerScope")
      : subpath?.host === "DOM"
        ? executable.replace(/\b(?:document|window|navigator|localStorage|sessionStorage)\b/g, "domScope")
        : executable;
    expect(checked, path).not.toMatch(forbidden);
    // Spec §7.5 permits dynamic imports only in the backend package loader.
    if (!path.startsWith("preview/load.")) expect(source, path).not.toMatch(/\bimport\s*\(/);
    // Only the packer's syntax tools may be external; their browser bundle is checked below.
    for (const dependency of transpiler.scanImports(source)) {
      if (
        subpath?.host === "DOM" &&
        [
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/client",
          "react-dom/server",
        ].includes(dependency.path)
      )
        continue;
      if (path.startsWith("pack/bundle.") && ["sucrase", "acorn"].includes(dependency.path)) continue;
      expect(dependency.path, path).toMatch(/^\.\.?\//);
      expect(dependency.path, path).not.toContain("proof/");
    }
  }
}

test("src_is_host_api_free", async () => {
  await scanHostApiFree(new URL("../", import.meta.url).pathname);
  const bundle = await Bun.build({
    entrypoints: [new URL("../index.ts", import.meta.url).pathname],
    target: "browser",
  });
  expect(bundle.success).toBe(true);
});

test("compiled_output_is_host_api_free", async () => {
  const root = new URL("../../dist/", import.meta.url).pathname;
  if (!(await Bun.file(`${root}index.js`).exists())) throw new Error("dist/ is missing: run `bun run build`");
  await scanHostApiFree(root);
});

test.each(subpaths.filter(({ host }) => host === "none"))(
  "host_api_free_subpaths_bundle_clean: $path",
  async ({ path, dependencies, loader }) => {
    const bundle = await Bun.build({
      entrypoints: [new URL(`../${path}/index.ts`, import.meta.url).pathname],
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
    for (const snippet of dependencies ? knownSnippets : []) {
      // Verification tree-shakes the source-map codec used only during packing.
      if (path === "store" && ![knownSnippets[0], knownSnippets[3]].includes(snippet)) continue;
      expect(source.includes(snippet), snippet).toBe(true);
      source = source.replace(snippet, "");
    }
    if (loader) {
      // Exactly one dynamic import, in the approved backend loader; never called in this browser scan.
      const dynamicImport = 'import(`data:text/javascript,${encodeURIComponent(rewritten).replaceAll(".", "%2E")}`)';
      expect(source.split(dynamicImport)).toHaveLength(2);
      source = source.replace(dynamicImport, "");
    }
    // Relative filenames in bundle comments are not process member access.
    source = source.replace(/^\/\/ .*$/gm, "");
    expect(
      source.match(
        // Match host specifiers without mistaking the JSON Schema's `node: {` property for an import.
        /\b(?:node|bun):[a-z]|\b(?:require|eval|Function|Worker|fetch|XMLHttpRequest)\s*\(|\bimport\s*\(/,
      ),
    ).toBeNull();
    expect(
      source.match(
        /\b(?:document|window|process|Bun|Buffer|navigator|localStorage|sessionStorage|globalThis|self)\s*[.[]/,
      ),
    ).toBeNull();
  },
);
