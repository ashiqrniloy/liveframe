import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as liveframe from "@arnilo/liveframe";
import { assertSelfContained } from "../../scripts/release/bundle-check.ts";
import catalog from "../../conformance/corpus/common/proof-catalog.json" with { type: "json" };
import capabilities from "../../conformance/corpus/common/capabilities.json" with { type: "json" };
import manifest from "../../conformance/corpus/common/manifest.json" with { type: "json" };
import tree from "../../conformance/corpus/ui-tree/docs/valid.json" with { type: "json" };

const root = new URL("../../", import.meta.url).pathname;
const bundle = join(root, "dist/validator.bundle.js");

test("validator_bundle_is_self_contained", async () => {
  assertSelfContained(await Bun.file(bundle).text());
  expect(Object.keys(await import(bundle)).sort()).toEqual(Object.keys(liveframe).sort());
});

test("validator_bundle_omits_the_render_path", async () => {
  const names = Object.keys(await import(bundle));
  for (const name of ["renderModule", "render", "linkPackage"]) expect(names).not.toContain(name);
});

test("validator_bundle_validates_under_bare_vm", async () => {
  const node = Bun.which("node");
  if (!node) throw new Error("Node is required for the bare VM validator test");
  const validator = liveframe.compileValidator({ catalog, capabilities, manifest });
  const origin = { surfaceId: tree.surfaceId, revision: tree.revision, nodeId: "root/button", event: "onPress" };
  const intent = { type: "action", name: "tasks.claim", args: { id: "task:1" } } as const;
  const validated = validator.validateTree(tree);
  if (!validated.ok) throw new Error(JSON.stringify(validated.errors));
  const accepted = liveframe.checkOffered(validated.value, origin, intent, validator);
  const forged = liveframe.checkOffered(validated.value, { ...origin, revision: 0 }, intent, validator);
  expect(accepted.ok).toBe(true);
  expect(forged.ok).toBe(false);
  const dir = await mkdtemp(join(tmpdir(), "liveframe-validator-"));
  try {
    const request = join(dir, "request.json");
    await Bun.write(request, JSON.stringify({ catalog, capabilities, manifest, tree, origin, intent }));
    const proc = Bun.spawnSync(
      [
        node,
        "--experimental-vm-modules",
        "--no-warnings",
        join(root, "scripts/release/fixtures/vm-validator.mjs"),
        bundle,
        request,
      ],
      { stdout: "pipe", stderr: "pipe", timeout: 30_000 },
    );
    if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
    expect(JSON.parse(proc.stdout.toString())).toEqual(JSON.parse(JSON.stringify({ validated, accepted, forged })));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
