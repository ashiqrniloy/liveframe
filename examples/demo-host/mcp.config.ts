import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { capabilities, catalog } from "./app.ts";
import { previewRoutes } from "./preview.ts";

// The same runner the demo host renders with, so an agent previews what a viewer will get.
const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: workerRunner(),
  // The demo's own <Preview> page, bound to the server's session. `liveframe mcp` captures it.
  async preview(binding) {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      routes: await previewRoutes(binding),
    });
    return { url: new URL("/preview", server.url).href, close: () => server.stop(true) };
  },
};

export default config;
