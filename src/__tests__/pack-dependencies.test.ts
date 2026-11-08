import { expect, test } from "bun:test";
import { type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { packageHash } from "../pack/hash.ts";
import { pack, rebindDependencies, verifyPackage, type WidgetPackage } from "../pack/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
function rejects(result: Result<unknown>, kind: string, pointer?: string | RegExp) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.length).toBeLessThanOrEqual(20);
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      kind,
      ...(typeof pointer === "string" ? { pointer } : pointer ? { pointer: expect.stringMatching(pointer) } : {}),
    }),
  );
}

const install = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
const ui = await Bun.file(new URL("./fixtures/widgets/ui.gen.ts", import.meta.url)).text();
const empty = { type: "object", properties: {}, required: [], additionalProperties: false } as const;
const scenarios = [{ name: "ready", params: {}, context: {}, data: {} }];

function manifest(id: string, version: string, extra: Record<string, unknown> = {}) {
  return {
    format: "liveframe-manifest/1",
    id,
    version,
    catalogId: "proof.ui@1",
    params: empty,
    state: empty,
    context: empty,
    initialState: {},
    sources: {},
    actions: [],
    ...extra,
  };
}

const header = '/** @jsxImportSource @arnilo/liveframe/sdk */\nimport { Stack, Text } from "./ui.gen.ts";\n';
const cards = (extra = "") =>
  `${header}
export function Card({ title }: { title: string }) { return <Stack padding="space.3"><Text text={title} /></Stack>; }
export function Badge({ label }: { label: string }) { return <Text text={\`LIB-MARKER \${label}\`} />; }
${extra}
export default function Gallery() { return <Card title="Gallery" />; }
`;

function library(version = "1.0.0", source = cards(), exports: readonly string[] = ["Badge", "Card"], more = {}) {
  return value(
    pack(
      {
        files: { "ui.gen.ts": ui, "lib.tsx": source },
        entry: "lib.tsx",
        manifest: manifest("acme.cards", version, { exports, ...more }),
        scenarios,
      },
      install,
    ),
  );
}

const widget = (specifier = "acme.cards@1.0.0", names = "Card, Badge") =>
  `${header.replace("Stack, Text", "Stack")}import { ${names} } from "liveframe:lib/${specifier}";
export default function Home() { return <Stack><Card title="Hi" /><Badge label="new" /></Stack>; }
`;

function dependent(libraries: readonly WidgetPackage[], source = widget(), id = "acme.home", version = "1.0.0") {
  return pack(
    { files: { "ui.gen.ts": ui, "entry.tsx": source }, entry: "entry.tsx", manifest: manifest(id, version), scenarios },
    { ...install, libraries },
  );
}

test("import_of_unexported_name_rejected", () => {
  const lib = library();
  rejects(dependent([lib], widget("acme.cards@1.0.0", "Card, Nope")), "unknown-name", /^\/files\/entry\.tsx\/\d+$/);
});

test("import_of_a_library_that_was_not_supplied_rejected", () => {
  rejects(dependent([]), "not-found", /^\/files\/entry\.tsx\/\d+$/);
  rejects(dependent([library("1.1.0")]), "not-found", /^\/files\/entry\.tsx\/\d+$/);
});

test("default_and_namespace_imports_of_a_library_rejected", () => {
  const lib = library();
  rejects(
    dependent([lib], `${header}import Cards from "liveframe:lib/acme.cards@1.0.0";\nexport default () => <Stack />;`),
    "invalid-document",
    /^\/files\/entry\.tsx\/\d+$/,
  );
  rejects(
    dependent(
      [lib],
      `${header}import * as Cards from "liveframe:lib/acme.cards@1.0.0";\nexport default () => <Stack />;`,
    ),
    "invalid-document",
    /^\/files\/entry\.tsx\/\d+$/,
  );
  rejects(
    dependent(
      [lib],
      `${header}export { Card } from "liveframe:lib/acme.cards@1.0.0";\nexport default () => <Stack />;`,
    ),
    "forbidden-import",
  );
});

test("other_bare_specifiers_stay_forbidden", () => {
  rejects(
    dependent(
      [library()],
      `${header}import { x } from "liveframe:other/acme.cards@1.0.0";\nexport default () => <Stack />;`,
    ),
    "forbidden-import",
  );
  rejects(
    dependent([library()], `${header}import { x } from "left-pad";\nexport default () => <Stack />;`),
    "forbidden-import",
  );
});

