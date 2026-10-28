import { afterAll, beforeAll, expect, test } from "bun:test";
import { startHost } from "../server.ts";
import { cleanup, client, find, hello, offeredIntent, tempDir } from "./host.ts";

let dir: string;
beforeAll(async () => {
  dir = await tempDir();
});
afterAll(() => cleanup(dir));

const strip = (tree: { revision: number }) => ({ ...tree, revision: 0 });

test("state_survives_restart", async () => {
  const first = await startHost({ dataDir: dir, port: 0 });
  const api = client(first);
  expect((await api.install(await hello())).status).toBe(201);
  expect((await api.place("home", { name: "Ada" })).status).toBe(200);
  const initial = await api.surface("home");
  expect(find(initial.tree.root, "root/heading")?.props).toMatchObject({ text: "Hello, Ada" });
  const pressed = await api.intent("home", offeredIntent(initial, "root/press", "onPress"), {
    surfaceId: initial.tree.surfaceId,
    revision: initial.tree.revision,
    nodeId: "root/press",
    event: "onPress",
  });
  expect(pressed.status).toBe(200);
  const before = (await pressed.json()) as Awaited<ReturnType<typeof api.surface>>;
  expect(find(before.tree.root, "root/text")?.props).toMatchObject({ text: "Pressed 1 times" });
  await first.stop();

  const second = await startHost({ dataDir: dir, port: 0 });
  try {
    const after = await client(second).surface("home");
    expect(strip(after.tree)).toEqual(strip(before.tree));
    expect(find(after.tree.root, "root/text")?.props).toMatchObject({ text: "Pressed 1 times" });
  } finally {
    await second.stop();
  }
});

test("a_version_cannot_change_content", async () => {
  const host = await startHost({ dataDir: dir, port: 0 });
  try {
    const api = client(host);
    const changed = await hello();
    changed.files["entry.tsx"] = `${changed.files["entry.tsx"]}\n// changed`;
    expect((await api.install(changed)).status).toBe(409);
    expect((await api.install(await hello())).status).toBe(201);
  } finally {
    await host.stop();
  }
});

test("a_placement_needs_an_installed_widget_and_valid_params", async () => {
  const host = await startHost({ dataDir: await tempDir(), port: 0 });
  try {
    const api = client(host);
    expect((await api.place("home", { name: "Ada" })).status).toBe(404);
    await api.install(await hello());
    expect((await api.place("home", { name: 3 })).status).toBe(422);
    expect((await api.place("home", { name: "Ada" })).status).toBe(200);
  } finally {
    await host.stop();
  }
});
