import { afterAll, beforeAll, expect, test } from "bun:test";
import type { UiNode } from "@arnilo/liveframe";
import { startHost } from "../server.ts";
import { readWidget } from "../widgets/draft.ts";
import { cleanup, client, type Host, tempDir } from "./host.ts";

// A shared component library, content-addressed: two widgets pin `acme.cards@1.0.0` by hash. A new library
// version reaches them through `rebindDependencies` (a new widget version, no source, no transpile).
let dir: string;
let host: Host;
let api: ReturnType<typeof client>;
const dirOf = (name: string) => new URL(`../widgets/${name}/`, import.meta.url).pathname;
const texts = (root: UiNode): string[] => [
  ...(root.kind === "text" || root.kind === "heading" ? [String(root.props.text)] : []),
  ...(root.children ?? []).flatMap(texts),
];
const shown = async (id: string) => texts((await api.surface(id)).tree.root);

/** Library 1.1.0: the same component, changed in one place. */
async function newerCards() {
  const draft = await readWidget(dirOf("cards"));
  if (!("files" in draft)) throw new Error("Expected a code draft");
  const entry = draft.files["entry.tsx"] as string;
  const changed = entry.replace("text={detail}", 'text={"v2: " + detail}');
  if (changed === entry) throw new Error("The library source changed shape");
  return {
    ...draft,
    files: { ...draft.files, "entry.tsx": changed },
    manifest: { ...draft.manifest, version: "1.1.0" },
  };
}

beforeAll(async () => {
  dir = await tempDir();
  host = await startHost({ dataDir: dir, port: 0 });
  api = client(host);
});
afterAll(async () => {
  await host.stop();
  await cleanup(dir);
});

test("demo_rebinds_shared_library", async () => {
  // A widget that imports a library nobody installed does not pack.
  const early = await api.install(await readWidget(dirOf("welcome")));
  expect(early.status).toBe(422);
  expect(await early.text()).toContain("not-found");

  for (const name of ["cards", "welcome", "summary"])
    expect((await api.install(await readWidget(dirOf(name)))).status).toBe(201);
  expect((await api.place("hi", { name: "Ada" }, { id: "welcome", version: "1.0.0" })).status).toBe(200);
  expect((await api.place("sum", { open: 3 }, { id: "summary", version: "1.0.0" })).status).toBe(200);
  const before = [...(await shown("hi")), ...(await shown("sum"))];
  expect(before).toContain("Welcome, Ada");
  expect(before).toContain("3 open tasks");
  expect(before.some((text) => text.startsWith("v2:"))).toBe(false);

  // The library gets a new version. Nothing already placed changes: pins are hashes.
  expect((await api.install(await newerCards())).status).toBe(201);
  expect((await shown("hi")).some((text) => text.startsWith("v2:"))).toBe(false);

  // Both widgets move to it without repacking their source.
  const moved = { version: "1.0.1", libraries: [{ id: "acme.cards", version: "1.1.0" }] };
  const hello = await api.rebind("welcome", "1.0.0", moved);
  const summary = await api.rebind("summary", "1.0.0", moved);
  expect([hello.status, summary.status]).toEqual([201, 201]);
  const hashes = [(await hello.json()) as { hash: string }, (await summary.json()) as { hash: string }];
  expect(hashes[0]?.hash).not.toBe(hashes[1]?.hash);
  expect((await api.rebind("welcome", "1.0.0", moved)).status).toBe(201); // the same rebind again is the same package

  expect((await api.place("hi", { name: "Ada" }, { id: "welcome", version: "1.0.1" })).status).toBe(200);
  expect((await api.place("sum", { open: 3 }, { id: "summary", version: "1.0.1" })).status).toBe(200);
  const after = [...(await shown("hi")), ...(await shown("sum"))];
  expect(after).toContain("v2: This card comes from the shared acme.cards library");
  expect(after).toContain("v2: The same card, in a second widget");

  // A library version that is not installed cannot be rebound to.
  expect(
    (await api.rebind("welcome", "1.0.0", { version: "1.0.2", libraries: [{ id: "acme.cards", version: "9.9.9" }] }))
      .status,
  ).toBe(404);
});
