import { compileValidator, validateCapabilities } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { catalog } from "../../css/fixtures.ts";
import { systems, themes } from "../../css/sheets.ts";
import { implementations } from "../../renderer/primitives/index.tsx";

const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
const checked = validateCapabilities({
  format: "liveframe-capabilities/1",
  sources: {},
  actions: {
    save: {
      description: "Log save",
      args: {
        ...empty,
        properties: { source: { type: "string", maxLength: 100 }, from: { type: "string", maxLength: 100 } },
      },
    },
    close: { description: "Log close", args: empty },
  },
});
if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
const manifest = {
  format: "liveframe-manifest/1",
  id: "renderer-test",
  version: "1",
  catalogId: catalog.catalogId,
  params: empty,
  context: empty,
  initialState: {},
  sources: {},
  actions: ["save", "close"],
  state: {
    ...empty,
    properties: {
      query: { type: "string", maxLength: 100 },
      selected: { type: "string", maxLength: 100 },
      enabled: { type: "boolean" },
    },
  },
};
export const validator = compileValidator({ catalog, capabilities: checked.value, manifest });
export const { Surface } = createRenderer({ catalog, implementations });
export { catalog, systems, themes };
export const scope = { validator, theme: themes.certified, designSystem: systems.certified };
