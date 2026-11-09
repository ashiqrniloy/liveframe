import type { AuthoringConfig } from "../../preview/authoring.ts";
import { inProcessRunner } from "../../preview/index.ts";
import { sharedLibrary } from "./libraries.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };

/** An operator's config that supplies one shared library to every draft the agent writes. */
const config: AuthoringConfig = { catalog, capabilities, runner: inProcessRunner(), libraries: [sharedLibrary()] };

export default config;
