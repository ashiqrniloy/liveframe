import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Intent, IntentOrigin, UiNode, UiTree } from "@arnilo/liveframe";
import type { startHost } from "../server.ts";
import { readDraft } from "../widgets/draft.ts";

export type Snapshot = { tree: UiTree; manifest: unknown; actions: { name: string; args: unknown }[] };
export type Host = Awaited<ReturnType<typeof startHost>>;

export const hello = () => readDraft(new URL("../widgets/hello/", import.meta.url).pathname);

export async function tempDir() {
  return mkdtemp(join(tmpdir(), "liveframe-demo-"));
}
export const cleanup = (dir: string) => rm(dir, { recursive: true, force: true });

export function client(host: Host) {
  const send = (path: string, method: string, body?: unknown) =>
    fetch(new URL(path, host.url), {
      method,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  return {
    install: (draft: unknown) => send("/widgets", "POST", draft),
    place: (id: string, params: unknown, widget = { id: "hello", version: "1.0.0" }) =>
      send(`/placements/${id}`, "PUT", { slot: "home.main", widget, params }),
    surface: async (id: string) => (await send(`/surfaces/${id}`, "GET")).json() as Promise<Snapshot>,
    intent: (id: string, intent: unknown, origin: IntentOrigin) =>
      send(`/placements/${id}/intents`, "POST", { intent, origin }),
  };
}

export function find(node: UiNode, id: string): UiNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** The intent a node offers for an event, as the browser would send it. */
export function offeredIntent(snapshot: Snapshot, nodeId: string, event: string): Intent {
  const intent = find(snapshot.tree.root, nodeId)?.events?.[event];
  if (!intent) throw new Error(`${nodeId} offers no ${event}`);
  return intent;
}
