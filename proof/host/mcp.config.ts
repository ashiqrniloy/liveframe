import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import capabilities from "../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import catalog from "../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import { startHost } from "./server.ts";

const config: AuthoringConfig = {
  catalog,
  capabilities,
  async preview(binding) {
    const host = await startHost(0);
    return { url: `${host.url}preview?session=${host.attach(binding)}`, close: () => host.stop(true) };
  },
};

export default config;