test("library_code_not_copied", () => {
  const lib = library();
  const pkg = value(dependent([lib]));
  expect(lib.code).toContain("LIB-MARKER");
  expect(pkg.code).not.toContain("LIB-MARKER");
  const lines = (pkg.code as string).split("\n");
  const sdk = lines.filter((line) => line.startsWith("import * as __lf_sdk")).length;
  expect(lines[sdk]).toBe('import * as __lf_lib0 from "liveframe:lib/acme.cards@1.0.0";');
  expect(pkg.manifest.dependencies).toEqual([{ id: "acme.cards", version: "1.0.0", hash: lib.hash }]);
  value(verifyPackage(pkg, { ...install, libraries: [lib] }));
  value(verifyPackage(pkg, install));
});

test("a_package_without_libraries_is_unchanged", () => {
  const pkg = value(dependent([], `${header}export default () => <Stack />;`));
  expect(pkg.manifest.dependencies).toBeUndefined();
  expect(pkg.code).not.toContain("__lf_lib");
});

test("dependency_pin_in_hash", () => {
  const one = library("1.0.0");
  const two = library("1.0.1", cards("export const extra = 1;"), ["Badge", "Card", "extra"]);
  const a = value(dependent([one]));
  const b = value(dependent([one, two], widget("acme.cards@1.0.1")));
  expect(a.hash).not.toBe(b.hash);
  // Moving only the pin, even with the same code, is a different package: the manifest is hashed.
  const moved = {
    ...a,
    manifest: { ...a.manifest, dependencies: [{ id: "acme.cards", version: "1.0.0", hash: two.hash }] },
  };
  expect(packageHash(moved)).not.toBe(a.hash);
  rejects(verifyPackage(moved, install), "hash-mismatch", "/hash");
});

test("verify_checks_pins_against_supplied_libraries", () => {
  const lib = library();
  const pkg = value(dependent([lib]));
  rejects(verifyPackage(pkg, { ...install, libraries: [] }), "not-found", "/manifest/dependencies/0");
  const other = library("1.0.0", cards("export const changed = true;"), ["Badge", "Card"]);
  expect(other.hash).not.toBe(lib.hash);
  rejects(verifyPackage(pkg, { ...install, libraries: [other] }), "hash-mismatch", "/manifest/dependencies/0/hash");
  rejects(verifyPackage(pkg, { ...install, libraries: [{ ...lib, code: `${lib.code}\n// x` }] }), "hash-mismatch");
});

test("verify_rejects_a_header_that_does_not_match_the_manifest", () => {
  const pkg = value(dependent([library()]));
  const { dependencies: _, ...bare } = pkg.manifest;
  const without = { ...pkg, manifest: bare };
  rejects(
    verifyPackage({ ...without, hash: packageHash(without) }, install),
    "invalid-document",
    "/manifest/dependencies",
  );
  const stray = { ...pkg, code: `${pkg.code}\nconst x = __lf_lib0;` };
  rejects(verifyPackage({ ...stray, hash: packageHash(stray) }, install), "invalid-document", /^\/code\/\d+$/);
  const reexport = { ...pkg, code: `${pkg.code}\nexport { Card } from "liveframe:lib/acme.cards@1.0.0";` };
  rejects(verifyPackage({ ...reexport, hash: packageHash(reexport) }, install), "forbidden-import", /^\/code\/\d+$/);
});

test("verify_rejects_a_library_that_does_not_export_what_its_manifest_declares", () => {
  const lib = library();
  const lying = { ...lib, manifest: { ...lib.manifest, exports: ["Badge", "Card", "Ghost"] } };
  rejects(verifyPackage({ ...lying, hash: packageHash(lying) }, install), "invalid-document", "/code");
});

test("dependency_cycle_rejected", () => {
  // Content addressing makes a cycle among honest packages impossible, so the case is a library
  // importing its own (id, version).
  const self = `${header}import { Card } from "liveframe:lib/acme.cards@1.0.0";\nexport { Card };\nexport default () => <Stack />;`;
  const earlier = library("1.0.0");
  rejects(
    pack(
      {
        files: { "ui.gen.ts": ui, "lib.tsx": self },
        entry: "lib.tsx",
        manifest: manifest("acme.cards", "1.0.0", { exports: ["Card"] }),
        scenarios,
      },
      { ...install, libraries: [earlier] },
    ),
    "invalid-document",
    "/manifest/dependencies/0",
  );
});

