import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundle } from "../../src/pack/bundle.ts";

console.log(`Bun ${Bun.version}`);
const simple = "const x = { value: 3 }; export default () => x.value;";
const root = new URL("../../src/__tests__/fixtures/widgets/", import.meta.url);
const paths = [
  "ui.gen.ts",
  ...["queue", "task-card", "decision-card", "alert-card", "facts", "queue-row"].map(
    (name) => `agent-home/${name}.tsx`,
  ),
];
const files = Object.fromEntries(
  await Promise.all(paths.map(async (path) => [path, await Bun.file(new URL(path, root)).text()])),
);
files["agent-home/queue.tsx"] += "\nexport default AgentHomeQueue;";
const linked = bundle({ files, entry: "agent-home/queue.tsx" });
if (!linked.ok) throw new Error(JSON.stringify(linked.errors));

for (const [name, code] of [
  ["property-access", simple],
  ["linked-agent-home", linked.value],
] as const) {
  const module = await import(`data:text/javascript,${encodeURIComponent(code).replaceAll(".", "%2E")}`);
  assert.equal(typeof module.default, "function", name);
  if (name === "property-access") assert.equal(module.default(), 3);
  console.log(JSON.stringify({ name, defaultType: typeof module.default }));
}

// This probe lives inside the package, like the future production loader.
let rewrittenHeaders = 0;
const rewritten = linked.value.replace(
  /^import \* as (__lf_sdk\d+) from "(@arnilo\/liveframe\/sdk(?:\/jsx(?:-dev)?-runtime)?)";$/gm,
  (_, binding: string, specifier: string) => {
    rewrittenHeaders++;
    return `import * as ${binding} from ${JSON.stringify(import.meta.resolve(specifier))};`;
  },
);
assert.ok(rewrittenHeaders > 0, "The actual linked module must contain SDK headers");
const probe = `
const code = ${JSON.stringify(rewritten)};
const module = await import("data:text/javascript," + encodeURIComponent(code).replaceAll(".", "%2E"));
if (typeof module.default !== "function") throw new Error("Expected a function default export");
`;
const directory = await mkdtemp(join(tmpdir(), "liveframe-loader-gate-"));
try {
  await Bun.write(join(directory, "worker.mjs"), `${probe}\npostMessage(typeof module.default);`);
  await Bun.write(
    join(directory, "main.mjs"),
    `${probe}
console.log(JSON.stringify({ name: "outside-main-agent-home", defaultType: typeof module.default }));
const worker = new Worker(new URL("./worker.mjs", import.meta.url));
try {
  const type = await new Promise((resolve, reject) => {
    worker.onmessage = event => resolve(event.data);
    worker.onerror = event => reject(new Error(event.message));
  });
  if (type !== "function") throw new Error("Expected a worker function default export");
  console.log(JSON.stringify({ name: "outside-worker-agent-home", defaultType: type }));
} finally {
  worker.terminate();
}
`,
  );
  const child = Bun.spawn(["timeout", "15s", process.execPath, join(directory, "main.mjs")], {
    cwd: directory,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  assert.equal(exitCode, 0, stderr);
  const results = stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(results, [
    { name: "outside-main-agent-home", defaultType: "function" },
    { name: "outside-worker-agent-home", defaultType: "function" },
  ]);
  process.stdout.write(stdout);
} finally {
  await rm(directory, { recursive: true, force: true });
}
