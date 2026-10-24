import type { AuthoringConfig } from "../../preview/authoring.ts";
import catalog from "./proof/catalog.json" with { type: "json" };

const config: AuthoringConfig = { catalog, capabilities: {} };

export default config;
