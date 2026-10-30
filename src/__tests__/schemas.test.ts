import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { formats, schemaDocument } from "../formats/registry.ts";
import { arr, bool, int, isLanguageSchema, num, obj, str, validateCapabilities, validateCatalog } from "../index.ts";
import { catalog as numericCatalog } from "./fixtures/numeric-events.ts";
import * as form from "./fixtures/object-events.ts";

const ajv = new Ajv2020({ strict: true, unicodeRegExp: true });

ajv.addFormat("regex", {
  type: "string",
  validate: (pattern: string) => {
    try {
      new RegExp(pattern, "u");
      return true;
    } catch {
      return false;
    }
  },
});

test("published_schemas_match_sources", async () => {
  const files = await Array.fromAsync(new Bun.Glob("*.json").scan(new URL("../../schemas/", import.meta.url).pathname));
  expect(files.sort()).toEqual(
    Object.keys(formats)
      .map((name) => `${name}.json`)
      .sort(),
  );
  for (const name of Object.keys(formats) as (keyof typeof formats)[]) {
    const published = await Bun.file(new URL(`../../schemas/${name}.json`, import.meta.url)).text();
    expect(published).toBe(`${JSON.stringify(schemaDocument(name), null, 2)}\n`);
    expect(() => ajv.compile(JSON.parse(published))).not.toThrow();
  }
});

test("irreversible_in_capabilities_schema", () => {
  const validate = ajv.getSchema("urn:liveframe:capabilities:1") ?? ajv.compile(schemaDocument("capabilities"));
  for (const irreversible of [true, false, "true", 1, null]) {
    const doc = {
      format: "liveframe-capabilities/1",
      actions: { remove: { description: "Remove", args: obj({}), irreversible } },
      sources: {},
    };
    const valid = typeof irreversible === "boolean";
    expect(validate(doc)).toBe(valid);
    const checked = validateCapabilities(doc);
    expect(checked.ok).toBe(valid);
    if (!checked.ok) expect(checked.errors[0]?.pointer).toBe("/actions/remove/irreversible");
  }
});

test("published_catalog_schema_accepts_numeric_events", () => {
  const validate = ajv.getSchema("urn:liveframe:catalog:1") ?? ajv.compile(schemaDocument("catalog"));
  expect(validate(numericCatalog)).toBe(true);
  expect(validateCatalog(numericCatalog).ok).toBe(true);
});

test("published_schemas_accept_object_events_and_bind_all", () => {
  const validate = ajv.getSchema("urn:liveframe:catalog:1") ?? ajv.compile(schemaDocument("catalog"));
  expect(validate(form.catalog)).toBe(true);
  for (const object of [
    { ...form.fields, nullable: true },
    { ...form.fields, additionalProperties: true },
    obj({ nested: obj({}) }),
    obj(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`p${i}`, bool()]))),
  ]) {
    const catalog = structuredClone(form.catalog);
    const definition = catalog.definitions.find((d) => d.kind === "stack");
    Object.assign(definition ?? {}, { events: { onSubmit: { carries: { object }, description: "Submit." } } });
    expect(validate(catalog)).toBe(false);
    expect(validateCatalog(catalog).ok).toBe(false);
  }
  const tree = ajv.getSchema("urn:liveframe:ui-tree:1") ?? ajv.compile(schemaDocument("ui-tree"));
  expect(tree(form.formTree())).toBe(true);
  for (const event of [
    { type: "action", name: "form.submit", args: {}, bindAll: false },
    { type: "action", name: "form.submit", args: {}, bindAll: true, bind: "reason" },
  ])
    expect(tree(form.formTree(event as import("../index.ts").Intent))).toBe(false);
});

