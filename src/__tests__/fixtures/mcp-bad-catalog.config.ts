import type { AuthoringConfig } from "../../preview/authoring.ts";
import capabilities from "./proof/capabilities.json" with { type: "json" };

const config: AuthoringConfig = { catalog: { format: "liveframe-catalog/1" }, capabilities };

export default config;
