import { appendFileSync } from "node:fs";
import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import capabilities from "../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import catalog from "../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import proofConfig from "../../host/mcp.config.ts";

const log = process.env.LF_MCP_PREVIEW_LOG ?? "mcp-preview.log";
const preview = proofConfig.preview;

const config: AuthoringConfig = {
  catalog,
  capabilities,
  async preview(binding) {
    if (!preview) throw new Error("The proof config needs a preview()");
    const bound = await preview(binding);
    appendFileSync(log, "open\n");
    return {
      url: bound.url,
      async close() {
        appendFileSync(log, "close\n");
        await bound.close();
      },
    };
  },
};

export default config;
