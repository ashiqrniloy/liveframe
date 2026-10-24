import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { capabilities, catalog, startApp } from "./mcp-guide-host.ts";

const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: workerRunner(),
  // Your app's own <Preview> page, bound to the server's session. The library ships no page.
  async preview(binding) {
    const app = await startApp(binding);
    return { url: app.url, close: () => app.stop() };
  },
};

export default config;
