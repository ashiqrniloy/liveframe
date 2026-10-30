import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { render } from "@arnilo/liveframe/sdk";
import { assertSelfContained } from "../../scripts/release/bundle-check.ts";
import { validateJson } from "../formats/json.ts";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { pack } from "../pack/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const root = new URL("../../", import.meta.url).pathname;
const bundle = join(root, "dist/runner-kit.bundle.js");
const options = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
  surfaceId: "bundle",
  revision: 1,
};

test("bundle_is_self_contained", async () => {
  assertSelfContained(await Bun.file(bundle).text());
  for (const code of [
    'import x from "./y.js"; export default x;',
    'import "bare";',
    "export default import('x');",
    "export default import.meta.url;",
    'export * from "./y.js";',
    'export default "node:fs";',
  ])
    expect(() => assertSelfContained(code), code).toThrow("not self-contained");
});

test("validate_json_names_foreign_realm", () => {
  const foreign = runInNewContext("({ nested: { value: 1 } })");
  const message =
    "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)";
  expect(validateJson(foreign)).toEqual({
    ok: false,
    errors: [{ kind: "invalid-document", pointer: "", message }],
  });
  expect(validateJson({ nested: foreign })).toEqual({
    ok: false,
    errors: [{ kind: "invalid-document", pointer: "/nested", message }],
  });
  class Example {}
  for (const input of [new Example(), runInNewContext("new (class Example {})()"), new Date(), NaN]) {
    expect(validateJson(input)).toEqual({
      ok: false,
      errors: [
        {
          kind: "invalid-document",
          pointer: "",
          message: "Expected a JSON value without cycles or non-finite numbers",
        },
      ],
    });
  }
  for (const input of [{ value: 1 }, Object.create(null), JSON.parse(JSON.stringify(foreign))]) {
    expect(validateJson(input)).toEqual({ ok: true, value: input });
  }
});

test.each([
  ["bundle_renders_under_node_vm", "inner"],
  ["bundle_reports_outer_realm_manifest", "outer"],
])("%s", async (_name, realm) => {
  const node = Bun.which("node");
  if (!node) return console.log("skipped: node is not on PATH");
  const fixture = proofWidgets[0];
  const draft = drafts[0];
  const scenario = fixture?.scenarios[0];
  if (!fixture || !draft || !scenario) throw new Error("Missing agent-home fixture");
  const packed = value(pack(draft, options));
  const expected = render(fixture.widget, scenario, {
    ...options,
    validator: compileValidator({ ...options, manifest: packed.manifest }),
  });
  expect(expected.ok).toBe(true);

  const dir = await mkdtemp(join(tmpdir(), "liveframe-bundle-"));
  try {
    const request = join(dir, "request.json");
    await writeFile(
      request,
      JSON.stringify({ ...options, code: packed.code, manifest: packed.manifest, inputs: scenario }),
    );
    const proc = Bun.spawnSync(
      [
        node,
        "--experimental-vm-modules",
        "--no-warnings",
        join(root, "scripts/release/fixtures/vm-bundle.mjs"),
        bundle,
        request,
        realm,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = proc.stdout.toString().trim();
    if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
    const version = Bun.spawnSync([node, "-p", "process.version"]).stdout.toString().trim();
    if (output === "unsupported") return console.log(`skipped: node ${version} has no vm linkRequests()`);
    console.log(`runner kit bundle rendered under node ${version}`);
    const ran = JSON.parse(output);
    expect(ran.globals).toEqual({ bun: "undefined", process: "undefined", require: "undefined" });
    if (realm === "inner") expect(ran.result).toEqual(JSON.parse(JSON.stringify(expected)));
    else
      expect(ran.result).toEqual({
        ok: false,
        errors: [
          {
            kind: "invalid-document",
            pointer: "/manifest",
            message:
              "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)",
          },
        ],
      });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
