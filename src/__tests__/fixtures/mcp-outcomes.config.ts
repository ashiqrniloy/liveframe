import { obj, sourceOutcome, str } from "../../index.ts";
import config from "./mcp.config.ts";
import capabilities from "./widgets/capabilities.json" with { type: "json" };

export default {
  ...config,
  capabilities: {
    ...capabilities,
    sources: {
      outcome: { description: "Outcome", params: obj({}), result: sourceOutcome(str({ maxLength: 20 })) },
    },
  },
};
