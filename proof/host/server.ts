import { resolve, sep } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { base, systemSheets, themeSheets } from "../css/sheets.ts";
import { primitiveCss } from "../renderer/primitives/base.ts";
import { isRecord } from "../runtime/data.ts";
import { type HostedSurface, InvalidIntent, openPage, packages, pages, StaleRevision } from "./pages.ts";
import { previewRoutes } from "./preview.ts";
import { ProofSurface } from "./view.tsx";

export async function startHost(port = 3000) {
  const build = await Bun.build({
    entrypoints: ["client.tsx", "preview-client.tsx"].map((path) => new URL(path, import.meta.url).pathname),
    target: "browser",
  });
  if (!build.success) throw new AggregateError(build.logs, "Proof client build failed");
  const bundle = build.outputs.find((output) => output.path.endsWith("/client.js"));
  const previewBundle = build.outputs.find((output) => output.path.endsWith("/preview-client.js"));
  const preview = previewRoutes();
  if (!bundle || !previewBundle) throw new Error("Missing proof client bundle");
  const sheets = new Map([
    ["/styles/base.css", base],
    ["/styles/primitives.css", primitiveCss],
    ...Object.entries(themeSheets).map(([name, css]) => [`/styles/${name}.theme.css`, css] as const),
    ...Object.entries(systemSheets).map(([name, css]) => [`/styles/${name}.css`, css] as const),
  ]);
  const fontRoot = resolve("proof/references/synapta-core/design-artifacts/fonts");
  const snapshotFont = (pathname: string) => {
    const file = resolve(fontRoot, `.${pathname.slice("/fonts".length)}`);
    return file.startsWith(`${fontRoot}${sep}`) ? Bun.file(file) : null;
  };
  const fontFaces = `<link rel="preload" href="/fonts/schibsted-grotesk/latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/martian-mono/latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin><style>
@font-face { font-family: "Schibsted Grotesk"; font-style: normal; font-weight: 400 900; font-display: swap; src: url("/fonts/schibsted-grotesk/latin-wght-normal.woff2") format("woff2"); }
@font-face { font-family: "Martian Mono"; font-style: normal; font-weight: 100 800; font-stretch: 75% 112.5%; font-display: swap; src: url("/fonts/martian-mono/latin-wdth-normal.woff2") format("woff2"); }
</style><style>
/* The artifact's page gutters: .deck padding-inline (32px, 16px below 900px). */
body { margin: 0; -webkit-font-smoothing: antialiased; }
#app { margin-inline: auto; padding-inline: 32px; box-sizing: border-box; }
@media (max-width: 900px) { #app { padding-inline: 16px; } }
</style>`;
  // shortcut: sessions live until shutdown; add expiry if this outgrows a local proof.
  const sessions = new Map<string, HostedSurface>();
  const error = (message: string, status: number) => Response.json({ error: message }, { status });
  const html = (body: string) =>
    new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  const links = Object.entries(pages)
    .map(([name, title]) => `<li><a href="/ui/${name}">${title}</a></li>`)
    .join("");
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    maxRequestBodySize: 1048576,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.hostname !== "127.0.0.1") return error("Unknown host", 403);
      if (url.pathname === "/preview" || url.pathname.startsWith("/preview/"))
        return preview(request, (bootstrap) =>
          html(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Liveframe preview</title>${fontFaces}<link rel="stylesheet" href="/styles/base.css"><link rel="stylesheet" href="/styles/primitives.css">${["certified", "rack"].map((name) => `<link rel="stylesheet" href="/styles/${name}.theme.css"><link rel="stylesheet" href="/styles/${name}.css">`).join("")}</head><body><a href="/">All reference UIs</a><h1>Preview</h1><div id="app"></div><script type="application/json" id="bootstrap">${JSON.stringify(bootstrap).replaceAll("<", "\\u003c")}</script><script type="module" src="/preview-client.js"></script></body></html>`,
          ),
        );
      if (request.method === "POST" && url.pathname === "/intent") {
        if ((await request.clone().arrayBuffer()).byteLength > 65536) return error("Request too large", 413);
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
          return Response.json(await session.dispatch(body.revision as number, body.intent), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (cause) {
          if (cause instanceof StaleRevision) return error(cause.message, 409);
          if (cause instanceof InvalidIntent || cause instanceof SyntaxError) return error(cause.message, 400);
          console.error(cause);
          return error("Host failed to process intent", 500);
        }
      }
      if (request.method !== "GET") return error("Method not allowed", 405);
      if (url.pathname === "/preview-client.js")
        return new Response(previewBundle, { headers: { "Content-Type": "text/javascript" } });
      if (url.pathname === "/client.js")
        return new Response(bundle, { headers: { "Content-Type": "text/javascript" } });
      const css = sheets.get(url.pathname);
      if (css) return new Response(css, { headers: { "Content-Type": "text/css" } });
      if (url.pathname.startsWith("/fonts/")) {
        const font = snapshotFont(url.pathname);
        return font ? new Response(font, { headers: { "Content-Type": "font/woff2" } }) : error("Not found", 404);
      }
      if (url.pathname === "/")
        return html(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Liveframe proof</title></head><body><h1>Liveframe proof</h1><ul>${links}<li><a href="/preview">Preview</a></li></ul></body></html>`,
        );
      const name = url.pathname.slice("/ui/".length);
      if (!url.pathname.startsWith("/ui/") || !Object.hasOwn(pages, name)) return error("Not found", 404);
      const scenario = url.searchParams.get("scenario") ?? undefined;
      const pkg = packages.get(name === "design-system" ? "agent-home" : name);
      const selectedScenario = pkg?.scenarios.find((entry) => entry.name === scenario);
      if (scenario !== undefined && !selectedScenario) return error("Invalid package scenario", 400);
      const scenarioSize = isRecord(selectedScenario?.context) ? selectedScenario.context.size : undefined;
      const size = url.searchParams.get("size") ?? (typeof scenarioSize === "string" ? scenarioSize : "full");
      if (!["small", "medium", "large", "full"].includes(size)) return error("Invalid widget size", 400);
      const specimenWidth =
        name === "core-queue"
          ? ({ small: "21rem", medium: "36rem", large: "54rem", full: "100%" }[size] ?? "100%")
          : "100%";
      const designSystem = name === "git-status" || name === "rack-module" ? "rack" : "certified";

      const session = await openPage(size, name, scenario);
      const snapshot = session.snapshot();
      sessions.set(snapshot.tree.surfaceId, session);
      const markup = renderToString(createElement(ProofSurface, { snapshot, designSystem, onIntent: () => {} }));
      const json = JSON.stringify(snapshot).replaceAll("<", "\\u003c");
      return html(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Liveframe proof</title>${fontFaces}<link rel="stylesheet" href="/styles/base.css"><link rel="stylesheet" href="/styles/primitives.css">${["certified", "rack"].map((name) => `<link data-design-system="${name}" rel="stylesheet" href="/styles/${name}.theme.css"><link data-design-system="${name}" rel="stylesheet" href="/styles/${name}.css">`).join("")}</head><body><nav aria-label="Reference UIs"><a href="/">All reference UIs</a></nav><h1>${pages[name as keyof typeof pages]}</h1><label>Design system <select id="design-system" disabled><option value="certified"${designSystem === "certified" ? " selected" : ""}>Certified</option><option value="rack"${designSystem === "rack" ? " selected" : ""}>Rack</option></select></label><p>Widget size: ${size}. Use ?size=small, medium, large or full.</p><div id="app" data-design-system="${designSystem}" style="max-width:${specimenWidth}">${markup}</div><p id="status" role="alert"></p><h2>Actions (logged only)</h2><pre id="actions" aria-live="polite">[]</pre><script type="application/json" id="bootstrap">${json}</script><script type="module" src="/client.js"></script></body></html>`,
      );
    },
  });
  return Object.assign(server, { attach: preview.attach });
}

if (import.meta.main) {
  const server = await startHost();
  console.log(`Liveframe proof host: ${server.url}`);
}
