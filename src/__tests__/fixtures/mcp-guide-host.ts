import type { PreviewBinding } from "@arnilo/liveframe/preview";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };

/**
 * Stands in for the app's own `<Preview>` page. It lists the bound package's
 * scenarios and answers `/preview/render` with the selected scenario's tree; a
 * real app mounts `<Preview>` there (see `docs/preview.md`).
 */
export async function startApp(binding: PreviewBinding) {
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const requestUrl = new URL(request.url);
      const scenarios = binding.package().scenarios.map((entry) => entry.name);
      const scenario = requestUrl.searchParams.get("scenario") ?? scenarios[0] ?? "";
      if (requestUrl.pathname === "/preview/render") {
        return Response.json(await binding.session.render({ scenario }));
      }
      return Response.json({ scenario, scenarios });
    },
  });
  const url = `http://localhost:${server.port}/preview?scenario=${encodeURIComponent(binding.package().scenarios[0]?.name ?? "")}`;
  return { url, stop: () => server.stop(true) };
}

export { capabilities, catalog };
