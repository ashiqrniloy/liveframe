#!/usr/bin/env bun
/**
 * Plan 032 Task 4, operator side: build the host an agent works against, outside the repository, from the packed
 * archives of all three packages (what a registry install gives it), and leave the agent nothing but the installed
 * README and docs, the running host and the `liveframe mcp` tools.
 *
 * The host is the demo host (`examples/demo-host`, the `/host` pipeline, the `tasks.*` and `selection.*`
 * capabilities) with three changes, all in the copy: its catalog, themes, design system and primitives are the
 * starter's; it renders with `quickjsRunner()`; and its preview draft is the getting-started guide's template widget.
 *
 *   timeout 900s bun scripts/agent-acceptance/prepare.ts --out <empty dir outside the repo>
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { packageDirs, readManifest, root } from "../release/packages.ts";
import { stagePackage } from "../release/publish-manifest.ts";

const flag = process.argv.indexOf("--out");
const out = flag > 0 ? resolve(process.argv[flag + 1] ?? "") : "";
if (!out || out.startsWith(root)) throw new Error("--out must name a directory outside the repository");

const run = (args: string[], cwd: string) => {
  const proc = Bun.spawnSync(args, { cwd, stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) throw new Error(`${args.join(" ")} exited ${proc.exitCode}`);
};
const read = (path: string) => Bun.file(path).text();

await rm(out, { recursive: true, force: true });
const host = join(out, "host");
await mkdir(join(host, "widgets"), { recursive: true });

// 1. The three archives, exactly as published.
run(["bun", "run", "build"], root);
const archives: Record<string, string> = {};
for (const dir of await packageDirs()) {
  const { name } = await readManifest(dir);
  const staging = join(out, "staging");
  const destination = join(out, "archives", name.replace(/\W+/g, "-"));
  await stagePackage(staging, dir);
  await mkdir(destination, { recursive: true });
  run(["bun", "pm", "pack", "--destination", destination], staging);
  const [tarball] = (await readdir(destination)).filter((file) => file.endsWith(".tgz"));
  if (!tarball) throw new Error(`bun pm pack produced no tarball for ${name}`);
  archives[name] = join(destination, tarball);
  await rm(staging, { recursive: true, force: true });
}

// 2. The demo host's own files, without its widgets, tests or documents.
const demo = join(root, "examples/demo-host");
for (const name of [
  "server.ts",
  "client.tsx",
  "view.tsx",
  "preview.ts",
  "preview.html",
  "preview-client.tsx",
  "page.html",
  "capabilities.json",
  "tsconfig.json",
]) {
  await cp(join(demo, name), join(host, name));
}
await cp(new URL("./mcp-session.ts", import.meta.url).pathname, join(host, "mcp-session.ts"));
await cp(join(demo, "widgets/draft.ts"), join(host, "widgets/draft.ts"));
await cp(join(demo, "widgets/libraries.d.ts"), join(host, "widgets/libraries.d.ts"));

// 3. The starter replaces the demo's catalog, themes, design system and primitives.
await Bun.write(
  join(host, "app.ts"),
  `import { type Result, validateCapabilities } from "@arnilo/liveframe";
import { catalog, designSystem, themes } from "@arnilo/liveframe-starter";
import capabilitiesDocument from "./capabilities.json" with { type: "json" };

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

export { catalog, designSystem, themes };
export const capabilities = valid(validateCapabilities(capabilitiesDocument));
export const theme = themes[0];
export const designSystems = [designSystem] as const;
`,
);
await Bun.write(
  join(host, "styles.ts"),
  `import { styles } from "@arnilo/liveframe-starter";

const css = styles();
/** The four sheets the pages load, in order. */
export const sheets: Record<string, string> = {
  "/styles/base.css": css.base,
  "/styles/primitives.css": css.primitives,
  "/styles/theme.css": css.themes,
  "/styles/design-system.css": css.designSystem,
};
`,
);
await mkdir(join(host, "primitives"), { recursive: true });
await Bun.write(join(host, "primitives/index.tsx"), `export { implementations } from "@arnilo/liveframe-starter";\n`);

// 4. Render with the isolated runner, and preview a template widget the starter catalog accepts.
let server = await read(join(host, "server.ts"));
const patches: [string, string][] = [
  [`const runner = workerRunner();`, `const runner = await quickjsRunner();`],
  [
    `readDraft(new URL("./widgets/hello/", import.meta.url).pathname)`,
    `readWidget(new URL("./widgets/hello/", import.meta.url).pathname)`,
  ],
  [`import { readDraft } from "./widgets/draft.ts";`, `import { readWidget } from "./widgets/draft.ts";`],
];
for (const [before, after] of patches) {
  if (!server.includes(before)) throw new Error(`server.ts no longer contains: ${before}`);
  server = server.replace(before, after);
}
server = `import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";\n${server}`;
await Bun.write(join(host, "server.ts"), server);

const guide = await read(join(root, "docs/getting-started.md"));
for (const name of ["manifest", "template", "scenarios"]) {
  const block = new RegExp(`\`\`\`json file=widget/${name}\\.json\\n([\\s\\S]*?)\`\`\``).exec(guide);
  if (!block) throw new Error(`docs/getting-started.md has no widget/${name}.json block`);
  await Bun.write(join(host, "widgets/hello", `${name}.json`), block[1] ?? "");
}

// 5. The MCP config the agent registers: the host's catalog and capabilities, the isolated runner, its own preview.
await Bun.write(
  join(host, "mcp.config.ts"),
  `import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";
import { capabilities, catalog } from "./app.ts";
import { previewRoutes } from "./preview.ts";

const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: await quickjsRunner(),
  async preview(binding) {
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, routes: await previewRoutes(binding) });
    return { url: new URL("/preview", server.url).href, close: () => server.stop(true) };
  },
};

export default config;
`,
);

// 6. Install from the archives.
const demoManifest = JSON.parse(await read(join(demo, "package.json")));
await Bun.write(
  join(host, "package.json"),
  `${JSON.stringify(
    {
      name: "liveframe-agent-acceptance-host",
      private: true,
      type: "module",
      scripts: { start: "bun server.ts", typecheck: "tsc --noEmit" },
      dependencies: {
        ...Object.fromEntries(Object.entries(archives).map(([name, path]) => [name, `file:${path}`])),
        react: demoManifest.dependencies.react,
        "react-dom": demoManifest.dependencies["react-dom"],
        "react-aria-components": demoManifest.dependencies["react-aria-components"],
      },
      devDependencies: {
        "@modelcontextprotocol/client": demoManifest.devDependencies["@modelcontextprotocol/client"],
        "@modelcontextprotocol/server": demoManifest.devDependencies["@modelcontextprotocol/server"],
        "@types/bun": demoManifest.devDependencies["@types/bun"],
        "@types/react": demoManifest.devDependencies["@types/react"],
        "@types/react-dom": demoManifest.devDependencies["@types/react-dom"],
        playwright: demoManifest.devDependencies.playwright,
        typescript: demoManifest.devDependencies.typescript,
      },
    },
    null,
    2,
  )}\n`,
);
run(["bun", "install"], host);
run(["bun", "run", "typecheck"], host);

console.log(`Host ready: ${host}\nStart it: cd ${host} && bun server.ts   (http://127.0.0.1:3300)`);
