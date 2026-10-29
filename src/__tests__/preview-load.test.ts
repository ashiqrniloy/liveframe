import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as sdk from "@arnilo/liveframe/sdk";
import * as jsxRuntime from "@arnilo/liveframe/sdk/jsx-runtime";
import * as jsxDevRuntime from "@arnilo/liveframe/sdk/jsx-dev-runtime";
import { compileValidator } from "../index.ts";
import { bundle } from "../pack/bundle.ts";
import { loadModule } from "../preview/load.ts";
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

test("loader_escapes_dots", async () => {
  const module = await loadModule("const x = { value: 3 }; export default () => x.value;", "loader-dots");
  expect(typeof module.default).toBe("function");
  if (typeof module.default !== "function") throw new Error("Expected a function default export");
  expect(module.default()).toBe(3);
});

test("loader_shares_sdk_instance", async () => {
  const module = await loadModule(
    `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
import * as __lf_sdk1 from "@arnilo/liveframe/sdk/jsx-runtime";
import * as __lf_sdk2 from "@arnilo/liveframe/sdk/jsx-dev-runtime";
export default [__lf_sdk0, __lf_sdk1, __lf_sdk2];`,
    "loader-sdk-instance",
  );
  if (!Array.isArray(module.default)) throw new Error("Expected SDK namespaces");
  expect(module.default[0]).toBe(sdk);
  expect(module.default[1]).toBe(jsxRuntime);
  expect(module.default[2]).toBe(jsxDevRuntime);
});

test("loader_rewrites_only_canonical_header", async () => {
  const text = 'import * as __lf_sdk9 from "@arnilo/liveframe/sdk";';
  const module = await loadModule(
    `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
const specifier = "@arnilo/liveframe/sdk";
const text = \`
${text}
\`;
export default [specifier, text, __lf_sdk0.render];`,
    "loader-header-only",
  );
  expect(module.default).toEqual(["@arnilo/liveframe/sdk", `\n${text}\n`, sdk.render]);
});

test("loader_caches_by_hash_including_in_flight_loads", async () => {
  const code = "await Promise.resolve(); export default {};";
  const first = loadModule(code, "loader-cache");
  const second = loadModule(code, "loader-cache");
  expect(second).toBe(first);
  const module = await first;
  expect(await second).toBe(module);
  // A hash identifies immutable content; the loader trusts the caller's verification.
  expect(await loadModule("throw new Error('must not reload');", "loader-cache")).toBe(module);
  const other = await loadModule("export default 'another package';", "loader-other-hash");
  expect(other.default).toBe("another package");
});

test("loader_resolves_sdk_from_other_cwd", async () => {
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
  const linked = bundle({ files, entry: "agent-home/queue.tsx" });
  if (!linked.ok) throw new Error(JSON.stringify(linked.errors));
  const fixture = proofWidgets[0];
  if (!fixture) throw new Error("Missing agent-home fixture");
  const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
  const expected = fixture.scenarios.map((inputs) =>
    sdk.render(fixture.widget, inputs, { validator, surfaceId: "loader", revision: 0 }),
  );
  expect(expected.every((result) => result.ok)).toBe(true);
  const directory = await mkdtemp(join(tmpdir(), "liveframe-preview-load-"));
  try {
    const script = join(directory, "probe.ts");
    await Bun.write(
      script,
      `import { loadModule } from ${JSON.stringify(new URL("../preview/load.ts", import.meta.url).href)};
import { compileValidator } from ${JSON.stringify(new URL("../index.ts", import.meta.url).href)};
import { render } from ${JSON.stringify(new URL("../sdk/index.ts", import.meta.url).href)};
const module = await loadModule(${JSON.stringify(linked.value)}, "loader-outside-agent-home");
if (typeof module.default !== "function") throw new Error("Expected a function default export");
const validator = compileValidator(${JSON.stringify({ catalog, capabilities, manifest: fixture.manifest })});
const results = ${JSON.stringify(fixture.scenarios)}.map(inputs =>
  render(module.default, inputs, { validator, surfaceId: "loader", revision: 0 }));
console.log(JSON.stringify(results));
`,
    );
    const child = Bun.spawn(["timeout", "10s", process.execPath, "--conditions", "liveframe:source", script], {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exitCode, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual(expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);

test("loader_leaves_noncanonical_sdk_imports_bare", async () => {
  const directory = await mkdtemp(join(tmpdir(), "liveframe-preview-load-bare-"));
  try {
    const script = join(directory, "probe.ts");
    await Bun.write(
      script,
      `import { loadModule } from ${JSON.stringify(new URL("../preview/load.ts", import.meta.url).href)};
await loadModule('import { render } from "@arnilo/liveframe/sdk"; export default render;', "loader-bare-outside");`,
    );
    // Bun's auto-install would otherwise fetch the published package and resolve the bare specifier.
    const child = Bun.spawn(
      ["timeout", "10s", process.execPath, "--no-install", "--conditions", "liveframe:source", script],
      {
        cwd: directory,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toMatch(/Cannot find (?:module|package) '@arnilo\/liveframe(?:\/sdk)?'/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
