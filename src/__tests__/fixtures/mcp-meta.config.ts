import type { AuthoringConfig } from "../../preview/authoring.ts";
import { inProcessRunner } from "../../preview/index.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import base from "./widgets/capabilities.json" with { type: "json" };

/** The shared capabilities with host `meta` on one action and one source; `exposeMeta` stays at its default. */
const [action] = Object.keys(base.actions);
const [source] = Object.keys(base.sources);
if (!action || !source) throw new Error("The widget capabilities need an action and a source");
export const capabilities = {
  ...base,
  actions: {
    ...base.actions,
    [action]: { ...(base.actions as Record<string, object>)[action], meta: { tier: "gold" } },
  },
  sources: {
    ...base.sources,
    [source]: { ...(base.sources as Record<string, object>)[source], meta: { tier: "silver" } },
  },
};

const config: AuthoringConfig = { catalog, capabilities, runner: inProcessRunner() };

export default config;
