import { rm } from "node:fs/promises";

// TypeScript 7 rewrites relative import extensions in .js but not in .d.ts,
// so declarations get the same rewrite here. Consumers only ever get dist/.
const root = new URL("../", import.meta.url).pathname;
await rm(`${root}dist`, { recursive: true, force: true });

const build = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
});
if (build.exitCode !== 0) process.exit(build.exitCode ?? 1);

for await (const path of new Bun.Glob("dist/**/*.d.ts").scan(root)) {
  const url = new URL(path, `file://${root}`);
  const source = await Bun.file(url).text();
  const rewritten = source.replace(/(["'])(\.{1,2}\/[^"'\n]*?)\.(?:ts|tsx)\1/g, "$1$2.js$1");
  if (rewritten !== source) await Bun.write(url, rewritten);
}

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
