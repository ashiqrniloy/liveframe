import { afterAll, beforeAll, expect, test } from "bun:test";
import type { UiNode } from "@arnilo/liveframe";
import { startHost } from "../server.ts";
import { readTemplateDraft } from "../widgets/draft.ts";
import { cleanup, client, find, offeredIntent, tempDir } from "./host.ts";

let dir: string;
beforeAll(async () => {
  dir = await tempDir();
});
afterAll(() => cleanup(dir));

const tasks = () => readTemplateDraft(new URL("../widgets/tasks/", import.meta.url).pathname);
const widget = { id: "tasks", version: "1.0.0" };
const titles = (root: UiNode) =>
  (root.children ?? []).filter((node) => node.kind === "text").map((node) => node.props.text);

test("demo_installs_template_widget", async () => {
  const host = await startHost({ dataDir: dir, port: 0 });
  const api = client(host);
  try {
    // A template is data: the host installs it with the same route and no code runs to do so.
    const installed = await api.install(await tasks());
    expect(installed.status).toBe(201);
    expect((await api.place("list", { pageSize: 5 }, widget)).status).toBe(200);

    const first = await api.surface("list");
    expect(titles(first.tree.root)).toEqual([
      "Review the release notes",
      "Reply to the design thread",
      "Triage new issues",
      "Update the roadmap",
      "Pair on the importer",
    ]);
    expect(find(first.tree.root, "root/range")?.props).toMatchObject({ text: "Showing 1 to 5 of 12" });
    expect(find(first.tree.root, "root/previous")).toBeUndefined();

    // Paginating is the widget's own state: Next sets `page`, the host re-renders the template.
    const press = async (snapshot: typeof first, id: string) => {
      const response = await api.intent("list", offeredIntent(snapshot, id, "onPress"), {
        surfaceId: snapshot.tree.surfaceId,
        revision: snapshot.tree.revision,
        nodeId: id,
        event: "onPress",
      });
      expect(response.status).toBe(200);
      return (await response.json()) as typeof first;
    };
    const second = await press(first, "root/next");
    expect(titles(second.tree.root)[0]).toBe("Write the migration guide");
    expect(find(second.tree.root, "root/range")?.props).toMatchObject({ text: "Showing 6 to 10 of 12" });
    const third = await press(second, "root/next");
    expect(titles(third.tree.root)).toEqual(["Tidy the backlog", "Sync with support"]);
    expect(find(third.tree.root, "root/range")?.props).toMatchObject({ text: "Showing 11 to 12 of 12" });
    expect(find(third.tree.root, "root/next")).toBeUndefined();
    const back = await press(third, "root/previous");
    expect(find(back.tree.root, "root/range")?.props).toMatchObject({ text: "Showing 6 to 10 of 12" });
  } finally {
    await host.stop();
  }
});

test("a_template_cannot_request_what_the_manifest_does_not_declare", async () => {
  const host = await startHost({ dataDir: dir, port: 0 });
  try {
    const draft = await tasks();
    const children = draft.template.root.children.map((child: { key?: string }) =>
      child.key === "next"
        ? { ...child, events: { onPress: { type: "action", name: "demo.notify", args: { message: "hi" } } } }
        : child,
    );
    // demo.notify is a capability of the host, but this manifest lists no actions: it fails to install.
    const response = await client(host).install({
      ...draft,
      template: { ...draft.template, root: { ...draft.template.root, children } },
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { errors: { kind: string }[] }).errors).toContainEqual(
      expect.objectContaining({ kind: "undeclared-action" }),
    );
  } finally {
    await host.stop();
  }
});
