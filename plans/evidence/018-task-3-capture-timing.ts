/** Regenerate: timeout 120s bun --conditions liveframe:source plans/evidence/018-task-3-capture-timing.ts */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as playwright from "playwright";
import { capture } from "../../src/cli/capture.ts";
import { startHost } from "../../proof/host/server.ts";

// Pin the pre-extraction implementation so the comparison remains reproducible.
const baseline = Bun.spawnSync(["git", "show", "bf7208eecc1ee450b5e788098ffb0cade3e73010:src/cli/capture.ts"], {
  stdout: "pipe",
  stderr: "pipe",
});
if (baseline.exitCode !== 0) throw new Error(baseline.stderr.toString());
const dir = await mkdtemp(join(tmpdir(), "lf-capture-timing-"));
await Bun.write(join(dir, "baseline.ts"), baseline.stdout);
const { capture: before } = await import(join(dir, "baseline.ts"));
const host = await startHost(0);
try {
  for (const [name, run] of [
    ["before", before],
    ["after", capture],
    ["before", before],
    ["after", capture],
  ] as const) {
    const start = performance.now();
    const index = await run(
      `${host.url}preview`,
      { out: join(dir, name), scenarios: ["ready"], widths: [360, 768] },
      async () => playwright,
    );
    if (index.cells.length !== 8) throw new Error("Expected eight captured cells");
    console.log(`${name}: ${(performance.now() - start).toFixed(2)} ms, ${index.cells.length} cells`);
  }
} finally {
  await host.stop(true);
  await rm(dir, { recursive: true, force: true });
}
