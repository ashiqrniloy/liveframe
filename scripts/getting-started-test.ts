#!/usr/bin/env bun
/**
 * Run docs/getting-started.md as written: extract its fenced blocks, write them into a fresh directory, install
 * the packed archives of all three packages, run the server and check the page in a browser. The guide's code is
 * the test's code; nothing is copied.
 *
 * Fenced blocks (info string after the language):
 *   file=<path>          written to <path> in the directory (any language)
 *   sh                   each line runs in the directory and must exit 0
 *   sh server            started in the background; the test waits for the host to answer
 *   sh expect="<text>"   as `sh`, and the output must contain <text>
 * Any other block is prose and is ignored. In `sh` lines, a package name from this repository is replaced by its
 * packed archive, or by its published version with `--registry`.
 *
 *   timeout 900s bun scripts/getting-started-test.ts [--registry] [--keep]
 */
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { packageDirs, readManifest, root } from "./release/packages.ts";
import { stagePackage } from "./release/publish-manifest.ts";

const guide = join(root, "docs/getting-started.md");
const origin = "http://127.0.0.1:3410";

export type Block = {
  lang: string;
  file: string | undefined;
  server: boolean;
  expect: string | undefined;
  body: string;
};

/** The fenced blocks of a Markdown document, in order, with the attributes of their info strings. */
export function blocks(markdown: string): Block[] {
  const found: Block[] = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\w+)(.*)$/.exec(lines[i] ?? "");
    if (!open) continue;
    const body: string[] = [];
    for (i++; i < lines.length && lines[i] !== "```"; i++) body.push(lines[i] ?? "");
    const info = open[2] ?? "";
    found.push({
      lang: open[1] ?? "",
      file: /\bfile=(\S+)/.exec(info)?.[1],
      server: /(?:^|\s)server(?:\s|$)/.test(info),
      expect: /\bexpect="([^"]*)"/.exec(info)?.[1],
      body: `${body.join("\n")}\n`,
    });
  }
  return found;
}

if (import.meta.main) await main();

async function main() {
  const started = performance.now();
  const sh = (command: string, cwd: string) => {
    const proc = Bun.spawnSync(["sh", "-c", command], { cwd, stdout: "pipe", stderr: "pipe" });
    const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
    if (proc.exitCode !== 0) throw new Error(`${command} exited ${proc.exitCode}\n${output}`);
    return output;
  };
  const work = await mkdtemp(join(tmpdir(), "liveframe-getting-started-"));
  const dir = join(work, "app");
  await mkdir(dir);
  let server: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
  let serverOutput = "";

  try {
    // Pack the three packages exactly as they would be published, or verify the published ones.
    const registry = process.argv.includes("--registry");
    const archives = new Map<string, string>();
    if (!registry) {
      sh("bun run build", root);
      for (const packageDir of await packageDirs()) {
        const { name } = await readManifest(packageDir);
        const staging = join(work, `staging-${archives.size}`);
        const destination = join(work, `pack-${archives.size}`);
        await stagePackage(staging, packageDir);
        await mkdir(destination);
        sh(`bun pm pack --destination ${destination}`, staging);
        const [tarball] = (await readdir(destination)).filter((file) => file.endsWith(".tgz"));
        if (!tarball) throw new Error(`bun pm pack produced no tarball for ${name}`);
        archives.set(name, join(destination, tarball));
      }
    } else {
      for (const packageDir of await packageDirs()) {
        const { name, version } = await readManifest(packageDir);
        archives.set(name, `${name}@${version}`);
      }
    }
    const local = (line: string) =>
      line.replace(/(^|\s)(@arnilo\/liveframe[\w-]*)(?=\s|$)/g, (_whole, space: string, name: string) => {
        const archive = archives.get(name);
        if (!archive) throw new Error(`The guide installs ${name}, which this repository does not publish`);
        return `${space}${archive}`;
      });

    let ran = 0;
    for (const block of blocks(await Bun.file(guide).text())) {
      if (block.file) {
        await mkdir(dirname(join(dir, block.file)), { recursive: true });
        await Bun.write(join(dir, block.file), block.body);
      } else if (block.lang === "sh" && block.server) {
        const [command] = block.body.trim().split("\n");
        if (!command || server) throw new Error("Expected one `sh server` block with one command");
        server = Bun.spawn(["sh", "-c", `exec ${command}`], { cwd: dir, stdout: "pipe", stderr: "pipe" });
        for (const stream of [server.stdout, server.stderr])
          void (async () => {
            for await (const chunk of stream.pipeThrough(new TextDecoderStream())) serverOutput += chunk;
          })();
        const deadline = Date.now() + 60_000;
        while (
          !(await fetch(origin).then(
            (r) => r.ok,
            () => false,
          ))
        ) {
          if (Date.now() > deadline || server.exitCode !== null)
            throw new Error(`The server did not start:\n${serverOutput}`);
          await Bun.sleep(200);
        }
      } else if (block.lang === "sh") {
        let output = "";
        for (const line of block.body.split("\n").filter((entry) => entry.trim())) {
          console.log(`$ ${line}`);
          output += sh(local(line), dir);
        }
        if (block.expect && !output.includes(block.expect))
          throw new Error(`Expected the output to contain ${JSON.stringify(block.expect)}:\n${output}`);
        ran++;
      }
    }
    if (!server) throw new Error("The guide starts no server");
    if (ran < 2) throw new Error("The guide runs fewer shell blocks than expected");

    // The widget was installed into the running server by the guide's own script. Check what a reader sees.
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.message));
      await page.goto(origin);
      await page.getByText("Hello, Ada").waitFor();
      await page.getByText("Pressed 0 times").waitFor();

      // setState round-trips: check, authorise, write, re-render.
      await page.getByRole("button", { name: "Press", exact: true }).click();
      await page.getByText("Pressed 1 times").waitFor();
      await page.reload();
      await page.getByText("Pressed 1 times").waitFor();

      // An action round-trips: the server's dispatch ran as the viewer.
      await page.getByRole("button", { name: "Notify" }).click();
      const seen = Date.now() + 10_000;
      while (!serverOutput.includes("demo.notify by ada: Hello from Ada")) {
        if (Date.now() > seen) throw new Error(`The action did not reach dispatch:\n${serverOutput}`);
        await Bun.sleep(100);
      }

      // A forged intent is refused, not run.
      const forged = await page.evaluate(async () => {
        const response = await fetch("/placements/hello/intents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: { type: "action", name: "demo.notify", args: { message: "forged" } },
            origin: { nodeId: "nowhere", event: "onPress", revision: 1 },
          }),
        });
        return response.status;
      });
      if (forged < 400) throw new Error(`A forged intent was accepted with ${forged}`);
      if (serverOutput.includes("forged")) throw new Error("A forged action reached dispatch");

      // <Preview> draws the draft's scenarios.
      await page.goto(`${origin}/preview`);
      await page.getByText("Hello, Ada").first().waitFor();
      if (failures.length > 0) throw new Error(`The page threw:\n${failures.join("\n")}`);
    } finally {
      await browser.close();
    }
    console.log(`getting-started guide passed in ${((performance.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    server?.kill();
    if (process.argv.includes("--keep")) console.log(`kept ${dir}`);
    else await rm(work, { recursive: true, force: true });
  }
}
