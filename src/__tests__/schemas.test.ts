import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { formats, schemaDocument } from "../formats/registry.ts";
import { arr, bool, int, isLanguageSchema, num, obj, str } from "../index.ts";

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

test("meta_schema_agrees_with_language_forms", () => {
  const validate =
    ajv.getSchema(schemaDocument("schema-language").$id) ?? ajv.compile(schemaDocument("schema-language"));
  for (const schema of [
    str({ maxLength: 3, pattern: "^.$", enum: ["a", "👍"] }),
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
      "src/formats/catalog.ts",
      "src/formats/capabilities.ts",
      "src/formats/manifest.ts",
      "src/formats/vocabulary.ts",
      "src/formats/fixed.ts",
      "src/schema.ts",
      "src/errors.ts",
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
