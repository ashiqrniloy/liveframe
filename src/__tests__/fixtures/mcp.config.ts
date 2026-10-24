import type { AuthoringConfig } from "../../preview/authoring.ts";
import { inProcessRunner } from "../../preview/index.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };

const config: AuthoringConfig = { catalog, capabilities, runner: inProcessRunner() };

export default config;
