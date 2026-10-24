import type { AuthoringConfig } from "../../preview/authoring.ts";
import { inProcessRunner } from "../../preview/index.ts";
import capabilities from "./proof/capabilities.json" with { type: "json" };
import catalog from "./proof/catalog.json" with { type: "json" };

const config: AuthoringConfig = { catalog, capabilities, runner: inProcessRunner() };

export default config;
