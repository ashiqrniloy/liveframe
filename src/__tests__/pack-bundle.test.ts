import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { render } from "@arnilo/liveframe/sdk";
import { compileValidator, type Result } from "../index.ts";
import { bundle } from "../pack/bundle.ts";
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

function code(result: Result<string>): string {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

async function load(files: Record<string, string>, entry = "entry.ts") {
  return loadCode(code(bundle({ files, entry })));
}

async function loadCode(source: string) {
  const directory = await mkdtemp(new URL("./.pack-bundle-", import.meta.url).pathname);
  try {
    const path = `${directory}/widget.mjs`;
    await Bun.write(path, source);
    return await import(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("bundles_composed_components", async () => {
  const root = new URL("./fixtures/widgets/", import.meta.url);
  const paths = [
    "ui.gen.ts",
    ...["queue", "task-card", "decision-card", "alert-card", "facts", "queue-row"].map(
      (name) => `agent-home/${name}.tsx`,
    ),
  ];
  const files = Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await Bun.file(new URL(path, root)).text()])),
  );
  files["agent-home/queue.tsx"] += "\nexport default AgentHomeQueue;";
  const start = performance.now();
  const source = code(bundle({ files, entry: "agent-home/queue.tsx" }));
  expect(performance.now() - start).toBeLessThan(100);
  const imports = new Bun.Transpiler({ loader: "js" }).scanImports(source);
  expect(imports.length).toBeGreaterThan(0);
  expect(imports.every((item) => /^@arnilo\/liveframe\/sdk(?:\/jsx(?:-dev)?-runtime)?$/.test(item.path))).toBe(true);
  expect(new Set(imports.map((item) => item.path)).size).toBe(imports.length);
  const linked = await loadCode(source);
  const fixture = proofWidgets[0];
  if (!fixture) throw new Error("Missing agent-home fixture");
  const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
  for (const scenario of fixture.scenarios) {
    const options = { validator, surfaceId: "bundle", revision: 0 };
    const actual = render(linked.default, scenario, options);
    const expected = render(fixture.widget, scenario, options);
    if (!actual.ok) throw new Error(JSON.stringify(actual.errors));
    if (!expected.ok) throw new Error(JSON.stringify(expected.errors));
    expect(actual.value).toEqual(expected.value);
  }
});

test("rejects_forbidden_imports", () => {
  for (const statement of [
    'import fs from "node:fs";',
    'export * from "lodash";',
    'export { x } from "lodash";',
    'function nested() { require("x"); }',
    "function nested() { return import.meta.url; }",
    'async function nested() { return await import("./x"); }',
    'const nested = () => require?.("x");',
    'import X = require("x");',
  ]) {
    const result = bundle({ files: { "entry.ts": `\n${statement}\nexport default () => 1;` }, entry: "entry.ts" });
    expect(result.ok, statement).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ kind: "forbidden-import", pointer: "/files/entry.ts/2" });
  }
});

test("rejects_unresolved_cycle_and_syntax", () => {
  for (const files of [
    {},
    { "entry.ts": 'import "./missing"; export default 1;' },
    { "entry.ts": 'import "./b"; export default 1;', "b.ts": 'import "./entry";' },
    { "entry.ts": "export const x = 1;" },
    { "entry.ts": "const __lf_private = 1; export default __lf_private;" },
  ]) {
    const result = bundle({ files, entry: "entry.ts" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.kind).toBe("invalid-document");
  }
  const cycle = bundle({
    files: { "a.ts": 'import "./b"; export default 1;', "b.ts": 'import "./a";' },
    entry: "a.ts",
  });
  if (!cycle.ok) expect(cycle.errors[0]?.message).toContain("a.ts → b.ts → a.ts");
  const syntax = bundle({ files: { "entry.ts": "\nexport default (" }, entry: "entry.ts" });
  expect(syntax.ok).toBe(false);
  if (!syntax.ok) {
    expect(syntax.errors[0]?.kind).toBe("transpile-failed");
    expect(syntax.errors[0]?.pointer).toMatch(/^\/files\/entry.ts\/\d+$/);
  }
});

test("bundle_is_deterministic_and_only_visits_reachable_files", () => {
  const files = {
    "entry.ts": 'import {x} from "./x"; export default x;',
    "x.ts": "export const x: number = 3;",
    "unused.ts": "invalid source!!!",
  };
  expect(bundle({ files, entry: "entry.ts" })).toEqual(
    bundle({ files: Object.fromEntries(Object.entries(files).reverse()), entry: "entry.ts" }),
  );
  expect(code(bundle({ files, entry: "entry.ts" }))).not.toContain("invalid source");
});

test("bundle_never_executes", () => {
  const source = 'globalThis.__lfRan = true; throw new Error("executed"); export default () => 1;';
  expect(bundle({ files: { "entry.ts": source }, entry: "entry.ts" }).ok).toBe(true);
  expect("__lfRan" in globalThis).toBe(false);
});

test("links_import_export_forms_and_isolates_module_scopes", async () => {
  const linked = await load({
    "entry.ts": `import value, { renamed, other, fn, klass, nested } from "./barrel";
      import * as ns from "./values";
      const x = 99;
      export default () => [value, renamed, other, fn(), new klass().value, nested.deep, ns.x, x];`,
    "barrel/index.ts": `export { default, x as renamed, fn, klass, nested } from "../values"; export * from "../other";`,
    "values.ts": `const x = 3; export { x }; export default 7;
      export function fn() { return x; } export class klass { value = 5; }
      export const { a: nested } = { a: { deep: 8 } };`,
    "other/index.tsx": "export const other = 4; export default 100;",
  });
  expect(linked.default()).toEqual([7, 3, 4, 3, 5, 8, 3, 99]);
});

test("resolves_relative_paths_in_order_and_does_not_escape_files", async () => {
  const linked = await load({
    "entry.ts": 'import a from "./a"; import b from "./b"; import c from "./c"; export default [a,b,c];',
    a: "export default 1;",
    "a.tsx": "export default 2;",
    "b.tsx": "export default 3;",
    "b.ts": "export default 4;",
    "c/index.tsx": "export default 5;",
  });
  expect(linked.default).toEqual([1, 3, 5]);
  expect(bundle({ files: { "entry.ts": 'import "../outside"; export default 1;' }, entry: "entry.ts" }).ok).toBe(false);
});

test("supports_default_declarations_namespace_reexports_and_sdk_reexports", async () => {
  const linked = await load({
    "entry.ts":
      'import get, { helpers, sdk } from "./barrel"; export default [get(), helpers.default(), sdk.action("test")];',
    "barrel.ts":
      'export { default } from "./value"; export * as helpers from "./value"; export * as sdk from "@arnilo/liveframe/sdk";',
    "value.ts": "export default function value() { return 3; }",
  });
  expect(linked.default).toEqual([3, 3, { type: "action", name: "test", args: {} }]);
});

test("preserves_top_level_await_and_module_hashbangs", async () => {
  const linked = await load({
    "entry.ts": '#!/usr/bin/env bun\nimport value from "./async"; export default () => value;',
    "async.ts": "export default await Promise.resolve(3);",
  });
  expect(linked.default()).toBe(3);
});
