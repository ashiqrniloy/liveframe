#!/usr/bin/env bun
import { LiveframeFailure } from "../errors.ts";
import { validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { validateLocal, validateManifest } from "../formats/manifest.ts";
import { errorMessage } from "../internal.ts";
import { checkPackages, type PackageCheck } from "../pack/check.ts";
import { templateRunner } from "../preview/template.ts";
import {
  generate,
  generateDefinitions,
  generateDigest,
  generateElementsSchema,
  generateTemplateSchema,
} from "../sdk/gen.ts";
import { CaptureError } from "./capture.ts";

const captureUsage =
  "Usage: liveframe preview capture <url> --out <dir> [--scenario <a,b>] [--width <n,m>] [--theme <id@v,…>] [--design-system <id@v,…>] [--layout] [--text-scale <n,m>] [--forced-colors <none,active>] [--reduced-motion <no-preference,reduce>]";

/** `--name value` pairs and the bare `--layout` flag; anything repeated or unknown is a usage error. */
function captureFlags(flags: string[]): { values: Map<string, string>; layout: boolean } {
  const valued = [
    "--out",
    "--scenario",
    "--width",
    "--theme",
    "--design-system",
    "--text-scale",
    "--forced-colors",
    "--reduced-motion",
  ];
  const values = new Map<string, string>();
  let layout = false;
  for (let i = 0; i < flags.length; i += 2) {
    const name = flags[i];
    if (name === "--layout" && !layout) {
      layout = true;
      i--;
      continue;
    }
    const value = flags[i + 1];
    if (!valued.includes(name ?? "") || values.has(name ?? "")) throw new Error(captureUsage);
    if (!value || value.startsWith("--")) throw new Error(captureUsage);
    values.set(name as string, value);
  }
  return { values, layout };
}

/** The media axes named on the command line, validated against their declared values. */
function captureMedia(list: (name: string) => string[] | undefined) {
  const forced = ["none", "active"];
  const motion = ["no-preference", "reduce"];
  const oneOf = <T extends string>(name: string, declared: readonly T[]): readonly T[] | undefined => {
    const values = list(name) as T[] | undefined;
    if (values && !values.every((value) => declared.includes(value))) throw new Error(captureUsage);
    return values;
  };
  const textScale = list("--text-scale")?.map(Number);
  if (textScale?.some((scale) => !Number.isFinite(scale) || scale <= 0)) throw new Error(captureUsage);
  const forcedColors = oneOf("--forced-colors", forced as readonly ("none" | "active")[]);
  const reducedMotion = oneOf("--reduced-motion", motion as readonly ("no-preference" | "reduce")[]);
  return {
    ...(textScale && { textScale }),
    ...(forcedColors && { forcedColors }),
    ...(reducedMotion && { reducedMotion }),
  };
}

async function previewCapture(args: string[]): Promise<number> {
  const [url, ...flags] = args;
  const { values, layout } = captureFlags(flags);
  const out = values.get("--out");
  if (!url || !out || !URL.canParse(url)) throw new Error(captureUsage);
  const list = (name: string) => values.get(name)?.split(",");
  const widths = list("--width")?.map(Number);
  if (widths?.some((width) => !Number.isInteger(width) || width <= 0)) throw new Error(captureUsage);
  const media = captureMedia(list);
  try {
    const { capture } = await import("./capture.ts");
    const index = await capture(url, {
      out,
      scenarios: list("--scenario"),
      widths,
      themes: list("--theme"),
      designSystems: list("--design-system"),
      ...(layout && { layout }),
      ...(Object.keys(media).length > 0 && { media }),
    });
    const failed = index.cells.filter((cell) => cell.errors.length > 0);
    for (const cell of failed) console.error(`${cell.png}: ${cell.errors.length} render error(s)`);
    return failed.length > 0 ? 1 : 0;
  } catch (error) {
    // A capture that could not run reports its message and a status, whatever the kind.
    if (error instanceof CaptureError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

async function mcpCommand(args: string[]): Promise<number> {
  const [config, ...rest] = args;
  if (!config || rest.length > 0) throw new Error("Usage: liveframe mcp <config-module>");
  try {
    const { mcp } = await import("./mcp.ts");
    return await mcp(config);
  } catch (error) {
    if (error instanceof Error && error.name === "McpSdkMissing") {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

const checkUsage = "Usage: liveframe check-packages <store-dir> --catalog <file> --capabilities <file>";

/**
 * Reports every package a `fileStore` holds against a catalog and capabilities. Template packages
 * are verified and rendered (`templateRunner` runs no author code); code packages are only
 * verified, because the CLI never runs widget code (law 1). Exit 0 when all are ok, 1 when any
 * is not, 2 when the catalog or capabilities are invalid.
 */
async function checkPackagesCommand(args: string[]): Promise<number> {
  const [dir, ...flags] = args;
  const files = new Map<string, string>();
  for (let i = 0; i < flags.length; i += 2) {
    const name = flags[i];
    const file = flags[i + 1];
    if ((name !== "--catalog" && name !== "--capabilities") || files.has(name) || !file || file.startsWith("--"))
      throw new Error(checkUsage);
    files.set(name, file);
  }
  const catalogFile = files.get("--catalog");
  const capabilitiesFile = files.get("--capabilities");
  if (!dir || dir.startsWith("--") || !catalogFile || !capabilitiesFile) throw new Error(checkUsage);
  const catalog = validateCatalog(await Bun.file(catalogFile).json());
  const capabilities = validateCapabilities(await Bun.file(capabilitiesFile).json());
  if (!catalog.ok || !capabilities.ok) {
    console.error(JSON.stringify(!catalog.ok ? catalog.errors : capabilities.ok ? [] : capabilities.errors, null, 2));
    return 2;
  }
  const install = { catalog: catalog.value, capabilities: capabilities.value };
  const runner = templateRunner();
  const report: PackageCheck[] = [];
  for (const file of (await Array.fromAsync(new Bun.Glob("packages/*/*.json").scan({ cwd: dir }))).sort()) {
    let doc: unknown;
    try {
      doc = await Bun.file(`${dir}/${file}`).json();
    } catch {
      report.push({
        id: file,
        version: "",
        hash: "",
        ok: false,
        errors: [{ kind: "invalid-document", pointer: "", message: "Invalid JSON record" }],
      });
      continue;
    }
    const isTemplate = typeof doc === "object" && doc !== null && "template" in doc;
    report.push(...(await checkPackages([doc], { ...install, ...(isTemplate ? { runner } : {}) })));
  }
  console.log(JSON.stringify(report, null, 2));
  return report.every((entry) => entry.ok) ? 0 : 1;
}

const genUsage =
  "Usage: liveframe gen <catalog.json> --out <file> [--check] [--implementations | --elements-schema [--local <file>] | --template-schema [--manifest <file>] [--capabilities <file>] [--structured-subset] | --digest [--capabilities <file>] [--local <file>] [--budget <chars>]]";

const genBooleans = [
  "--check",
  "--implementations",
  "--elements-schema",
  "--template-schema",
  "--structured-subset",
  "--digest",
];
const genValued = ["--out", "--manifest", "--capabilities", "--local", "--budget"];

function genFlags(flags: string[]) {
  const given = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i] ?? "";
    const next = flags[i + 1];
    if (genBooleans.includes(flag) && !given.has(flag)) given.add(flag);
    else if (genValued.includes(flag) && !values.has(flag) && next && !next.startsWith("--"))
      values.set(flag, flags[++i] as string);
    else throw new Error(genUsage);
  }
  const implementations = given.has("--implementations");
  const elements = given.has("--elements-schema");
  const template = given.has("--template-schema");
  const digest = given.has("--digest");
  if (Number(implementations) + Number(elements) + Number(template) + Number(digest) > 1) throw new Error(genUsage);
  const subset = given.has("--structured-subset");
  const manifest = values.get("--manifest");
  const capabilities = values.get("--capabilities");
  if (!template && (subset || manifest)) throw new Error(genUsage);
  if (!template && !digest && capabilities) throw new Error(genUsage);
  const local = values.get("--local");
  if (!elements && !digest && local) throw new Error(genUsage);
  const budgetText = values.get("--budget");
  const budget = budgetText === undefined ? undefined : Number(budgetText);
  if (budget !== undefined && (!digest || !Number.isSafeInteger(budget) || budget < 0)) throw new Error(genUsage);
  return {
    out: values.get("--out"),
    check: given.has("--check"),
    implementations,
    elements,
    template,
    digest,
    budget,
    subset,
    manifest,
    capabilities,
    local,
  };
}

/** `--template-schema`: the per-catalog template schema, narrowed by the optional manifest and capabilities. */
async function templateSchema(
  catalog: Catalog,
  flags: { subset: boolean; manifest: string | undefined; capabilities: string | undefined },
): Promise<{ ok: true; text: string } | { ok: false; errors: readonly unknown[] }> {
  let capabilities: ReturnType<typeof validateCapabilities> | undefined;
  if (flags.capabilities) {
    capabilities = validateCapabilities(await Bun.file(flags.capabilities).json());
    if (!capabilities.ok) return capabilities;
  }
  let manifest: ReturnType<typeof validateManifest> | undefined;
  if (flags.manifest) {
    // A manifest is checked against its capabilities, so naming one without the other cannot be validated.
    if (!capabilities?.ok) throw new Error("--manifest needs --capabilities");
    manifest = validateManifest(await Bun.file(flags.manifest).json(), {
      catalog,
      capabilities: capabilities.value,
    });
    if (!manifest.ok) return manifest;
  }
  return {
    ok: true,
    text: generateTemplateSchema(catalog, {
      ...(manifest?.ok ? { manifest: manifest.value } : {}),
      ...(capabilities?.ok ? { capabilities: capabilities.value } : {}),
      structuredSubset: flags.subset,
    }),
  };
}

/** `--digest`: the agent-facing catalog description; over `--budget` it exits 1 and writes nothing. */
async function digest(
  catalog: Catalog,
  flags: { capabilities: string | undefined; local: string | undefined; budget: number | undefined },
): Promise<GenOutput> {
  const capabilities = flags.capabilities ? validateCapabilities(await Bun.file(flags.capabilities).json()) : undefined;
  if (capabilities && !capabilities.ok) return capabilities;
  const local = flags.local ? validateLocal(await Bun.file(flags.local).json()) : undefined;
  if (local && !local.ok) return local;
  try {
    const text = generateDigest(catalog, {
      ...(capabilities ? { capabilities: capabilities.value } : {}),
      ...(local ? { local: local.value } : {}),
      ...(flags.budget === undefined ? {} : { budget: flags.budget }),
    });
    return { ok: true, text };
  } catch (error) {
    if (error instanceof LiveframeFailure) return { ok: false, errors: error.errors, exit: 1 };
    throw error;
  }
}

type GenOutput = { ok: true; text: string } | { ok: false; errors: readonly unknown[]; exit?: number };

/** The text the selected `gen` mode writes, or the errors of the documents it read. */
async function genOutput(catalog: Catalog, gen: ReturnType<typeof genFlags>): Promise<GenOutput> {
  if (gen.template) return templateSchema(catalog, gen);
  if (gen.digest) return digest(catalog, gen);
  if (gen.elements && gen.local) {
    // The `local` file holds the object schema the caller passes to `ephemeralManifest` (spec §8).
    const local = validateLocal(await Bun.file(gen.local).json());
    return local.ok ? { ok: true, text: generateElementsSchema(catalog, { local: local.value }) } : local;
  }
  const text = gen.elements
    ? generateElementsSchema(catalog)
    : gen.implementations
      ? generateDefinitions(catalog)
      : generate(catalog);
  return { ok: true, text };
}

async function main(args: string[]): Promise<number> {
  if (args[0] === "mcp") return mcpCommand(args.slice(1));
  if (args[0] === "check-packages") return checkPackagesCommand(args.slice(1));
  if (args[0] === "preview" && args[1] === "capture") return previewCapture(args.slice(2));
  const [command, catalogPath, ...flags] = args;
  const gen = genFlags(flags);
  const { out, check } = gen;
  if (command !== "gen" || !catalogPath || !out) throw new Error(genUsage);
  const catalog = validateCatalog(await Bun.file(catalogPath).json());
  if (!catalog.ok) {
    console.error(JSON.stringify(catalog.errors, null, 2));
    return 2;
  }
  const generated = await genOutput(catalog.value, gen);
  if (!generated.ok) {
    console.error(JSON.stringify(generated.errors, null, 2));
    return generated.exit ?? 2;
  }
  const expected = generated.text;
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
  console.error(JSON.stringify([{ kind: "invalid-document", pointer: "", message: errorMessage(error) }], null, 2));
  process.exitCode = 2;
}
