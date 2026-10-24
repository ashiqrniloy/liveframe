import type { AuthoringConfig } from "../../preview/authoring.ts";
import capabilities from "./widgets/capabilities.json" with { type: "json" };
import catalog from "./proof/catalog.json" with { type: "json" };

// No runner: the server owns the default `workerRunner()`.
const config: AuthoringConfig = { catalog, capabilities };

export default config;
