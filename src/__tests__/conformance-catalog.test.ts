import { expect, test } from "bun:test";
import { str, type Catalog } from "@arnilo/liveframe";
import { catalogSuite, ConformanceFailure } from "@arnilo/liveframe/conformance";
import { catalog, capabilities, manifest, examples, scenarioExamples } from "./fixtures/conformance/index.ts";
import { supplementalExample } from "./fixtures/conformance/supplemental.ts";

const input = { catalog, capabilities, manifest, examples };
async function fails(name: string, overrides: Partial<Parameters<typeof catalogSuite>[0]>) {
  const c = catalogSuite({ ...input, ...overrides }).find((c) => c.name === name);
  if (!c) throw new Error(`Missing case ${name}`);
  try {
    await c.run();
    throw new Error("Mutant passed");
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    expect(error).toMatchObject({ rule: name });
    expect((error as ConformanceFailure).details.length).toBeGreaterThan(0);
    return error as ConformanceFailure;
  }
}

test("proof_catalog_passes_the_catalog_suite", async () => {
  const cases = catalogSuite({ ...input, published: catalog });
  expect(cases).toHaveLength(5);
  expect(catalogSuite(input)).toHaveLength(4);
  await Promise.all(cases.map((c) => c.run()));
});

test("catalog_suite_catches_broken_catalogs", async () => {
  const coverage = "every_kind_and_variant_has_a_valid_example";
  const missing = {
    ...supplementalExample,
    root: {
      ...supplementalExample.root,
      children: supplementalExample.root.children?.filter((node) => node.id !== "root/danger"),
    },
  };
  const failure = await fails(coverage, { examples: [...scenarioExamples, missing] });
  expect(failure.details).toContain("button.danger");
  const invalid = await fails(coverage, { examples: [...examples, { ...supplementalExample, root: null }] });
  expect(invalid.details).toContainEqual(expect.objectContaining({ pointer: "/root" }));
  const version = "breaking_changes_take_a_new_major_catalog_id";
  const removed = {
    ...catalog,
    definitions: catalog.definitions.map((d) =>
      d.kind === "button"
        ? {
            ...d,
            props: {
              ...d.props,
              properties: Object.fromEntries(Object.entries(d.props.properties).filter(([name]) => name !== "icon")),
            },
          }
        : d,
    ),
  };
  const removedFailure = await fails(version, { catalog: removed, published: catalog });
  expect(removedFailure.details).toContain("kind button prop icon removed");
  const added = {
    ...catalog,
    catalogId: "proof.ui@2",
    definitions: catalog.definitions.map((d) =>
      d.kind === "button"
        ? { ...d, props: { ...d.props, properties: { ...d.props.properties, extra: str({ maxLength: 10 }) } } }
        : d,
    ),
  };
  const addedFailure = await fails(version, { catalog: added, published: catalog });
  expect(addedFailure.details).toContain("kind button prop extra added");
  const compatible = catalogSuite({
    ...input,
    catalog: { ...added, catalogId: catalog.catalogId },
    published: catalog,
  });
  await compatible.find((c) => c.name === version)?.run();
});

test("catalog_suite_reports_install_errors_in_independent_cases", async () => {
  for (const [name, overrides, pointer] of [
    ["catalog_installs", { catalog: { ...catalog, vocabulary: {} } }, "/vocabulary/colourRoles"],
    ["capabilities_install", { capabilities: null }, ""],
    ["manifest_installs_against_the_catalog", { manifest: { ...manifest, catalogId: "other@1" } }, "/catalogId"],
    ["every_kind_and_variant_has_a_valid_example", { catalog: null }, ""],
    ["breaking_changes_take_a_new_major_catalog_id", { published: null }, ""],
  ] as const) {
    const failure = await fails(name, overrides);
    expect(failure.details).toContainEqual(expect.objectContaining({ pointer }));
  }
  const missing = await fails("every_kind_and_variant_has_a_valid_example", { examples: [] });
  expect(missing.details.length).toBeLessThanOrEqual(20);
});

test("catalog_version_case_accepts_only_the_required_identity_change", async () => {
  const removed: Catalog = { ...catalog, definitions: catalog.definitions.filter((d) => d.kind !== "image") };
  async function version(next: Catalog, published: Catalog = catalog) {
    const c = catalogSuite({ ...input, catalog: next, published }).find(
      (c) => c.name === "breaking_changes_take_a_new_major_catalog_id",
    );
    if (!c) throw new Error("Missing version case");
    await c.run();
  }
  await version({ ...removed, catalogId: "proof.ui@2" });
  await version({ ...removed, catalogId: "proof.ui@10" });
  const rule = "breaking_changes_take_a_new_major_catalog_id";
  for (const catalogId of ["other@2", "proof.ui@1"])
    await fails(rule, { catalog: { ...removed, catalogId }, published: catalog });
  await fails(rule, {
    catalog: { ...removed, catalogId: "proof.ui@2" },
    published: { ...catalog, catalogId: "proof.ui@3" },
  });
  await fails(rule, { catalog: { ...catalog, catalogId: "proof.ui@2" }, published: catalog });
  const large = "9007199254740993";
  await version({ ...removed, catalogId: `proof.ui@${large}` }, { ...catalog, catalogId: "proof.ui@9007199254740992" });
});