test("graph_depth_is_bounded", () => {
  const chain: WidgetPackage[] = [];
  for (let i = 1; i <= 5; i++) {
    const below = chain[i - 2];
    const source = below
      ? `${header}import { Card } from "liveframe:lib/chain.l${i - 1}@1.0.0";\nexport { Card };\nexport default () => <Stack />;`
      : cards();
    chain.push(
      value(
        pack(
          {
            files: { "ui.gen.ts": ui, "lib.tsx": source },
            entry: "lib.tsx",
            manifest: manifest(`chain.l${i}`, "1.0.0", { exports: [below ? "Card" : "Card"] }),
            scenarios,
          },
          { ...install, libraries: chain },
        ),
      ),
    );
  }
  expect(chain[4]?.manifest.dependencies).toHaveLength(1);
  rejects(
    pack(
      {
        files: {
          "ui.gen.ts": ui,
          "entry.tsx": `${header}import { Card } from "liveframe:lib/chain.l5@1.0.0";\nexport default () => <Card />;`,
        },
        entry: "entry.tsx",
        manifest: manifest("acme.deep", "1.0.0"),
        scenarios,
      },
      { ...install, libraries: chain },
    ),
    "limit-exceeded",
    "/manifest/dependencies",
  );
});

test("direct_dependencies_are_bounded", () => {
  const libs: WidgetPackage[] = [];
  const imports: string[] = [];
  for (let i = 0; i < 17; i++) {
    libs.push(
      value(
        pack(
          {
            files: { "ui.gen.ts": ui, "lib.tsx": cards() },
            entry: "lib.tsx",
            manifest: manifest(`many.l${String(i).padStart(2, "0")}`, "1.0.0", { exports: ["Card"] }),
            scenarios,
          },
          install,
        ),
      ),
    );
    imports.push(`import { Card as C${i} } from "liveframe:lib/many.l${String(i).padStart(2, "0")}@1.0.0";`);
  }
  rejects(
    pack(
      {
        files: { "ui.gen.ts": ui, "entry.tsx": `${header}${imports.join("\n")}\nexport default () => <C0 />;` },
        entry: "entry.tsx",
        manifest: manifest("acme.many", "1.0.0"),
        scenarios,
      },
      { ...install, libraries: libs },
    ),
    "limit-exceeded",
    "/manifest/dependencies",
  );
});

test("a_draft_may_not_claim_other_dependencies", () => {
  const lib = library();
  const draft = (dependencies: unknown) =>
    pack(
      {
        files: { "ui.gen.ts": ui, "entry.tsx": widget() },
        entry: "entry.tsx",
        manifest: manifest("acme.home", "1.0.0", { dependencies }),
        scenarios,
      },
      { ...install, libraries: [lib] },
    );
  rejects(
    draft([{ id: "acme.cards", version: "1.0.0", hash: `sha256-${"0".repeat(64)}` }]),
    "invalid-document",
    "/manifest/dependencies",
  );
  expect(value(draft([{ id: "acme.cards", version: "1.0.0", hash: lib.hash }])).manifest.dependencies).toHaveLength(1);
});

test("manifest_exports_and_dependencies_are_checked", () => {
  const bad = (extra: Record<string, unknown>) =>
    pack(
      {
        files: { "e.tsx": `${header}export default () => <Stack />;`, "ui.gen.ts": ui },
        entry: "e.tsx",
        manifest: manifest("acme.x", "1.0.0", extra),
        scenarios,
      },
      install,
    );
  rejects(bad({ exports: ["default"] }), "invalid-document", /^\/manifest\/exports\/0/);
  rejects(bad({ exports: ["__lf_x"] }), "invalid-document", /^\/manifest\/exports\/0/);
  rejects(bad({ exports: ["a b"] }), "invalid-document", /^\/manifest\/exports\/0/);
  rejects(bad({ exports: ["A", "A"] }), "invalid-document", /^\/manifest\/exports/);
  rejects(bad({ exports: Array.from({ length: 65 }, (_, i) => `N${i}`) }), "invalid-document", /^\/manifest\/exports/);
  rejects(bad({ exports: ["Missing"] }), "invalid-document", /^\/files\/e\.tsx/);
  const pin = (id: string) => ({ id, version: "1.0.0", hash: `sha256-${"0".repeat(64)}` });
  rejects(bad({ dependencies: [pin("b.lib"), pin("a.lib")] }), "invalid-document", /^\/manifest\/dependencies/);
  rejects(bad({ dependencies: [pin("a.lib"), pin("a.lib")] }), "invalid-document", /^\/manifest\/dependencies/);
});

