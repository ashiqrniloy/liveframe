/** The adopter owns bundling and serving; this is test infrastructure only. */
export async function browserHost(entrypoint: string, css = "", production = false) {
  const build = await Bun.build({
    entrypoints: [entrypoint],
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development") },
  });
  if (!build.success) throw new AggregateError(build.logs);
  const bundle = build.outputs[0];
  if (!bundle) throw new Error("Missing conformance bundle");
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      return new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><title>Conformance</title><style>${css}</style></head><body><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
    },
  });
}
