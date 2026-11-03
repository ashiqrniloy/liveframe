import type { AuthoringConfig } from "../../preview/authoring.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };

/** A host runner that returns a tree no validator would accept. */
const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: { render: async () => ({ ok: true, value: { format: "nope", root: { id: 7, kind: "<script>" } } as never }) },
};

export default config;
