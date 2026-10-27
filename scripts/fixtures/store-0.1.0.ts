import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Regenerate with: bun scripts/fixtures/store-0.1.0.ts (requires the v0.1.0 git tag).
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(root, "src/__tests__/fixtures/store-0.1.0");
const snapshot = await mkdtemp(join(tmpdir(), "liveframe-0.1.0-"));
function run(cmd: string[]) {
  const result = Bun.spawnSync(["timeout", "30s", ...cmd], { cwd: root, stderr: "inherit" });
  assert.equal(result.exitCode, 0, `Failed: ${cmd.join(" ")}`);
}
try {
  run(["git", "archive", "--format=tar", `--output=${snapshot}/source.tar`, "v0.1.0", "src"]);
  run(["tar", "-xf", join(snapshot, "source.tar"), "-C", snapshot]);
  await symlink(join(root, "node_modules"), join(snapshot, "node_modules"), "dir");
  const { fileStore } = await import(join(snapshot, "src/store/fs/index.ts"));
  const { storeFixture } = await import(join(snapshot, "src/conformance/fixture.ts"));
  const { pkg, placement, style } = storeFixture();
  await rm(output, { recursive: true, force: true });
  const store = fileStore(output);
  await store.putPackage(pkg);
  await store.putPlacement(placement);
  await store.putState(placement.id, { count: 7 });
  await store.putStyle(style);
  assert.deepEqual(await fileStore(output).getState(placement.id), { count: 7 });
} finally {
  await rm(snapshot, { recursive: true, force: true });
}
