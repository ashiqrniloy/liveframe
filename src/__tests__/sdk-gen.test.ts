import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCatalog } from "../formats/catalog.ts";
import { generate } from "../sdk/gen.ts";
import proof from "./fixtures/proof/catalog.json" with { type: "json" };

const catalog = validateCatalog(proof);
if (!catalog.ok) throw new Error(JSON.stringify(catalog.errors));
const fixture = "src/__tests__/fixtures/widgets/ui.gen.ts";
const cli = "src/cli/liveframe.ts";
const input = "src/__tests__/fixtures/proof/catalog.json";

async function run(args: string[]) {
  const child = Bun.spawn([process.execPath, cli, ...args], { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => child.kill(), 10_000);
  try {
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    return { code, stderr };
  } finally {
    clearTimeout(timer);
  }
}

test("gen_is_deterministic_and_formatted", async () => {
  const output = generate(catalog.value);
  expect(generate(catalog.value)).toBe(output);
  expect(output).toBe(await Bun.file(fixture).text());
  const child = Bun.spawn([process.execPath, "x", "--no-install", "biome", "format", fixture], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => child.kill(), 10_000);
  try {
    expect(await child.exited).toBe(0);
  } finally {
    clearTimeout(timer);
  }
});

test("gen_check_detects_drift", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-gen-"));
  const out = join(dir, "ui.gen.ts");
  try {
    expect((await run(["gen", input, "--out", out])).code).toBe(0);
    expect(await Bun.file(out).text()).toBe(generate(catalog.value));
    expect((await run(["gen", input, "--out", out, "--check"])).code).toBe(0);
    const edited = `${await Bun.file(out).text()}// drift\n`;
    await Bun.write(out, edited);
    const drift = await run(["gen", input, "--out", out, "--check"]);
    expect(drift.code).toBe(1);
    expect(drift.stderr).toContain("line");
    expect(await Bun.file(out).text()).toBe(edited);
    const missing = join(dir, "missing.ts");
    expect((await run(["gen", input, "--out", missing, "--check"])).code).toBe(1);
    expect(await Bun.file(missing).exists()).toBe(false);
    expect((await run(["gen", input, "--out", fixture, "--check"])).code).toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("gen_rejects_malformed_catalog", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-gen-"));
  try {
    const bad = join(dir, "bad.json");
    const out = join(dir, "ui.ts");
    await Bun.write(bad, JSON.stringify({ ...proof, catalogId: 1 }));
    const result = await run(["gen", bad, "--out", out]);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stderr)).toContainEqual(expect.objectContaining({ pointer: "/catalogId" }));
    expect(await Bun.file(out).exists()).toBe(false);
    await Bun.write(bad, "{");
    expect((await run(["gen", bad, "--out", out])).code).toBe(2);
    expect((await run(["gen", input])).code).toBe(2);
    expect((await run(["gen", input, "--out", out, "--unknown"])).code).toBe(2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("gen_escapes_docs_and_property_names_and_rejects_collisions", () => {
  const definition = catalog.value.definitions[0];
  if (!definition) throw new Error("fixture");
  const custom = {
    ...definition,
    kind: "custom-kind",
    description: "Close */ safely\nwith documentation",
    props: {
      type: "object" as const,
      properties: {
        "odd-name": { type: "array" as const, maxItems: 3, items: { type: "number" as const } },
        nested: { type: "object" as const, properties: {}, required: [], additionalProperties: false as const },
        choice: { type: "string" as const, maxLength: 200, enum: ['quotes " and | pipes '.repeat(6), "short"] },
      },
      required: ["odd-name"],
      additionalProperties: false as const,
    },
  };
  const output = generate({ ...catalog.value, definitions: [custom] });
  expect(output).toContain("export const CustomKind");
  expect(output).toContain('readonly "odd-name": ReadonlyArray<number>');
  expect(output).toContain("Close * / safely");
  expect(output).toContain(JSON.stringify(custom.props.properties.choice.enum[0]));
  expect(() => new Bun.Transpiler({ loader: "ts" }).transformSync(output)).not.toThrow();
  expect(() =>
    generate({
      ...catalog.value,
      definitions: [
        { ...custom, props: { ...custom.props, properties: { variant: { type: "boolean" } }, required: [] } },
      ],
    }),
  ).toThrow(/collision/i);
  expect(() => generate({ ...catalog.value, definitions: [custom, { ...custom, kind: "customKind" }] })).toThrow(
    /collision/i,
  );
});
