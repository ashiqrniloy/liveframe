import { appendFileSync } from "node:fs";
import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import catalog from "../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import proofConfig from "../../host/mcp.config.ts";

// Same proof host as `proof/host/mcp.config.ts`, recording each bound page so the loop can scan it.
const log = process.env.LF_MCP_PAGE_LOG;
const preview = proofConfig.preview;

const config: AuthoringConfig = {
  catalog,
  capabilities,
  async preview(binding) {
    if (!preview) throw new Error("The proof config needs a preview()");
    const bound = await preview(binding);
    if (log) appendFileSync(log, `${bound.url}\n`);
    return bound;
  },
};

export default config;
