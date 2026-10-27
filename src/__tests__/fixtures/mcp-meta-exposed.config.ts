import type { AuthoringConfig } from "../../preview/authoring.ts";
import base, { capabilities } from "./mcp-meta.config.ts";

const config: AuthoringConfig = { ...base, capabilities, exposeMeta: true };

export default config;
