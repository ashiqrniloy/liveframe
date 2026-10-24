import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drafts } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { capture } from "../../src/cli/capture.ts";
import { startHost } from "../host/server.ts";

let server: Awaited<ReturnType<typeof startHost>>;
beforeAll(async () => {
  server = await startHost(0);
}, 30000);
afterAll(async () => {
  await server?.stop(true);
});

// The agent sees only what the host and the CLI give it: the preview page, its draft/publish routes and capture().
const marker = "DraftOnlyMarker7f3a";
const baseDraft = drafts[0] as (typeof drafts)[0] & { files: Record<string, string> };
const queue = baseDraft.files["agent-home/queue.tsx"] ?? "";
const draftWith = (gap: string) => ({
  ...baseDraft,
  files: {
    ...baseDraft.files,
    "agent-home/queue.tsx": `${queue.replace('<Stack gap="space.3">', `<Stack gap="${gap}">`)}\nexport const ${marker} = 1;\n`,
  },
});

test("scripted_agent_fixes_a_layout_error_from_its_capture_and_publishes_the_previewed_hash", async () => {
  const start = performance.now();
  const out = await mkdtemp(join(tmpdir(), "liveframe-agent-"));
  try {
    const session = /"session":"([^"]+)"/.exec(await (await fetch(`${server.url}preview`)).text())?.[1];
    const url = `${server.url}preview?session=${session}`;
    const post = async (route: string, body?: unknown) =>
      (
        await fetch(`${server.url}preview/${route}?session=${session}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        })
      ).json();
    const lawOne = async () => {
      const html = await (await fetch(url)).text();
      const bundle = await (await fetch(`${server.url}preview-client.js`)).text();
      expect(html).not.toContain(marker);
      expect(bundle).not.toContain(marker);
    };

    // 1–2. A deliberate error is captured with its node, pointer and a PNG.
    expect((await post("draft", draftWith("space.99"))).ok).toBe(true);
    const broken = await capture(url, { out, scenarios: ["ready"], widths: [360] });
    const error = broken.cells[0]?.errors[0];
    expect(error).toMatchObject({ kind: "invalid-prop", nodeId: "root/stack", pointer: "/root/stack/style/gap" });
    expect(broken.cells.every((cell) => cell.errors.length > 0)).toBe(true);
    expect(await Bun.file(join(out, broken.cells[0]?.png ?? "missing")).exists()).toBe(true);
    await lawOne();

    // 3. The fix comes from the error alone: it lists the allowed values.
    const allowed = /one of: (.+)$/.exec(error?.expected ?? "")?.[1]?.split(", ") ?? [];
    expect(allowed.length).toBeGreaterThan(0);
    const fixed = await post("draft", draftWith(allowed[3] ?? ""));
    expect(fixed.ok).toBe(true);

    // 4. The next capture is clean.
    const clean = await capture(url, { out, scenarios: ["ready"], widths: [360] });
    expect(clean.cells.length).toBeGreaterThan(0);
    expect(clean.cells.every((cell) => cell.errors.length === 0)).toBe(true);
    await lawOne();

    // 5. Publishing stores the package the clean draft returned.
    expect((await post("publish")).hash).toBe(fixed.hash);
    console.log(`scripted agent loop: ${(performance.now() - start).toFixed(0)} ms`);
  } finally {
    await rm(out, { recursive: true });
  }
}, 120000);
