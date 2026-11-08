import {
  type Capabilities,
  type Catalog,
  obj,
  type Result,
  validateCapabilities,
  validateCatalog,
} from "@arnilo/liveframe";
import { pack, type WidgetPackage } from "@arnilo/liveframe/pack";
import catalogDoc from "../../../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "../../../../src/__tests__/fixtures/templates/agent-home.ts";
import capabilitiesDoc from "../../../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "../../../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../../../src/__tests__/fixtures/widgets/index.ts";

export function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

export const catalog: Catalog = value(validateCatalog(catalogDoc));
export const capabilities: Capabilities = value(validateCapabilities(capabilitiesDoc));
export const install = { catalog, capabilities };

/** Every proof widget, packed: the five code widgets, and agent-home again as a template. */
export const codePackages: readonly WidgetPackage[] = drafts.map((draft) => value(pack(draft, install)));
const agentHome = proofWidgets[0];
if (!agentHome) throw new Error("Missing agent-home fixture");
export const templatePackage: WidgetPackage = value(
  pack({ template: agentHomeTemplate, manifest: agentHome.manifest, scenarios: agentHome.scenarios }, install),
);
export const packages: readonly WidgetPackage[] = [...codePackages, templatePackage];

export const inputs = { params: {}, state: {}, context: {}, data: {}, actions: {} } as const;
export const renderOptions = { ...install, surfaceId: "test", revision: 1 } as const;

const head =
  'import { jsx, primitive } from "@arnilo/liveframe/sdk";\nconst show = (text: unknown) => jsx(primitive("text"), { text: String(text) });\n';

/** A code package of one `text` node, from widget source that may call `show(text)`. */
export function widget(id: string, source: string, libraries: readonly WidgetPackage[] = []): WidgetPackage {
  return value(
    pack(
      {
        files: { "entry.ts": head + source },
        entry: "entry.ts",
        manifest: {
          format: "liveframe-manifest/1",
          id,
          version: "1",
          catalogId: catalog.catalogId,
          params: obj({}),
          state: obj({}),
          context: obj({}),
          initialState: {},
          sources: {},
          actions: [],
        },
        scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
      },
      { ...install, libraries },
    ),
  );
}

/** The one text a tree holds, or the first error. */
export function textOf(result: Result<unknown>): string {
  if (!result.ok) return `${result.errors[0]?.kind}: ${result.errors[0]?.message}`;
  const match = /"text":"([^"]*)"/.exec(JSON.stringify(result.value));
  return match?.[1] ?? "no text";
}