test("schema_ids_are_format_urns", async () => {
  for (const name of Object.keys(formats) as (keyof typeof formats)[]) {
    const doc = schemaDocument(name);
    // A format-versioned URN: no domain can be redirected, and Ajv resolves it by id alone.
    expect(doc.$id).toBe(`urn:liveframe:${name}:1`);
    const published = await Bun.file(new URL(`../../schemas/${name}.json`, import.meta.url)).text();
    // Every cross-document reference in the published bytes names a format id.
    for (const [, target] of published.matchAll(/\$ref": "(?!#)([^"]+)"/g)) expect(target).toMatch(/^urn:liveframe:/);
  }
});

test("package_schema_resolves_manifest_by_urn_offline", async () => {
  // No `loadSchema` and no fetch: compiling with every schema added is the only way to resolve ids.
  const validator = new Ajv2020({ strict: true, unicodeRegExp: true });
  for (const name of Object.keys(formats) as (keyof typeof formats)[]) validator.addSchema(schemaDocument(name));
  const validate = validator.getSchema("urn:liveframe:widget-package:1");
  if (!validate) throw new Error("widget-package schema was not registered");
  expect(validator.getSchema("urn:liveframe:manifest:1")).toBeDefined();
  const manifest = JSON.parse(
    await Bun.file(new URL("../__tests__/fixtures/proof/agent-home.manifest.json", import.meta.url)).text(),
  );
  const pkg = {
    format: "liveframe-package/1",
    manifest,
    code: "export default () => null;",
    scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
    hash: `sha256-${"0".repeat(64)}`,
  };
  expect(validate(pkg)).toBe(true);
  // The reference is live: a manifest that fails its own schema fails the package too.
  expect(validate({ ...pkg, manifest: { ...manifest, id: 1 } })).toBe(false);
  expect(validate.errors?.[0]?.instancePath).toBe("/manifest/id");
});

test("meta_schema_agrees_with_language_forms", () => {
  const validate =
    ajv.getSchema(schemaDocument("schema-language").$id) ?? ajv.compile(schemaDocument("schema-language"));
  for (const schema of [
    str({ maxLength: 3, pattern: "^.$", enum: ["a", "👍"] }),
    str({ minLength: 1, maxLength: 3 }),
    arr(str({ minLength: 0, maxLength: 3 }), { minItems: 1, maxItems: 2 }),
    { type: "string", minLength: -1, maxLength: 3 },
    { type: "string", minLength: 0.5, maxLength: 3 },
    { type: "array", items: bool(), minItems: "1", maxItems: 2 },
    num({ minimum: -1 }),
    int(),
    bool(),
    arr(bool(), { maxItems: 2 }),
    obj({ id: str({ maxLength: 8 }) }, { active: bool() }),
    { type: "string" },
    { type: "array", items: { type: "boolean" } },
    { type: "string", maxLength: 1, pattern: "[" },
    { type: "string", maxLength: 1, pattern: "a".repeat(257) },
    { type: "string", maxLength: 1, enum: [1] },
    { type: "boolean", $ref: "no" },
    { type: "object", properties: {}, required: [], additionalProperties: true },
    { const: "internal" },
    { type: "string", maxLength: 1, enum: ["a", "a"] },
    { type: "array", maxItems: 1, items: { type: "string" } },
  ])
    expect(validate(schema)).toBe(isLanguageSchema(schema));
});

test("schema_publisher_check_passes", async () => {
  const process = Bun.spawn(["timeout", "20s", "bun", "scripts/schemas.ts", "--check"], {
    cwd: new URL("../../", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await process.exited).toBe(0);
});

test("schema_publisher_detects_drift", async () => {
  const directory = await mkdtemp(join(tmpdir(), "liveframe-schemas-"));
  try {
    for (const path of [
      "scripts/schemas.ts",
      "src/formats/registry.ts",
      "src/formats/package.ts",
      "src/formats/records.ts",
      "src/formats/json.ts",
      "src/formats/tree.ts",
      "src/formats/tree-patch.ts",
      "src/formats/catalog.ts",
      "src/formats/events.ts",
      "src/formats/capabilities.ts",
      "src/formats/manifest.ts",
      "src/formats/theme.ts",
      "src/formats/contrast.ts",
      "src/formats/dtcg.ts",
      "src/formats/design-system.ts",
      "src/resolve.ts",
      "src/formats/vocabulary.ts",
      "src/formats/fixed.ts",
      "src/schema.ts",
      "src/errors.ts",
      "src/validate/bytes.ts",
    ]) {
      await Bun.write(join(directory, path), Bun.file(new URL(`../../${path}`, import.meta.url)));
    }
    const run = async (...args: string[]) => {
      const child = Bun.spawn(["timeout", "20s", "bun", join(directory, "scripts/schemas.ts"), ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
      return { status: await child.exited, error: await new Response(child.stderr).text() };
    };
    expect((await run()).status).toBe(0);
    await Bun.write(join(directory, "schemas/schema-language.json"), "{}\n");
    const drift = await run("--check");
    expect(drift.status).toBe(1);
    expect(drift.error).toContain("Schema drift: schemas/schema-language.json");
    expect((await run()).status).toBe(0);
    await Bun.write(join(directory, "schemas/unregistered.json"), "{}\n");
    const extra = await run("--check");
    expect(extra.status).toBe(1);
    expect(extra.error).toContain("Unregistered schema: schemas/unregistered.json");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
