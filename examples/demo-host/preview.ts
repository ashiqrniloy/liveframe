import type { Intent } from "@arnilo/liveframe";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import type { PreviewSession } from "@arnilo/liveframe/preview";
import { sheets } from "./styles.ts";

const page = await Bun.file(new URL("./preview.html", import.meta.url)).text();
// The browser gets this bundle and validated trees. Draft code stays with the runner (law 1).
const clientBundle = Bun.build({
  entrypoints: [new URL("./preview-client.tsx", import.meta.url).pathname],
  target: "browser",
}).then((build) => {
  const [bundle] = build.outputs;
  if (!build.success || !bundle) throw new AggregateError(build.logs, "Preview client build failed");
  return bundle;
});

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Routes for a preview page over one session. The page only asks the session to render and to check an intent:
 * an action is logged and shown, never dispatched (law 4).
 */
export async function previewRoutes({ session, package: pkg }: { session: PreviewSession; package(): WidgetPackage }) {
  const bundle = await clientBundle;
  const snapshot = async (scenario: string) => ({
    result: await session.render({ scenario }),
    manifest: pkg().manifest,
    scenarios: pkg().scenarios.map((entry) => entry.name),
    intents: session.intents(),
  });
  const postIntent = async (request: Request) => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin request" }, 403);
    const intent: unknown = await request.json().catch(() => undefined);
    if (typeof intent !== "object" || intent === null) return json({ error: "Expected an intent" }, 400);
    return json({ result: await session.intent(intent as Intent), intents: session.intents() });
  };
  return {
    "/preview": () =>
      new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }),
    "/preview/client.js": () => new Response(bundle, { headers: { "Content-Type": "text/javascript" } }),
    "/preview/render": async (request: Request) =>
      json(await snapshot(new URL(request.url).searchParams.get("scenario") ?? pkg().scenarios[0]?.name ?? "")),
    "/preview/intent": { POST: postIntent },
    "/styles/:name": (request: Bun.BunRequest<"/styles/:name">) => {
      const css = sheets[`/styles/${request.params.name}`];
      return css ? new Response(css, { headers: { "Content-Type": "text/css" } }) : json({ error: "Not found" }, 404);
    },
  };
}
