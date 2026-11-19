import { afterAll, beforeAll, expect, test } from "bun:test";
import type { UiNode } from "@arnilo/liveframe";
import { startHost } from "../server.ts";
import { readWidget } from "../widgets/draft.ts";
import { cleanup, client, frames, type Host, offeredIntent, settled, tempDir } from "./host.ts";

// A slow source answers `pending` first; the widget draws a placeholder, and the host renders it again when the
// value lands (spec §7.1, §7.7). The library keeps no timer or queue: `server.ts` owns the wait and the transport.
let dir: string;
let host: Host;
let api: ReturnType<typeof client>;
const dirOf = (name: string) => new URL(`../widgets/${name}/`, import.meta.url).pathname;
const texts = (root: UiNode): string[] => [
  ...(root.kind === "text" || root.kind === "hint" ? [String(root.props.text)] : []),
  ...(root.children ?? []).flatMap(texts),
];
const surface = async (id: string) => settled(await frames(await fetch(new URL(`/surfaces/${id}`, host.url))));

beforeAll(async () => {
  dir = await tempDir();
  host = await startHost({ dataDir: dir, port: 0, digestMs: 20 });
  api = client(host);
  expect((await api.install(await readWidget(dirOf("digest")))).status).toBe(201);
  expect((await api.install(await readWidget(dirOf("queue")))).status).toBe(201);
});
afterAll(async () => {
  await host.stop();
  await cleanup(dir);
});

test("demo_pending_source_draws_a_placeholder_then_the_value", async () => {
  await api.place("digest", {}, { id: "digest", version: "1.0.0" });
  const sent = await surface("digest");
  expect(sent.map((frame) => frame.placement)).toEqual(["digest", "digest"]);
  const [first, second] = sent;
  expect(first && texts(first.tree.root)).toEqual(["Counting…"]);
  expect(second && texts(second.tree.root)).toEqual(["12 of 12 tasks open"]);
  expect(second?.revision).toBe((first?.revision ?? 0) + 1);
  expect(host.events).toContainEqual({
    type: "source-pending",
    placementId: "digest",
    alias: "digest",
    source: "tasks.digest",
  });

  // The value is cached: a later load is one frame, and the render is skipped.
  const again = await surface("digest");
  expect(again).toHaveLength(1);
  expect(again[0]?.revision).toBe(second?.revision);
});

test("demo_action_marks_the_slow_source_stale_and_it_settles_again", async () => {
  await api.place("list", { pageSize: 3 }, { id: "queue", version: "1.0.0" });
  const [list] = await surface("list");
  if (!list) throw new Error("Expected the list");
  const nodeId = "root/t1/claim";
  const origin = { surfaceId: list.tree.surfaceId, revision: list.tree.revision, nodeId, event: "onPress" };
  // No revisions held, so each placement's first frame is a whole tree and later ones patch it.
  const sent = settled(await frames(await api.intent("list", offeredIntent(list, nodeId, "onPress"), origin)));
  const digests = sent.filter((frame) => frame.placement === "digest").map((frame) => texts(frame.tree.root));
  expect(digests).toEqual([["Counting…"], ["11 of 12 tasks open"]]);
});
