import { test } from "bun:test";
import { catalogSuite, designSystemSuite } from "@arnilo/liveframe/conformance";
import { catalog, capabilities, manifest, examples } from "../../src/__tests__/fixtures/conformance/index.ts";
import { themes, systems } from "../css/sheets.ts";
import { primitiveCss } from "../renderer/primitives/base.ts";

for (const c of [
  ...catalogSuite({ catalog, capabilities, manifest, examples }),
  ...designSystemSuite({
    catalog,
    themes: Object.values(themes),
    designSystems: Object.values(systems),
    sheets: [primitiveCss],
  }),
])
  test(c.name, c.run, c.timeout);
