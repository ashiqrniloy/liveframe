import { describe, test } from "bun:test";
import { catalogSuite, designSystemSuite } from "@arnilo/liveframe/conformance";
import { rendererSuite } from "@arnilo/liveframe/conformance/react";
import { catalog } from "../catalog.ts";
import { designSystem } from "../design-system.ts";
import { primitiveCss } from "../styles.ts";
import { themes } from "../themes.ts";
import { capabilities, examples, manifest, pageOptions, serverExamples } from "./host.ts";

function register(name: string, cases: { name: string; run(): Promise<void>; timeout?: number | undefined }[]) {
  describe(name, () => {
    for (const c of cases) test(c.name, c.run, c.timeout);
  });
}

register(
  "starter_passes_catalog_suite",
  catalogSuite({ catalog, capabilities, manifest, examples, published: catalog }),
);
register(
  "starter_passes_design_system_suite_with_contrast",
  designSystemSuite({ catalog, themes, designSystems: [designSystem], sheets: [primitiveCss], contrast: true }),
);
register("starter_passes_renderer_server_suite", rendererSuite({ ...pageOptions, examples: serverExamples }));