test("template_with_dependencies_rejected", () => {
  const draft = (extra: Record<string, unknown>) => ({
    template: agentHomeTemplate,
    manifest: { ...(manifestOfTemplate as object), ...extra },
    scenarios: templateScenarios,
  });
  const pin = { id: "acme.cards", version: "1.0.0", hash: `sha256-${"0".repeat(64)}` };
  rejects(pack(draft({ dependencies: [pin] }), install), "invalid-document", "/manifest/dependencies");
  rejects(pack(draft({ exports: ["Card"] }), install), "invalid-document", "/manifest/exports");
  value(pack(draft({}), install));
});

test("rebind_moves_pins_and_version", () => {
  const lib = library("1.0.0");
  const pkg = value(dependent([lib]));
  const next = library("1.1.0", cards("export const extra = 1;"), ["Badge", "Card", "extra"]);
  const rebound = value(rebindDependencies(pkg, { libraries: [next], version: "1.0.1" }));
  expect(rebound.manifest.version).toBe("1.0.1");
  expect(rebound.manifest.dependencies).toEqual([{ id: "acme.cards", version: "1.1.0", hash: next.hash }]);
  expect(rebound.hash).not.toBe(pkg.hash);
  expect(Object.isFrozen(rebound)).toBe(true);
  // Only the header line's version moved: everything else is the same bytes, so nothing was re-transpiled.
  expect(rebound.code).toBe((pkg.code as string).replace("acme.cards@1.0.0", "acme.cards@1.1.0"));
  expect(rebound.scenarios).toEqual(pkg.scenarios);
  value(verifyPackage(rebound, { ...install, libraries: [next] }));
  // The input is untouched.
  expect(pkg.manifest.dependencies?.[0]?.version).toBe("1.0.0");
});

test("rebind_missing_name_unknown_name", () => {
  const pkg = value(dependent([library("1.0.0")]));
  const slimmer = library(
    "2.0.0",
    `${header}export function Card() { return <Text text="c" />; }\nexport default () => <Card />;`,
    ["Card"],
  );
  rejects(
    rebindDependencies(pkg, { libraries: [slimmer], version: "2.0.0" }),
    "unknown-name",
    "/manifest/dependencies/0",
  );
});

test("rebind_needs_every_dependency_and_a_code_package", () => {
  const pkg = value(dependent([library("1.0.0")]));
  rejects(rebindDependencies(pkg, { libraries: [], version: "1.0.1" }), "not-found", "/manifest/dependencies/0");
  const none = value(dependent([], `${header}export default () => <Stack />;`));
  rejects(rebindDependencies(none, { libraries: [], version: "1.0.1" }), "invalid-document", "/manifest/dependencies");
  rejects(rebindDependencies(pkg, { libraries: [library()], version: "" }), "invalid-document", "/version");
});

test("a_library_may_itself_depend_on_a_library", () => {
  const base = library("1.0.0");
  const middle = value(
    pack(
      {
        files: {
          "ui.gen.ts": ui,
          "lib.tsx": `${header}import { Card } from "liveframe:lib/acme.cards@1.0.0";\nexport { Card as Tile };\nexport default () => <Card title="t" />;`,
        },
        entry: "lib.tsx",
        manifest: manifest("acme.tiles", "1.0.0", { exports: ["Tile"] }),
        scenarios,
      },
      { ...install, libraries: [base] },
    ),
  );
  const top = value(
    dependent(
      [middle, base],
      widget("acme.tiles@1.0.0", "Tile").replace("<Card", "<Tile").replace('<Badge label="new" />', ""),
    ),
  );
  value(verifyPackage(top, { ...install, libraries: [middle, base] }));
  rejects(verifyPackage(top, { ...install, libraries: [middle] }), "not-found");
});

// Template draft fixtures for the "template_with_dependencies_rejected" case.
import { proofWidgets } from "./fixtures/widgets/index.ts";

const templateWidget = proofWidgets[0] as NonNullable<(typeof proofWidgets)[number]>;
const manifestOfTemplate = templateWidget.manifest;
const templateScenarios = templateWidget.scenarios;
