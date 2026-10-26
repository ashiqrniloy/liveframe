import { afterAll, beforeAll, expect, test } from "bun:test";
import { startHost } from "../server.ts";
import { cleanup, client, find, type Host, hello, offeredIntent, tempDir } from "./host.ts";

let dir: string;
let host: Host;
let api: ReturnType<typeof client>;
beforeAll(async () => {
  dir = await tempDir();
  host = await startHost({ dataDir: dir, port: 0 });
  api = client(host);
  await api.install(await hello());
  await api.place("home", { name: "Ada" });
});
afterAll(async () => {
  await host.stop();
  await cleanup(dir);
});

test("intents_are_rechecked_before_dispatch", async () => {
  const snapshot = await api.surface("home");
  const refused: unknown[] = [
    // An action the widget never declared, even though the host has an operation for another name.
    { type: "action", name: "demo.delete", args: {} },
    // A declared action with arguments the tree did not offer.
    { type: "action", name: "demo.notify", args: { message: "something else" } },
    // A state value the tree did not offer.
    { type: "setState", key: "count", value: 99 },
    // A state key the manifest does not declare.
    { type: "setState", key: "admin", value: true },
    { type: "other" },
  ];
  for (const intent of refused) expect((await api.intent("home", intent)).status).toBe(400);
  expect(host.actions).toEqual([]);

  const allowed = await api.intent("home", offeredIntent(snapshot, "root/notify", "onPress"));
  expect(allowed.status).toBe(200);
  expect(host.actions).toEqual([{ placement: "home", name: "demo.notify", args: { message: "Hello from Ada" } }]);
  const body = (await allowed.json()) as Awaited<ReturnType<typeof api.surface>>;
  expect(body.actions).toHaveLength(1);
});

test("no_draft_code_reaches_the_page", async () => {
  const snapshot = await api.surface("home");
  const bundle = await (await fetch(new URL("/client.js", host.url))).text();
  // Widget strings exist only in the widget's source and in the tree it renders on the server.
  expect(bundle).not.toContain("Notify asks the host");
  expect(bundle).not.toContain("Hello from");
  expect(JSON.stringify(snapshot)).not.toMatch(/export default|jsxDEV|=>/);
  expect(find(snapshot.tree.root, "root/heading")).toBeDefined();
});
