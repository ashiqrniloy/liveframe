import { readFile, rm } from "node:fs/promises";

// TypeScript 7 rewrites relative import extensions in .js but not in .d.ts,
// so declarations get the same rewrite here. Consumers only ever get dist/.
const root = new URL("../", import.meta.url).pathname;
await rm(`${root}dist`, { recursive: true, force: true });

async function compile(dir: string): Promise<void> {
  const build = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"], {
    cwd: dir,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);

  for await (const path of new Bun.Glob("dist/**/*.d.ts").scan(dir)) {
    const url = new URL(path, `file://${dir}`);
    const source = await Bun.file(url).text();
    const rewritten = source.replace(/(["'])(\.{1,2}\/[^"'\n]*?)\.(?:ts|tsx)\1/g, "$1$2.js$1");
    if (rewritten !== source) await Bun.write(url, rewritten);
  }
}
await compile(root);

// `/pack` transpiles with sucrase's `transform`. Bundling it keeps sucrase's CLI-only dependencies
// (commander, mz, pirates, tinyglobby, …) out of every consumer's install, and pins what runs to the lockfile.
// The source keeps `import { transform } from "sucrase"`; only the built import is pointed at the bundle.
async function bundleSucrase(): Promise<void> {
  const bundle = await Bun.build({
    entrypoints: [`${root}node_modules/sucrase/dist/esm/index.js`],
    format: "esm",
    target: "browser",
    splitting: false,
    metafile: true,
  });
  const [output] = bundle.outputs;
  if (!bundle.success || bundle.outputs.length !== 1 || !output) {
    console.error(bundle.logs.join("\n") || "The sucrase bundle must be exactly one file");
    process.exit(1);
  }
  const code = await output.text();
  if (/(?:from|import)\s*["'](?:node|bun):/.test(code)) throw new Error("The sucrase bundle must be host-API-free");
  await Bun.write(`${root}dist/pack/sucrase.js`, code);

  const entry = `${root}dist/pack/bundle.js`;
  const source = await Bun.file(entry).text();
  const linked = source.replace(/from\s*"sucrase"/, 'from "./sucrase.js"');
  if (linked === source) throw new Error("dist/pack/bundle.js no longer imports sucrase");
  await Bun.write(entry, linked);

  // Every bundled package's licence text ships with the bundle (MIT and Apache-2.0 require it).
  const bundled = new Set<string>();
  for (const input of Object.keys(bundle.metafile?.inputs ?? {})) {
    const name = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(input)?.[1];
    if (name) bundled.add(name);
  }
  const sections: string[] = [];
  for (const name of [...bundled].sort()) {
    const { version } = JSON.parse(await readFile(`${root}node_modules/${name}/package.json`, "utf8")) as {
      version: string;
    };
    const licence = await readFile(`${root}node_modules/${name}/LICENSE`, "utf8");
    sections.push(`### ${name}@${version}\n\n${licence.trim()}\n`);
  }
  await Bun.write(
    `${root}dist/pack/THIRD-PARTY-LICENSES`,
    `dist/pack/sucrase.js bundles these packages:\n\n${sections.join("\n----\n\n")}`,
  );
}
await bundleSucrase();

// Self-contained modules for sandboxes with no module resolution.
// "browser" keeps node: and bun: built-ins out of the output.
async function buildBundle(name: string): Promise<void> {
  const bundle = await Bun.build({
    entrypoints: [`${root}scripts/${name}-bundle.ts`],
    format: "esm",
    target: "browser",
    splitting: false,
    minify: true,
  });
  const [output] = bundle.outputs;
  if (!bundle.success || bundle.outputs.length !== 1 || !output) {
    console.error(bundle.logs.join("\n") || `The ${name} bundle must be exactly one file`);
    process.exit(1);
  }
  await Bun.write(`${root}dist/${name}.bundle.js`, output);
}
await buildBundle("runner-kit");
await buildBundle("validator");

// The workspace packages build after the root: their declarations resolve `@arnilo/liveframe` through its `dist/`.
// A package that needs more than tsc (a wasm copy, a bundled child entry) adds a `build.ts` that runs after it.
for await (const path of new Bun.Glob("packages/*/package.json").scan(root)) {
  const dir = `${root}${path.slice(0, -"package.json".length)}`;
  await rm(`${dir}dist`, { recursive: true, force: true });
  await compile(dir);
  const extra = `${dir}build.ts`;
  if (await Bun.file(extra).exists()) {
    const run = Bun.spawnSync(["bun", extra], { cwd: dir, stdio: ["ignore", "inherit", "inherit"] });
    if (run.exitCode !== 0) process.exit(run.exitCode ?? 1);
  }
}
