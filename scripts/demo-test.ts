#!/usr/bin/env bun
/**
 * Run the demo host against the packed archive, never the checkout:
 * build, pack into the demo's .pack/, install it as a file: dependency, type-check, test.
 *
 *   timeout 900s bun scripts/demo-test.ts
 */
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { stagePackage } from "./release/publish-manifest.ts";

const root = new URL("../", import.meta.url).pathname;
const demo = join(root, "examples/demo-host");
const pack = join(demo, ".pack");

function run(args: string[], cwd: string) {
  const proc = Bun.spawnSync(args, { cwd, stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) throw new Error(`${args.join(" ")} exited ${proc.exitCode}`);
}

await rm(pack, { recursive: true, force: true });
await mkdir(pack, { recursive: true });
run(["bun", "run", "build"], root);
const staging = join(pack, "staging");
await stagePackage(staging);
run(["bun", "pm", "pack", "--destination", pack], staging);
await rm(staging, { recursive: true, force: true });
const [tarball] = (await readdir(pack)).filter((file) => file.endsWith(".tgz"));
if (!tarball) throw new Error("bun pm pack produced no tarball");
await rename(join(pack, tarball), join(pack, "arnilo-liveframe.tgz"));
// A repacked tarball keeps its path, so drop the lockfile and the installed copy to avoid a stale install.
// The demo's dependency points at the tarball for the run only; `bun add --no-save` kept the registry copy on Bun 1.4.2.
const manifestPath = join(demo, "package.json");
const manifest = await Bun.file(manifestPath).text();
await rm(join(demo, "bun.lock"), { force: true });
await rm(join(demo, "node_modules/@arnilo"), { recursive: true, force: true });
const json = JSON.parse(manifest);
json.dependencies["@arnilo/liveframe"] = `file:${join(pack, "arnilo-liveframe.tgz")}`;
try {
  await Bun.write(manifestPath, JSON.stringify(json, null, 2));
  run(["bun", "install"], demo);
} finally {
  await Bun.write(manifestPath, manifest);
  await rm(join(demo, "bun.lock"), { force: true });
}
run(["bun", "run", "typecheck"], demo);
run(["bun", "run", "test", ...process.argv.slice(2)], demo);
