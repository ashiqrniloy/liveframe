#!/usr/bin/env bun
import { validateCatalog } from "../formats/catalog.ts";
import { generate } from "../sdk/gen.ts";

const captureUsage =
  "Usage: liveframe preview capture <url> --out <dir> [--scenario <a,b>] [--width <n,m>] [--theme <id@v,…>] [--design-system <id@v,…>]";

async function previewCapture(args: string[]): Promise<number> {
  const [url, ...flags] = args;
  const values = new Map<string, string>();
  for (let i = 0; i < flags.length; i += 2) {
    const name = flags[i];
    const value = flags[i + 1];
    if (
      !["--out", "--scenario", "--width", "--theme", "--design-system"].includes(name ?? "") ||
      values.has(name ?? "")
    )
      throw new Error(captureUsage);
    if (!value || value.startsWith("--")) throw new Error(captureUsage);
    values.set(name as string, value);
  }
  const out = values.get("--out");
  if (!url || !out || !URL.canParse(url)) throw new Error(captureUsage);
  const list = (name: string) => values.get(name)?.split(",");
  const widths = list("--width")?.map(Number);
  if (widths?.some((width) => !Number.isInteger(width) || width <= 0)) throw new Error(captureUsage);
  try {
    const { capture } = await import("./capture.ts");
    const index = await capture(url, {
      out,
      scenarios: list("--scenario"),
      widths,
      themes: list("--theme"),
      designSystems: list("--design-system"),
    });
    const failed = index.cells.filter((cell) => cell.errors.length > 0);
    for (const cell of failed) console.error(`${cell.png}: ${cell.errors.length} render error(s)`);
    return failed.length > 0 ? 1 : 0;
  } catch (error) {
    if (error instanceof Error && error.name === "PlaywrightMissing") {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

async function main(args: string[]): Promise<number> {
  if (args[0] === "preview" && args[1] === "capture") return previewCapture(args.slice(2));
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
