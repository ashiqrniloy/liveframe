import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyPatch,
  type Intent,
  type IntentOrigin,
  type TreePatch,
  type UiNode,
  type UiTree,
} from "@arnilo/liveframe";
import type { startHost } from "../server.ts";
import { readDraft } from "../widgets/draft.ts";

export type Snapshot = {
  placement: string;
  revision: number;
  tree: UiTree;
  manifest: unknown;
  actions: { name: string; args: unknown }[];
};
/** A frame the server sent: a whole tree, or a patch for a client that holds its base. */
export type Frame = Omit<Snapshot, "tree"> & { tree?: UiTree; patch?: TreePatch; error?: string };
export type Host = Awaited<ReturnType<typeof startHost>>;

/** Every frame of an intent's answer, in the order the host sent them. */
export async function frames(response: Response): Promise<Frame[]> {
  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Frame);
}
/**
 * The frames with every patch applied, as a client that accepts each one would hold them. A frame after the first of a
 * placement is a patch against the one before it, so a test that wants whole trees resolves the stream.
 */
export function settled(sent: readonly Frame[]): Snapshot[] {
  const held = new Map<string, UiTree>();
  return sent.map((frame) => {
    let tree = frame.tree;
    if (!tree) {
      const base = held.get(frame.placement);
      const applied = base && frame.patch ? applyPatch(base, frame.patch) : undefined;
      if (!applied?.ok) throw new Error(`Frame for ${frame.placement} has neither a tree nor a patch that applies`);
      tree = applied.value;
    }
    held.set(frame.placement, tree);
    return { ...frame, tree } as Snapshot;
  });
}
/** The frame an intent settled on, as a whole tree. */
export async function last(response: Response): Promise<Snapshot> {
  const final = settled(await frames(response)).at(-1);
  if (!final) throw new Error("The host sent no frame");
  return final;
}

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
    /** A new version of an installed widget on new versions of the libraries it pins; no source is sent. */
    rebind: (id: string, version: string, body: { version: string; libraries: { id: string; version: string }[] }) =>
      send(`/widgets/${id}/${version}/rebind`, "POST", body),
    surface: async (id: string) => (await send(`/surfaces/${id}`, "GET")).json() as Promise<Snapshot>,
    /** A client that holds `base` may get a patch instead of the whole tree. */
    refetch: async (id: string, base: number) =>
      (await send(`/surfaces/${id}?base=${base}`, "GET")).json() as Promise<Frame>,
    /** `accepted` names the revisions the client holds, so the host may answer with a patch for each. */
    intent: (id: string, intent: unknown, origin: IntentOrigin, accepted?: Record<string, number>) =>
      send(`/placements/${id}/intents`, "POST", { intent, origin, ...(accepted ? { accepted } : {}) }),
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
  // A `setLocal` event is the renderer's own write and never leaves the browser.
  if (!intent || intent.type === "setLocal") throw new Error(`${nodeId} offers no ${event}`);
  return intent;
}
