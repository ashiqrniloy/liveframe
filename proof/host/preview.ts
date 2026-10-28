import type { Intent, IntentOrigin, Result } from "@arnilo/liveframe";
import { createPreview, type PreviewBinding, type PreviewSession } from "@arnilo/liveframe/preview";
import { memoryStore } from "@arnilo/liveframe/store";
import { drafts, packageOptions, value } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { isRecord } from "../runtime/data.ts";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import { runner } from "./pages.ts";

type Draft = Parameters<PreviewSession["update"]>[0];

/** One page's snapshot source: the page, `/preview/render` and capture all read this. */
function view(session: PreviewSession, pkg: () => WidgetPackage) {
  return {
    session,
    snapshot: async (scenario: string) => ({
      scenario,
      result: await session.render({ scenario }),
      manifest: pkg().manifest,
      scenarios: pkg().scenarios.map((entry) => entry.name),
      intents: session.intents(),
    }),
  };
}

export function previewRoutes() {
  const store = memoryStore();
  // A session opened by the page can be written to; an attached one cannot.
  type Hosted = ReturnType<typeof view> & Partial<Pick<ReturnType<typeof open>, "update" | "publish">>;
  // shortcut: sessions live until shutdown; add expiry if this outgrows a local proof.
  const sessions = new Map<string, Hosted>();
  /** Serves an external session — the MCP server's — under a new page id. */
  function attach(binding: PreviewBinding): string {
    const id = crypto.randomUUID();
    sessions.set(id, view(binding.session, binding.package));
    return id;
  }
  function open() {
    const draft = drafts[0];
    if (!draft) throw new Error("Missing agent-home draft");
    const session = createPreview({ ...packageOptions, runner });
    let pkg = value(session.update(draft));
    return {
      ...view(session, () => pkg),
      update(input: Draft) {
        const result = session.update(input);
        if (result.ok) pkg = result.value;
        return result.ok ? { ok: true, hash: pkg.hash } : result;
      },
      async publish() {
        const published = pkg;
        await store.putPackage(published);
        return { hash: (await store.getPackage(published.manifest.id, published.manifest.version))?.hash };
      },
    };
  }
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const handle = async (request: Request, page: (bootstrap: unknown) => Response) => {
    const url = new URL(request.url);
    let id = url.searchParams.get("session");
    if (url.pathname === "/preview" && request.method === "GET" && !id) {
      id = crypto.randomUUID();
      sessions.set(id, open());
    }
    const active = id ? sessions.get(id) : undefined;
    if (!active) return json({ error: "Unknown preview session" }, 404);
    if (request.method === "GET") {
      if (url.pathname === "/preview")
        return page({ session: id, ...(await active.snapshot(url.searchParams.get("scenario") ?? "ready")) });
      if (url.pathname === "/preview/render")
        return json(await active.snapshot(url.searchParams.get("scenario") ?? "ready"));
      return json({ error: "Not found" }, 404);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Cross-origin preview request rejected" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Expected JSON" }, 415);
    try {
      const body: unknown = await request.json();
      if (url.pathname === "/preview/draft") {
        if (!active.update) return json({ error: "Attached preview sessions are read-only" }, 405);
        if (
          !isRecord(body) ||
          Object.keys(body).some((key) => !["files", "entry", "manifest", "scenarios"].includes(key)) ||
          !isRecord(body.files) ||
          !Object.values(body.files).every((file) => typeof file === "string") ||
          typeof body.entry !== "string"
        )
          return json({ error: "Invalid draft" }, 400);
        return json(active.update(body as Draft));
      }
      if (url.pathname === "/preview/intent")
        return json({
          result: await active.session.intent(
            (isRecord(body) && "intent" in body ? body.intent : body) as Intent,
            (isRecord(body) ? body.origin : undefined) as IntentOrigin | undefined,
          ),
          intents: active.session.intents(),
        });
      if (url.pathname === "/preview/publish") {
        if (!active.publish) return json({ error: "Attached preview sessions are read-only" }, 405);
        return json(await active.publish());
      }
      return json({ error: "Not found" }, 404);
    } catch (cause) {
      if (cause instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
      if (isRecord(cause) && cause.kind === "version-conflict") return json({ error: cause }, 409);
      console.error(cause);
      return json({ error: "Preview request failed" }, 500);
    }
  };
  return Object.assign(handle, { attach });
}
