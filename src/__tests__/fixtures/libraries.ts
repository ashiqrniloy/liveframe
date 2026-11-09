import { obj, type Result, validateCapabilities, validateCatalog } from "../../index.ts";
import { pack, type WidgetPackage } from "../../pack/index.ts";
import catalogDoc from "./proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./widgets/capabilities.json" with { type: "json" };

/** A shared library and a draft that imports it, for the host-supplied library tests (plan 032 Task 4a). */
export function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

export const install = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};

const ui = await Bun.file(new URL("./widgets/ui.gen.ts", import.meta.url)).text();
const header = '/** @jsxImportSource @arnilo/liveframe/sdk */\nimport { Stack, Text } from "./ui.gen.ts";\n';

const manifest = (id: string, version: string, extra: Record<string, unknown> = {}) => ({
  format: "liveframe-manifest/1",
  id,
  version,
  catalogId: install.catalog.catalogId,
  params: obj({}),
  state: obj({}),
  context: obj({}),
  initialState: {},
  sources: {},
  actions: [],
  ...extra,
});
const scenarios = [{ name: "default", params: {}, context: {}, data: {} }];

/** The library: `acme.cards@1.0.0` exports `Badge`. A different `marker` makes a different package. */
export function sharedLibrary(marker = "card", version = "1.0.0"): WidgetPackage {
  const source = `${header}export function Badge({ label }: { label: string }) { return <Text text={\`${marker}:\${label}\`} />; }
export default function Gallery() { return <Badge label="gallery" />; }
`;
  return value(
    pack(
      {
        files: { "ui.gen.ts": ui, "lib.tsx": source },
        entry: "lib.tsx",
        manifest: manifest("acme.cards", version, { exports: ["Badge"] }),
        scenarios,
      },
      install,
    ),
  );
}

/** A draft that imports `Badge` from the library; it renders one text node, `card:new`. */
export function libraryDraft(version = "1.0.0") {
  const source = `${header.replace("Stack, Text", "Stack")}import { Badge } from "liveframe:lib/acme.cards@${version}";
export default function Home() { return <Stack><Badge label="new" /></Stack>; }
`;
  return {
    files: { "ui.gen.ts": ui, "entry.tsx": source },
    entry: "entry.tsx",
    manifest: manifest("acme.home", "1.0.0"),
    scenarios,
  };
}

export const textOf = (result: Result<unknown>): string | undefined =>
  result.ok ? /"text":"([^"]*)"/.exec(JSON.stringify(result.value))?.[1] : undefined;
