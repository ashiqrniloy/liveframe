import { appendFileSync } from "node:fs";
import type { AuthoringConfig } from "../../preview/authoring.ts";
import { inProcessRunner } from "../../preview/index.ts";
import type { Runner } from "../../preview/runner.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };

// Every render goes through this wrapper, which records one line per call.
const delegate = inProcessRunner();
const runner: Runner = {
  render(pkg, inputs, options) {
    appendFileSync(process.env.LF_MCP_RENDER_LOG ?? "mcp-render.log", `${pkg.hash}\n`);
    return delegate.render(pkg, inputs, options);
  },
};

const config: AuthoringConfig = { catalog, capabilities, runner };

export default config;
