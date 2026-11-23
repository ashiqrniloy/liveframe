import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { chunksOf, streamLoopDocument, streamLoopValidator } from "../src/__tests__/fixtures/stream-loop.ts";
import { applyPatch, diffTrees, type UiTree } from "../src/index.ts";
import { streamElements } from "../src/sdk/stream.ts";
import { metric } from "./metrics.ts";

// The documented streaming loop end to end (plan 042 Task 4, LF-36): host `streamElements` and `diffTrees`,
// client `applyPatch` and arrival validation, over generated documents in 4-character chunks fed as fast as
// the host reads them. Informational in 0.4.1: plan 046 adds the gate (4,003 nodes under 500 ms, patch bytes
// under 1.5 times the document).
const CHUNK = 4;
const FRAME_MS = 16;
const validator = streamLoopValidator;

type Totals = { host: number; client: number; updates: number; bytes: number };

/** The loop of `docs/sdk.md` "Draw agent JSON while it streams"; `frameMs` 0 is the 0.4.0 loop (one update per tree). */
function streamLoop(chunks: readonly string[], frameMs: number): Totals {
  const totals: Totals = { host: 0, client: 0, updates: 0, bytes: 0 };
  let client: UiTree | undefined;
  const send = (message: { tree?: UiTree; patch?: unknown }) => {
    const text = JSON.stringify(message);
    const start = performance.now();
    const arrived = JSON.parse(text) as typeof message;
    const tree = arrived.tree ?? (client && applyPatch(client, arrived.patch));
    const next = tree && "ok" in tree ? (tree.ok ? tree.value : undefined) : tree;
    assert(next && validator.validateTree(next).ok, "the client must accept every update");
    client = next;
    totals.client += performance.now() - start;
    totals.updates++;
    totals.bytes += text.length;
  };
  const start = performance.now();
  const stream = streamElements({ validator, surfaceId: "bench" });
  let latest: UiTree | undefined;
  let shown: UiTree | undefined;
  let sentAt = Number.NEGATIVE_INFINITY;
  // The host's clock leaves out the client's time: the client runs on another machine.
  const flush = () => {
    if (!latest || latest === shown) return;
    const patch = shown && diffTrees(shown, latest);
    send(patch?.ok ? { patch: patch.value } : { tree: latest });
    shown = latest;
    sentAt = performance.now() - totals.client;
  };
  for (const chunk of chunks) {
    const next = stream.push(chunk);
    if (!next) continue;
    assert(next.ok);
    latest = next.value;
    if (performance.now() - totals.client - sentAt >= frameMs) flush();
  }
  const final = stream.end();
  assert(final.ok);
  send({ tree: final.value });
  totals.host = performance.now() - start - totals.client;
  return totals;
}

const warm = chunksOf(JSON.stringify(streamLoopDocument(50)), CHUNK);
console.log(`Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; load ${loadavg().join(", ")}`);
for (const rows of [1_000, 4_000]) {
  const nodes = rows + 3;
  const text = JSON.stringify(streamLoopDocument(rows));
  const chunks = chunksOf(text, CHUNK);
  for (const [name, frameMs] of [
    ["perTree", 0],
    ["coalesced", FRAME_MS],
  ] as const) {
    streamLoop(warm, frameMs);
    const { host, client, updates, bytes } = streamLoop(chunks, frameMs);
    const key = `streamLoop.${name}.${nodes}`;
    metric(`${key}.totalMs`, host + client);
    metric(`${key}.hostMs`, host);
    metric(`${key}.clientMs`, client);
    metric(`${key}.updates`, updates);
    metric(`${key}.patchBytesRatio`, bytes / text.length);
    console.log(
      `${name} loop, ${nodes} nodes (${text.length} chars, ${chunks.length} chunks): ${(host + client).toFixed(1)} ms ` +
        `(host ${host.toFixed(1)}, client ${client.toFixed(1)}); ${updates} updates; ` +
        `sent ${(bytes / text.length).toFixed(2)}× the document`,
    );
  }
}
