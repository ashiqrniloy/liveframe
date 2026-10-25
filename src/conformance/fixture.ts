import { int, LiveframeFailure, obj, validateCatalog, validateCapabilities, type Result } from "../index.ts";
import { pack } from "../pack/index.ts";

export function value<T>(result: Result<T>): T {
  if (!result.ok) throw new LiveframeFailure(result.errors);
  return result.value;
}

export function storeFixture() {
  const options = {
    catalog: value(
      validateCatalog({
        format: "liveframe-catalog/1",
        catalogId: "conformance@1",
        description: "Store conformance fixture",
        vocabulary: {
          colourRoles: [],
          surfaceRoles: [],
          fillableRoles: [],
          typographyRoles: ["body"],
          surfaceTypography: "body",
          space: [],
          radius: [],
          size: [],
          breakpoints: [],
          tones: {},
        },
        definitions: [],
      }),
    ),
    capabilities: value(validateCapabilities({ format: "liveframe-capabilities/1", actions: {}, sources: {} })),
  };
  const pkg = value(
    pack(
      {
        files: { "entry.ts": 'throw new Error("Store fixtures must never execute"); export default () => null;' },
        entry: "entry.ts",
        manifest: {
          format: "liveframe-manifest/1",
          id: "conformance",
          version: "1",
          catalogId: options.catalog.catalogId,
          params: obj({}),
          state: obj({ count: int() }),
          initialState: { count: 0 },
          context: obj({}),
          sources: {},
          actions: [],
        },
        scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
      },
      options,
    ),
  );
  const placement = {
    id: "home",
    slot: "main",
    widget: { id: pkg.manifest.id, version: pkg.manifest.version },
    params: {},
  };
  const style = { kind: "theme" as const, id: "conformance", version: "1", body: { nested: [1] } };
  return { options, pkg, placement, style };
}
