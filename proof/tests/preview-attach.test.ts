import { afterAll, beforeAll, expect, test } from "bun:test";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import { createPreview, inProcessRunner } from "@arnilo/liveframe/preview";
import { drafts, packageOptions, value } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { startHost } from "../host/server.ts";

let server: Awaited<ReturnType<typeof startHost>>;
beforeAll(async () => {
  server = await startHost(0);
}, 30000);
afterAll(async () => {
  await server?.stop(true);
});

// A session the MCP server owns: the page reads it, nothing on the page writes to it.
function bound() {
  const draft = drafts[0];
  if (!draft) throw new Error("Missing agent-home draft");
  const session = createPreview({ ...packageOptions, runner: inProcessRunner() });
  let pkg: WidgetPackage = value(session.update(draft));
  const id = server.attach({ session, package: () => pkg });
  return { session, draft, id, rebind: (next: WidgetPackage) => (pkg = next) };
}

test("attached_session_page_shows_the_bound_package", async () => {
  const { session, draft, id, rebind } = bound();
  const page = async () => (await fetch(`${server.url}preview?session=${id}`)).text();
  const first = await page();
  for (const { name } of draft.scenarios) expect(first).toContain(`"${name}"`);

  const [head, ...rest] = draft.scenarios;
  const renamed = { ...draft, scenarios: [{ ...head, name: "renamed" }, ...rest] };
  rebind(value(session.update(renamed)));

  expect(await page()).toContain('"renamed"');
  const rendered = await (await fetch(`${server.url}preview/render?session=${id}&scenario=renamed`)).json();
  expect(rendered.result.ok).toBe(true);
  expect(rendered.scenarios).toContain("renamed");
}, 30000);

test("attached_session_rejects_draft_and_publish_routes", async () => {
  const { draft, id } = bound();
  const post = async (route: string, body: unknown = {}) => {
    const response = await fetch(`${server.url}preview/${route}?session=${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  for (const route of ["draft", "publish"]) {
    const { status, body } = await post(route, draft);
    expect(status).toBe(405);
    expect(body.error).toBe("Attached preview sessions are read-only");
  }
  expect((await fetch(`${server.url}preview/render?session=${id}`)).status).toBe(200);
}, 30000);
