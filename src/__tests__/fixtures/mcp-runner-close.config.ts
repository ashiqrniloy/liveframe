import { writeFileSync } from "node:fs";
import type { AuthoringConfig } from "../../preview/authoring.ts";
import type { Runner } from "../../preview/runner.ts";
import capabilities from "./proof/capabilities.json" with { type: "json" };
import catalog from "./proof/catalog.json" with { type: "json" };

// A config-supplied runner whose close() leaves a marker: the server must never call it.
const runner: Runner & { close(): void } = {
  render: async () => ({ ok: false, errors: [{ kind: "render-failed", pointer: "", message: "unused" }] }),
  close: () => writeFileSync(process.env.LF_MCP_CLOSE_MARKER ?? "mcp-close-marker", "closed"),
};

const config: AuthoringConfig = { catalog, capabilities, runner };

export default config;
