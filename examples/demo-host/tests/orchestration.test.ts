import { afterAll, beforeAll, expect, test } from "bun:test";
import { applyPatch, type UiNode } from "@arnilo/liveframe";
import { type Browser, chromium } from "playwright";
import { startHost } from "../server.ts";
import { readWidget } from "../widgets/draft.ts";
import {
  cleanup,
  client,
  find,
  frames,
  type Host,
  last,
  offeredIntent,
  type Snapshot,
  settled,
  tempDir,
} from "./host.ts";

// The host in server.ts is the example outsiders copy: it keeps only transport and its own resolver, authoriser and
// dispatcher, and lets `renderPlacement`, `handleIntent` and `dependents` fix the order of everything else.
let dir: string;
let host: Host;
let api: ReturnType<typeof client>;
let browser: Browser | undefined;
const dirOf = (name: string) => new URL(`../widgets/${name}/`, import.meta.url).pathname;
const queue = { id: "queue", version: "1.0.0" };
const detail = { id: "detail", version: "1.0.0" };
const origin = (snapshot: Snapshot, nodeId: string, event = "onPress") => ({
  surfaceId: snapshot.tree.surfaceId,
  revision: snapshot.tree.revision,
  nodeId,
  event,
});
const press = (id: string, snapshot: Snapshot, nodeId: string, accepted?: Record<string, number>) =>
  api.intent(id, offeredIntent(snapshot, nodeId, "onPress"), origin(snapshot, nodeId), accepted);
const texts = (root: UiNode): string[] => [
  ...(root.kind === "text" || root.kind === "hint" ? [String(root.props.text)] : []),
  ...(root.children ?? []).flatMap(texts),
];

beforeAll(async () => {
  dir = await tempDir();
  host = await startHost({ dataDir: dir, port: 0 });
  api = client(host);
  expect((await api.install(await readWidget(dirOf("queue")))).status).toBe(201);
  expect((await api.install(await readWidget(dirOf("detail")))).status).toBe(201);
});
afterAll(async () => {
  await browser?.close();
  await host.stop();
  await cleanup(dir);
});

test("demo_skips_unchanged_render", async () => {
  await api.place("skip", { pageSize: 3 }, queue);
  const first = await api.surface("skip");
  const again = await api.surface("skip");
  // Same inputs, same surface: the host gets the last frame back, and no runner ran.
  expect(again.revision).toBe(first.revision);
  expect(again.tree).toEqual(first.tree);
  expect(host.events.filter((event) => event.type === "render-skipped" && event.placementId === "skip")).toHaveLength(
    1,
  );
});

test("demo_patch_and_stale_fallback", async () => {
  await api.place("paged", { pageSize: 3 }, queue);
  const first = await api.surface("paged");
  expect(texts(first.tree.root)).toContain("Review the release notes");

  // A client that holds the served revision gets a patch, and the patched tree is the tree a fresh load gets.
  const next = await frames(await press("paged", first, "root/inline/next", { paged: first.revision }));
  const patched = next.at(-1);
  expect(patched?.tree).toBeUndefined();
  expect(patched?.patch?.base).toBe(first.revision);
  if (!patched?.patch) throw new Error("Expected a patch");
  const applied = applyPatch(first.tree, patched.patch);
  if (!applied.ok) throw new Error("The patch does not apply");
  const fresh = await api.surface("paged");
  expect(applied.value).toEqual(fresh.tree);
  expect(texts(fresh.tree.root)).toContain("Pair on the importer");
  expect(texts(fresh.tree.root)).not.toContain("Review the release notes");

  // A client at another revision gets the whole tree, never a patch it cannot apply.
  const stale = await frames(await press("paged", fresh, "root/inline/previous", { paged: first.revision }));
  expect(stale.at(-1)?.patch).toBeUndefined();
  expect(stale.at(-1)?.tree?.revision).toBe(fresh.revision + 1);
  // The same holds when a client fetches again: a patch for its base, a whole tree otherwise.
  expect((await api.refetch("paged", fresh.revision)).tree).toBeUndefined();
  expect((await api.refetch("paged", 1)).tree).toBeDefined();
});

