import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { project } from "../css/project.ts";
import { isRecord } from "../runtime/data.ts";
import { WidgetError } from "../runtime/errors.ts";
import { certifiedDesignSystem } from "../styles/certified/design-system.ts";
import { certifiedTheme } from "../styles/certified/theme.ts";
import { rackDesignSystem } from "../styles/rack/design-system.ts";
import { rackTheme } from "../styles/rack/theme.ts";
import { agentHomeScenarios, openPage, pages } from "./pages.ts";
import { type HostedSurface, StaleRevision } from "./state.ts";
import { ProofSurface } from "./view.tsx";

export async function startHost(port = 3000) {
  const build = await Bun.build({
    entrypoints: [new URL("./client.tsx", import.meta.url).pathname],
    target: "browser",
  });
  if (!build.success) throw new AggregateError(build.logs, "Proof client build failed");
  const bundle = build.outputs[0];
  if (!bundle) throw new Error("Missing proof client bundle");
  const sheets = new Map([
    ["/styles/certified.css", project(certifiedTheme, certifiedDesignSystem)],
    ["/styles/rack.css", project(rackTheme, rackDesignSystem)],
  ]);
  // shortcut: sessions live until shutdown; add expiry if this outgrows a local proof.
  const sessions = new Map<string, HostedSurface>();
  const error = (message: string, status: number) => Response.json({ error: message }, { status });
  const html = (body: string) =>
    new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  const links = Object.entries(pages)
    .map(([name, title]) => `<li><a href="/ui/${name}">${title}</a></li>`)
    .join("");
  return Bun.serve({
    hostname: "127.0.0.1",
    port,
    maxRequestBodySize: 65536,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.hostname !== "127.0.0.1") return error("Unknown host", 403);
      if (request.method === "POST" && url.pathname === "/intent") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return error("Cross-origin intent rejected", 403);
        if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Expected JSON", 415);
        try {
          const body: unknown = await request.json();
          if (
            !isRecord(body) ||
            Object.keys(body).some((key) => !["surfaceId", "revision", "intent"].includes(key)) ||
            typeof body.surfaceId !== "string" ||
            !Number.isSafeInteger(body.revision)
          )
            return error("Invalid intent request", 400);
          const session = sessions.get(body.surfaceId);
          if (!session) return error("Unknown surface", 404);
          return Response.json(session.dispatch(body.revision as number, body.intent), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (cause) {
          if (cause instanceof StaleRevision) return error(cause.message, 409);
          if (cause instanceof WidgetError || cause instanceof SyntaxError) return error(cause.message, 400);
          console.error(cause);
          return error("Host failed to process intent", 500);
        }
      }
      if (request.method !== "GET") return error("Method not allowed", 405);
      if (url.pathname === "/client.js")
        return new Response(bundle, { headers: { "Content-Type": "text/javascript" } });
      const css = sheets.get(url.pathname);
      if (css) return new Response(css, { headers: { "Content-Type": "text/css" } });
      if (url.pathname === "/")
        return html(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Liveframe proof</title></head><body><h1>Liveframe proof</h1><ul>${links}</ul></body></html>`,
        );
      const name = url.pathname.slice("/ui/".length);
      if (!url.pathname.startsWith("/ui/") || !Object.hasOwn(pages, name)) return error("Not found", 404);
      const size = url.searchParams.get("size") ?? "full";
      if (!["small", "medium", "large", "full"].includes(size)) return error("Invalid widget size", 400);
      const scenario = url.searchParams.get("scenario") ?? "ready";
      if (!agentHomeScenarios.includes(scenario)) return error("Invalid queue scenario", 400);
      const specimenWidth =
        name === "core-queue"
          ? ({ small: "21rem", medium: "36rem", large: "54rem", full: "100%" }[size] ?? "100%")
          : "100%";
      const designSystem = name === "git-status" || name === "rack-module" ? "rack" : "certified";
      const alternateSystem = designSystem === "certified" ? "rack" : "certified";
      const session = openPage(size, name, scenario);
      const snapshot = session.snapshot();
      sessions.set(snapshot.tree.surfaceId, session);
      const markup = renderToString(createElement(ProofSurface, { snapshot, onIntent: () => {} }));
      const json = JSON.stringify(snapshot).replaceAll("<", "\\u003c");
      return html(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Liveframe proof</title><link id="projection" data-design-system="${designSystem}" rel="stylesheet" href="/styles/${designSystem}.css"><link data-design-system="${alternateSystem}" rel="stylesheet" href="/styles/${alternateSystem}.css" media="not all"></head><body><nav aria-label="Reference UIs"><a href="/">All reference UIs</a></nav><h1>${pages[name as keyof typeof pages]}</h1><label>Design system <select id="design-system" disabled><option value="certified"${designSystem === "certified" ? " selected" : ""}>Certified</option><option value="rack"${designSystem === "rack" ? " selected" : ""}>Rack</option></select></label><p>Widget size: ${size}. Use ?size=small, medium, large or full.</p><div id="app" style="max-width:${specimenWidth}">${markup}</div><p id="status" role="alert"></p><h2>Actions (logged only)</h2><pre id="actions" aria-live="polite">[]</pre><script type="application/json" id="bootstrap">${json}</script><script type="module" src="/client.js"></script></body></html>`,
      );
    },
  });
}

if (import.meta.main) {
  const server = await startHost();
  console.log(`Liveframe proof host: ${server.url}`);
}
