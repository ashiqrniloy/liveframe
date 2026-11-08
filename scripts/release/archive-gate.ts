#!/usr/bin/env bun
/**
 * Installed-archive gate: install the packed package outside the checkout and prove it works.
 * The archive checks and installed steps are the release test; nothing here ships.
 *
 *   timeout 900s bun scripts/release/archive-gate.ts
 *   timeout 900s bun scripts/release/archive-gate.ts --tarball /tmp/arnilo-liveframe-0.0.0.tgz
 *   timeout 900s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@next
 */
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSelfContained } from "./bundle-check.ts";
import { archiveProblems, archiveRules, packageDirs, readManifest, root } from "./packages.ts";
import { assertExportsPacked, stagePackage } from "./publish-manifest.ts";

const usage =
  "Usage: bun scripts/release/archive-gate.ts [--all | --dir <package-directory>] [--tarball <path> | --package <spec>] [--keep]";
const argv = process.argv.slice(2);
let tarball = "";
let spec = "";
let keep = false;
let all = false;
let packageDir = ".";
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i];
  if (flag === "--keep") keep = true;
  else if (flag === "--all") all = true;
  else if (flag === "--dir" && argv[i + 1]) packageDir = argv[++i] as string;
  else if (flag === "--tarball" && argv[i + 1]) tarball = argv[++i] as string;
  else if (flag === "--package" && argv[i + 1]) spec = argv[++i] as string;
  else if (flag === "--help" || flag === "-h") {
    console.log(usage);
    process.exit(0);
  } else {
    console.error(`${usage}\nUnknown argument: ${flag}`);
    process.exit(2);
  }
}
if ((tarball && spec) || (all && (tarball || spec || packageDir !== "."))) {
  console.error(`${usage}\nPass --tarball or --package, not both; --all takes no other selector`);
  process.exit(2);
}

