#!/usr/bin/env bun
import { validateCatalog } from "../formats/catalog.ts";
import { generate } from "../sdk/gen.ts";

async function main(args: string[]): Promise<number> {
  const [command, catalogPath, ...flags] = args;
  let out: string | undefined;
  let check = false;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === "--out" && !out && flags[i + 1] && !flags[i + 1]?.startsWith("--")) out = flags[++i];
    else if (flags[i] === "--check" && !check) check = true;
    else throw new Error("Usage: liveframe gen <catalog.json> --out <file> [--check]");
  }
  if (command !== "gen" || !catalogPath || !out)
    throw new Error("Usage: liveframe gen <catalog.json> --out <file> [--check]");
  const catalog = validateCatalog(await Bun.file(catalogPath).json());
  if (!catalog.ok) {
    console.error(JSON.stringify(catalog.errors, null, 2));
    return 2;
  }
  const expected = generate(catalog.value);
  if (check) {
    const file = Bun.file(out);
    if (!(await file.exists())) {
      console.error(`Generated output missing: ${out}`);
      return 1;
    }
    const actual = await file.text();
    if (actual === expected) return 0;
    const before = actual.split("\n");
    const after = expected.split("\n");
    const line =
      Array.from({ length: Math.max(before.length, after.length) }, (_, i) => i).find((i) => before[i] !== after[i]) ??
      0;
    console.error(
      `Generated output drift: ${out}, first difference at line ${line + 1}\n- ${before[line] ?? "<end>"}\n+ ${after[line] ?? "<end>"}`,
    );
    return 1;
  }
  await Bun.write(out, expected);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(
    JSON.stringify(
      [{ kind: "invalid-document", pointer: "", message: error instanceof Error ? error.message : String(error) }],
      null,
      2,
    ),
  );
  process.exitCode = 2;
}
