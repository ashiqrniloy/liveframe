import {
  compileValidator,
  obj,
  validateCatalog,
  validateCapabilities,
  validateManifest,
  type Result,
} from "@arnilo/liveframe";
import { render } from "@arnilo/liveframe/sdk";
import catalogDoc from "../proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../widgets/capabilities.json" with { type: "json" };
import { supplementalExample } from "./supplemental.ts";
import { proofWidgets } from "../widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
export const catalog = value(validateCatalog(catalogDoc));
export const capabilities = value(validateCapabilities(capabilitiesDoc));
const manifests = proofWidgets.map((fixture) => value(validateManifest(fixture.manifest, { catalog, capabilities })));
export const manifest = value(
  validateManifest(
    {
      format: "liveframe-manifest/1",
      id: "conformance",
      version: "1",
      catalogId: catalog.catalogId,
      params: obj({}),
      context: obj({}),
      state: obj({}, Object.fromEntries(manifests.flatMap((manifest) => Object.entries(manifest.state.properties)))),
      initialState: {},
      sources: {},
      actions: Object.keys(capabilities.actions),
    },
    { catalog, capabilities },
  ),
);
export const scenarioExamples = proofWidgets.flatMap((fixture) => {
  const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
  return fixture.scenarios.map((scenario) =>
    value(
      render(fixture.widget, scenario, {
        validator,
        surfaceId: `${fixture.name}/${scenario.name}`,
        revision: 0,
      }),
    ),
  );
});
export const examples = [...scenarioExamples, supplementalExample];
