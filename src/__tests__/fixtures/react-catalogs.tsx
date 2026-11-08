import { type Catalog, compileValidator, type UiTree } from "../../index.ts";
import { createRenderer, type Implementation, implement } from "../../react/index.ts";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import rawCatalog from "./proof/catalog.json" with { type: "json" };

/** Two majors of one catalog: `button` differs, every other definition is shared. */
export const v1 = rawCatalog as Catalog;
export const v2: Catalog = {
  ...v1,
  catalogId: "proof.ui@2",
  definitions: v1.definitions.map((definition) =>
    definition.kind === "button" ? { ...definition, description: "A major 2 button." } : definition,
  ),
};
export const validators = {
  v1: compileValidator({ catalog: v1, capabilities, manifest }),
  v2: compileValidator({ catalog: v2, capabilities, manifest: { ...manifest, catalogId: v2.catalogId } }),
};

const shared = new Map(
  v1.definitions
    .filter((definition) => definition.kind !== "button")
    .map((definition) => [
      definition.kind,
      implement(definition, (input) => (
        <div className={input.slot("root")} data-kind={definition.kind}>
          {input.props.text as string | undefined}
          {input.children}
        </div>
      )),
    ]),
);
const major = (catalog: Catalog, label: string): Implementation[] =>
  catalog.definitions.map((definition) => {
    const found = shared.get(definition.kind);
    if (found) return found;
    return implement(definition, (input) => (
      <button type="button" className={input.slot("root")} data-major={label}>
        {String(input.props.label)}
      </button>
    ));
  });

export const catalogs = [
  { catalog: v1, implementations: major(v1, "1") },
  { catalog: v2, implementations: major(v2, "2") },
];
export const { Surface } = createRenderer({ catalogs });

export function treeFor(catalog: Catalog): UiTree {
  return {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId: catalog.catalogId,
    revision: 1,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: [{ id: "root/go", kind: "button", props: { label: `Go ${catalog.catalogId}` } }],
    },
  };
}
