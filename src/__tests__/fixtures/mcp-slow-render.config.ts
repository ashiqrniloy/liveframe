import type { AuthoringConfig } from "../../preview/authoring.ts";
import { inProcessRunner } from "../../preview/index.ts";
import catalog from "./proof/catalog.json" with { type: "json" };
import capabilities from "./widgets/capabilities.json" with { type: "json" };

// The default render budget is 100 ms; a render near the tree byte limit takes a large share of it on a
// loaded host, and a timeout reports pointer "" instead of the limit a test means to exercise.
const inner = inProcessRunner();
const timeoutMs = 10_000;
const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: { render: (pkg, inputs, options) => inner.render(pkg, inputs, { ...options, timeoutMs }) },
};

export default config;
