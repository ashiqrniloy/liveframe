import { afterAll, beforeAll, expect, test } from "bun:test";
import type { UiNode } from "@arnilo/liveframe";
import { startHost } from "../server.ts";
import { readTemplateDraft } from "../widgets/draft.ts";
import { cleanup, client, find, last, offeredIntent, tempDir } from "./host.ts";

let dir: string;
beforeAll(async () => {
  dir = await tempDir();
});
afterAll(() => cleanup(dir));

const v1 = { id: "tasks", version: "1.0.0" };
const v2 = { id: "tasks", version: "1.1.0" };
const titles = (root: UiNode) =>
  (root.children ?? []).filter((node) => node.kind === "text").map((node) => node.props.text);

/**
 * Version 1.1.0 of the `tasks` template: the page counter is renamed `pageIndex`, and `migrateState` says where the
 * old value goes. The template changes only where it names the key; nothing else about the widget moves.
 */
async function upgraded() {
  const draft = await readTemplateDraft(new URL("../widgets/tasks/", import.meta.url).pathname);
  const rename = (text: string) =>
    text.replaceAll('"state.page"', '"state.pageIndex"').replaceAll('"page"', '"pageIndex"');
  const manifest = JSON.parse(rename(JSON.stringify(draft.manifest)));
  return {
    ...draft,
    scenarios: JSON.parse(rename(JSON.stringify(draft.scenarios))),
    template: JSON.parse(rename(JSON.stringify(draft.template))),
    manifest: { ...manifest, version: v2.version, migrateState: { pageIndex: { $path: "previous.page" } } },
  };
}

test("demo_upgrade_migrates_state_instead_of_resetting", async () => {
  const host = await startHost({ dataDir: dir, port: 0 });
  const api = client(host);
  try {
    expect(
      (await api.install(await readTemplateDraft(new URL("../widgets/tasks/", import.meta.url).pathname))).status,
    ).toBe(201);
    expect((await api.place("list", { pageSize: 5 }, v1)).status).toBe(200);
    const first = await api.surface("list");
    const next = offeredIntent(first, "root/next", "onPress");
    const origin = {
      surfaceId: first.tree.surfaceId,
      revision: first.tree.revision,
      nodeId: "root/next",
      event: "onPress",
    };
    const second = await last(await api.intent("list", next, origin));
    expect(find(second.tree.root, "root/range")?.props).toMatchObject({ text: "Showing 6 to 10 of 12" });

    // Place the same list on 1.1.0: the stored `{ page: 1 }` no longer fits, and the manifest says how to carry it.
    const installed = await api.install(await upgraded());
    expect(await installed.clone().text()).toContain("1.1.0");
    expect(installed.status).toBe(201);
    expect((await api.place("list", { pageSize: 5 }, v2)).status).toBe(200);
    const moved = await api.surface("list");
    expect(titles(moved.tree.root)[0]).toBe("Write the migration guide");
    expect(find(moved.tree.root, "root/range")?.props).toMatchObject({ text: "Showing 6 to 10 of 12" });
    expect(host.events.map((event) => event.type)).toContain("state-migrated");
    expect(host.events.map((event) => event.type)).not.toContain("state-reset");
  } finally {
    await host.stop();
  }
});
