#!/usr/bin/env bun
/**
 * Peer floors: install the oldest supported peer versions into a temporary copy of the checkout and
 * run the suites that cover them. A floor is supported only while these runs pass; dev dependencies
 * stay at their current versions.
 *
 *   timeout 1800s bun scripts/release/peer-floors.ts
 *   timeout 1800s bun scripts/release/peer-floors.ts --floor playwright --keep
 */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const pkg = (await Bun.file(join(root, "package.json")).json()) as {
  peerDependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

type Floor = { id: string; packages: Record<string, string>; suites: string[]; browsers?: boolean };
const floors: Floor[] = [
  {
    id: "react",
    packages: { react: "19.0.0", "react-dom": "19.0.0" },
    suites: [
      "src/__tests__/react-browser.test.tsx",
      "src/__tests__/react-intents.test.tsx",
      "src/__tests__/react-registry.test.tsx",
      "src/__tests__/react-ssr.test.tsx",
      "src/__tests__/react-surface.test.tsx",
      "src/__tests__/react-types.test.tsx",
      "src/__tests__/preview-react.test.tsx",
      "src/__tests__/conformance-renderer.test.tsx",
      "src/__tests__/conformance-renderer-browser.test.tsx",
    ],
  },
  {
    id: "playwright",
    packages: { playwright: "1.49.0" },
    suites: ["proof/tests/mcp-capture.test.ts", "proof/tests/preview-capture.test.ts"],
    browsers: true,
  },
  {
    id: "server",
    packages: { "@modelcontextprotocol/server": "2.0.0" },
    suites: ["src/__tests__/cli-mcp.test.ts", "src/__tests__/mcp-guide.test.ts", "proof/tests/mcp-agent-loop.test.ts"],
  },
];

const usage = "Usage: bun scripts/release/peer-floors.ts [--floor react|playwright|server] [--keep]";
const argv = process.argv.slice(2);
let only = "";
let keep = false;
for (let i = 0; i < argv.length; i++) {
  const flag = argv[i];
  if (flag === "--keep") keep = true;
  else if (flag === "--floor" && argv[i + 1]) only = argv[++i] as string;
  else if (flag === "--help" || flag === "-h") {
    console.log(usage);
    process.exit(0);
  } else {
    console.error(`${usage}\nUnknown argument: ${flag}`);
    process.exit(2);
  }
}
const selected = only ? floors.filter((floor) => floor.id === only) : floors;
if (selected.length === 0) {
  console.error(`${usage}\nUnknown floor: ${only} (known: ${floors.map((floor) => floor.id).join(", ")})`);
  process.exit(2);
}

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

const current = Object.entries(pkg.peerDependencies).map(([name, range]) => `${name}@${range}`);

const dir = await mkdtemp(join(tmpdir(), "liveframe-peer-floors-"));
try {
  for (const path of ["package.json", "bun.lock", "biome.json", "tsconfig.json", "tsconfig.build.json"])
    await cp(join(root, path), join(dir, path));
  for (const path of ["src", "proof", "docs", "scripts", "schemas", "bench"])
    await cp(join(root, path), join(dir, path), { recursive: true });
  run(["bun", "install", "--frozen-lockfile"], dir);

  for (const floor of selected) {
    const started = performance.now();
    console.log(
      `trying ${floor.id} floor: ${Object.entries(floor.packages)
        .map(([name, version]) => `${name}@${version}`)
        .join(", ")}`,
    );
    // Reset every peer to its shipped version, then install just this floor.
    run(["bun", "add", ...current, "--exact"], dir);
    run(
      ["bun", "add", ...Object.entries(floor.packages).map(([name, version]) => `${name}@${version}`), "--exact"],
      dir,
    );
    if (floor.browsers) {
      // Capture needs a browser before it can prove a floor; downloading hundreds of MB (and, before
      // 1.50, a separate headless shell) belongs to the setup step, so this run only checks the browser.
      try {
        run(
          [
            "bun",
            "-e",
            'const { chromium } = await import("playwright"); const browser = await chromium.launch({ headless: true }); await browser.close();',
          ],
          dir,
        );
      } catch (error) {
        throw new Error(
          `Playwright cannot launch a browser, so capture would only time out: run \`bunx playwright install chromium chromium-headless-shell\` before the ${floor.id} floor\n${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const output = run(["bun", "test", "--conditions", "liveframe:source", ...floor.suites], dir);
    const summary = output
      .split("\n")
      .filter((line) => / pass$| fail$|^Ran /.test(line))
      .join(", ");
    console.log(
      `ok ${floor.id} floor ${Object.values(floor.packages).join(" / ")}: ${summary} (${((performance.now() - started) / 1000).toFixed(0)}s)`,
    );
  }
  console.log(`peer floors pass for ${current.join(", ")}`);
} catch (error) {
  console.error(`peer floors failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (keep) console.log(`kept ${dir}`);
  else await rm(dir, { recursive: true, force: true });
}