test("demo_claim_pending_then_ok", async () => {
  await api.place("claims", { pageSize: 3 }, queue);
  const before = await api.surface("claims");
  expect(find(before.tree.root, "root/t1/claim")?.props).toMatchObject({ label: "Claim" });

  const sent = settled(await frames(await press("claims", before, "root/t1/claim")));
  // Other placements that list tasks are refreshed after the acting one: their frames come last.
  const claimed = sent.filter((entry) => entry.placement === "claims");
  expect(sent.at(-1)?.placement).not.toBe("claims");
  // The widget first sees `pending`, then the result the host recorded (spec §8).
  expect(claimed.length).toBeGreaterThanOrEqual(2);
  const [pending, done] = [claimed[0], claimed.at(-1)];
  expect(pending && find(pending.tree.root, "root/t1/claim")?.props).toMatchObject({
    label: "Claiming…",
    disabled: true,
  });
  expect(done && texts(done.tree.root)).toContain("Claimed by ada");
  expect(host.actions).toContainEqual({ placement: "claims", name: "tasks.claim", args: { id: "t1" } });

  // The claim button is gone, so repeating the intent is not something the tree offers.
  const repeated = await api.intent("claims", offeredIntent(before, "root/t1/claim", "onPress"), {
    ...origin(before, "root/t1/claim"),
    revision: done?.tree.revision ?? 0,
  });
  expect(repeated.status).toBe(400);
  expect(host.actions.filter((entry) => entry.name === "tasks.claim")).toHaveLength(1);
});

test("demo_selection_coordinates_placements", async () => {
  await api.place("list", { pageSize: 3 }, queue);
  await api.place("panel", {}, detail);
  const list = await api.surface("list");
  const panel = await api.surface("panel");
  expect(texts(panel.tree.root)).toContain("Nothing selected");

  // Selecting in the list changes `selection.current`; the host asks `dependents` who reads it and re-renders them.
  const selected = settled(await frames(await press("list", list, "root/t2/select")));
  const refreshed = selected.filter((entry) => entry.placement === "panel");
  expect(refreshed).toHaveLength(1);
  expect(refreshed[0] && texts(refreshed[0].tree.root)).toContain("Reply to the design thread");
  expect(refreshed[0] && texts(refreshed[0].tree.root)).toContain("Not claimed yet");

  // Claiming the selected task changes what the detail shows too.
  const claim = await last(
    await press("list", selected.findLast((entry) => entry.placement === "list") as Snapshot, "root/t2/claim"),
  );
  expect(texts(claim.tree.root)).toContain("Claimed by ada");
  expect(texts((await api.surface("panel")).tree.root)).toContain("Claimed by ada");
});

async function open(placements: string[]) {
  browser ??= await chromium.launch();
  const page = await browser.newPage();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") requests.push(request.url());
  });
  await page.goto(new URL(`/?${placements.map((id) => `placement=${id}`).join("&")}`, host.url).href);
  await page.waitForSelector("html[data-ready='true']", { timeout: 15000 });
  return { page, requests };
}

test("demo_filter_sends_no_request", async () => {
  await api.place("filtered", { pageSize: 5 }, queue);
  const { page, requests } = await open(["filtered"]);
  try {
    await page.getByText("Review the release notes").waitFor({ timeout: 15000 });
    await page.getByLabel("Filter this page").fill("importer");
    await page.keyboard.press("Enter");
    // The rows are already in the tree: the renderer hides the others from its local state.
    await page.getByText("Review the release notes").waitFor({ state: "detached", timeout: 15000 });
    expect(await page.getByText("Pair on the importer").isVisible()).toBe(true);
    expect(requests).toEqual([]);
  } finally {
    await page.close();
  }
}, 60000);

test("demo_page_follows_a_selection", async () => {
  await api.place("left", { pageSize: 5 }, queue);
  await api.place("right", {}, detail);
  const { page, requests } = await open(["left", "right"]);
  try {
    await page.getByRole("button", { name: "Select" }).nth(2).click();
    // The detail placement draws the task the list selected, with no widget-to-widget channel.
    await page.getByText("Triage new issues").nth(1).waitFor({ timeout: 15000 });
    expect(await page.getByText("Triage new issues").count()).toBe(2);
    expect(requests.filter((url) => url.endsWith("/placements/left/intents"))).toHaveLength(1);
  } finally {
    await page.close();
  }
}, 60000);