// `--all` gates each package in its own process, in the order of `packageDirs()` (the core first).
if (all) {
  let failed = false;
  for (const dir of await packageDirs()) {
    console.log(`\n== archive gate: ${dir} ==`);
    const proc = Bun.spawnSync(["bun", import.meta.path, "--dir", dir, ...(keep ? ["--keep"] : [])], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (proc.exitCode !== 0) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

const pkg = await readManifest(packageDir);
const isRoot = packageDir === ".";
const rules = archiveRules[pkg.name];
if (!rules) throw new Error(`scripts/release/packages.ts has no archive rules for ${pkg.name}`);
const rootPkg = isRoot ? pkg : await readManifest(".");

function run(args: string[], cwd: string): string {
  const proc = Bun.spawnSync(args, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  if (proc.exitCode !== 0) throw new Error(`${args.join(" ")} exited ${proc.exitCode}\n${output.trim()}`);
  return output;
}

const dir = await mkdtemp(join(tmpdir(), "liveframe-archive-"));
const time = (start: number) => `${((performance.now() - start) / 1000).toFixed(1)}s`;
const started = performance.now();

try {
  // Setup: build and pack (or take a tarball or a registry spec), install, copy the fixtures.
  await writeFile(
    join(dir, "package.json"),
    `${JSON.stringify({ name: "liveframe-archive-gate", private: true, type: "module" }, null, 2)}\n`,
  );
  // Pack with `bun pm pack` from a staged copy (the same files `release:stage` publishes).
  const pack = async (what: string): Promise<string> => {
    const destination = join(dir, `pack-${what}`);
    await mkdir(destination);
    const staging = join(dir, `staging-${what}`);
    await stagePackage(staging, what === "core" ? "." : packageDir);
    run(["bun", "pm", "pack", "--destination", destination], staging);
    const [packed] = (await readdir(destination)).filter((file) => file.endsWith(".tgz"));
    if (!packed) throw new Error("bun pm pack produced no tarball");
    return join(destination, packed);
  };
  let target = tarball;
  if (!target && !spec) {
    run(["bun", "run", "build"], root);
    target = await pack(isRoot ? "core" : "package");
  }
  if (target) {
    const at = performance.now();
    const manifest = JSON.parse(run(["tar", "-xOf", target, "package/package.json"], root));
    const files = new Set(
      run(["tar", "-tzf", target], root)
        .trim()
        .split("\n")
        .map((file) => file.replace(/^package\//, "")),
    );
    assertExportsPacked(manifest.exports, files);
    const problems = archiveProblems(rules, files);
    if (problems.length > 0) throw new Error(problems.join("\n"));
    console.log(`ok every exports target is packed, archive rules hold (${time(at)})`);
  }
  const peerSpec = (name: string) => `${name}@${rootPkg.devDependencies?.[name] ?? pkg.peerDependencies?.[name]}`;
  const peers = Object.keys(pkg.peerDependencies ?? {})
    .filter((name) => isRoot || name !== "@arnilo/liveframe")
    .map(peerSpec);
  if (isRoot) {
    const types = ["@types/react", "@types/react-dom", "@types/node"].map((name) =>
      pkg.devDependencies?.[name] ? `${name}@${pkg.devDependencies[name]}` : name,
    );
    const client = `@modelcontextprotocol/client@${pkg.devDependencies?.["@modelcontextprotocol/client"]}`;
    run(["bun", "add", spec || target, ...peers, ...types, client], dir);
  } else {
    // A package peers on the core, which is not published at this version yet unless `--package` names a release.
    const core = spec ? `@arnilo/liveframe@${pkg.peerDependencies?.["@arnilo/liveframe"]}` : await pack("core");
    run(["bun", "add", core, spec || target, ...peers], dir);
  }

  const fixtures = join(dir, "fixtures");
  await cp(join(root, "scripts/release/fixtures"), fixtures, { recursive: true });
  await cp(join(root, "src/__tests__/fixtures/proof/catalog.json"), join(fixtures, "catalog.json"));
  await cp(join(root, "src/__tests__/fixtures/widgets/capabilities.json"), join(fixtures, "capabilities.json"));
  await writeFile(
    join(dir, "liveframe.config.ts"),
    `import catalog from "./fixtures/catalog.json" with { type: "json" };\nimport capabilities from "./fixtures/capabilities.json" with { type: "json" };\n\nexport default { catalog, capabilities };\n`,
  );
  const installedDir = join(dir, "node_modules", pkg.name);
  const installed = (await Bun.file(join(installedDir, "package.json")).json()) as {
    version: string;
    exports: unknown;
  };
  console.log(`installed ${pkg.name}@${installed.version} in ${dir} (${time(started)})`);

  const bin = join(dir, "node_modules/.bin/liveframe");
  const step = (name: string, body: () => void) => {
    const at = performance.now();
    try {
      body();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`archive gate: step failed: ${name}\n${message}`);
      process.exitCode = 1;
      return false;
    }
    console.log(`ok ${name} (${time(at)})`);
    return true;
  };

  const assertConformance = (name: "corpus" | "hash" | "patch" | "runner") => {
    const installed = join(dir, "node_modules/@arnilo/liveframe/conformance", name);
    const source = new Set(
      new Bun.Glob("**/*.json").scanSync({ cwd: join(root, "conformance", name), onlyFiles: true }),
    );
    const packed = new Set(new Bun.Glob("**/*.json").scanSync({ cwd: installed, onlyFiles: true }));
    if (!source.size) throw new Error(`conformance/${name} holds no JSON documents`);
    for (const file of source) {
      if (!packed.has(file)) throw new Error(`${name} file not packed: conformance/${name}/${file}`);
      JSON.parse(readFileSync(join(installed, file), "utf8"));
    }
    if (packed.size !== source.size)
      throw new Error(`packed ${name} has ${packed.size} JSON files, expected ${source.size}`);
  };

  const installedFiles = () => new Set(new Bun.Glob("**/*").scanSync({ cwd: installedDir, onlyFiles: true }));
  const installedTargets: [string, () => void] = [
    "every installed exports target exists, installed archive rules hold",
    () => {
      assertExportsPacked(installed.exports, installedFiles());
      const problems = archiveProblems(rules, installedFiles());
      if (problems.length > 0) throw new Error(problems.join("\n"));
    },
  ];
  // A package may ship `archive-smoke.ts`: it runs in the install directory and imports the package by name,
  // so it proves the package's own files (a wasm, a child entry) resolve outside the checkout.
  const smoke = join(root, packageDir, "archive-smoke.ts");
  const packageSteps: Array<[string, () => void]> = [installedTargets];
  if (existsSync(smoke)) {
    await cp(smoke, join(dir, "archive-smoke.ts"));
    packageSteps.push(["installed package smoke", () => run(["bun", join(dir, "archive-smoke.ts")], dir)]);
  }

  const rootSteps: Array<[string, () => void]> = [
    installedTargets,
    [
      "sucrase is bundled: no CLI-only dependencies installed, licences packed",
      () => {
        const modules = join(dir, "node_modules");
        for (const name of ["sucrase", "commander", "mz", "thenify", "pirates", "tinyglobby"])
          if (existsSync(join(modules, name)))
            throw new Error(`${name} was installed; the pack bundle must not need it`);
        const licences = readFileSync(join(modules, "@arnilo/liveframe/dist/pack/THIRD-PARTY-LICENSES"), "utf8");
        if (!licences.includes("sucrase@") || !licences.includes("Permission is hereby granted"))
          throw new Error("dist/pack/THIRD-PARTY-LICENSES does not carry sucrase's licence text");
      },
    ],
    ["corpus packed", () => assertConformance("corpus")],
    ["hash vectors packed", () => assertConformance("hash")],
    ["patch vectors packed", () => assertConformance("patch")],
    ["runner fixtures packed", () => assertConformance("runner")],
    [
      "validator bundle packed and self-contained",
      () =>
        assertSelfContained(readFileSync(join(dir, "node_modules/@arnilo/liveframe/dist/validator.bundle.js"), "utf8")),
    ],
    [
      "runner bundle packed and self-contained",
      () =>
        assertSelfContained(
          readFileSync(join(dir, "node_modules/@arnilo/liveframe/dist/runner-kit.bundle.js"), "utf8"),
        ),
    ],
    ["pack, store, reload and render through both runners", () => run(["bun", join(fixtures, "step1-runner.ts")], dir)],
    ["worker timeout, then recovery", () => run(["bun", join(fixtures, "step2-timeout.ts")], dir)],
    [
      "liveframe gen and gen --check",
      () => {
        const out = join(dir, "ui.gen.ts");
        run([bin, "gen", join(fixtures, "catalog.json"), "--out", out], dir);
        run([bin, "gen", join(fixtures, "catalog.json"), "--out", out, "--check"], dir);
      },
    ],
    ["liveframe mcp over stdio", () => run(["bun", join(fixtures, "step4-mcp.ts")], dir)],
    ["browser bundle from the installed package", () => run(["bun", join(fixtures, "step5-browser.ts")], dir)],
    [
      "consumer types under strict NodeNext",
      () => run(["bun", join(root, "node_modules/typescript/lib/tsc.js"), "-p", join(fixtures, "consumer")], dir),
    ],
    [
      "host-API-free subpaths under node",
      () => {
        const node = Bun.which("node");
        if (!node) return console.log("skipped: node is not on PATH");
        run([node, join(fixtures, "node-probe.mjs")], dir);
      },
    ],
  ];

  const steps = isRoot ? rootSteps : packageSteps;
  for (const [name, body] of steps) if (!step(name, body)) break;
  if (process.exitCode === 1) console.error(`archive gate failed after ${time(started)}`);
  else console.log(`archive gate passed all ${steps.length} steps in ${time(started)}`);
} finally {
  if (keep) console.log(`kept ${dir}`);
  else await rm(dir, { recursive: true, force: true });
}
