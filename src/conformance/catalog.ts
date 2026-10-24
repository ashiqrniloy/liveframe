import {
  classifyCatalogChange,
  compileValidator,
  validateCatalog,
  validateCapabilities,
  validateManifest,
  type CompileValidatorOptions,
  type Result,
} from "../index.ts";
import { check, type ConformanceCase } from "./case.ts";

function value<T>(result: Result<T>, rule: string, spec: string): T {
  check(result.ok, rule, spec, result.ok ? [] : result.errors);
  return result.value;
}

/** Validate app documents and examples, with optional compatibility against a published catalog. */
export function catalogSuite({
  catalog,
  capabilities,
  manifest,
  examples,
  published,
}: CompileValidatorOptions & {
  readonly examples: readonly unknown[];
  readonly published?: unknown;
}): ConformanceCase[] {
  function installed(rule: string) {
    const checked = {
      catalog: value(validateCatalog(catalog), rule, "§5"),
      capabilities: value(validateCapabilities(capabilities), rule, "§7.1"),
    };
    return { ...checked, manifest: value(validateManifest(manifest, checked), rule, "§7.1") };
  }
  const cases: ConformanceCase[] = [
    {
      name: "catalog_installs",
      async run() {
        value(validateCatalog(catalog), "catalog_installs", "§5");
      },
    },
    {
      name: "capabilities_install",
      async run() {
        value(validateCapabilities(capabilities), "capabilities_install", "§7.1");
      },
    },
    {
      name: "manifest_installs_against_the_catalog",
      async run() {
        installed("manifest_installs_against_the_catalog");
      },
    },
    {
      name: "every_kind_and_variant_has_a_valid_example",
      async run() {
        const rule = "every_kind_and_variant_has_a_valid_example";
        const options = installed(rule);
        const validator = compileValidator(options);
        const defaults = new Map(options.catalog.definitions.map((d) => [d.kind, d.defaultVariant]));
        const covered = new Set<string>();
        for (const example of examples) {
          const tree = value(validator.validateTree(example), rule, "§10");
          const pending = [tree.root];
          for (const node of pending) {
            covered.add(`${node.kind}.${node.variant ?? defaults.get(node.kind)}`);
            pending.push(...(node.children ?? []));
          }
        }
        const missing = options.catalog.definitions.flatMap((d) =>
          d.variants.filter((variant) => !covered.has(`${d.kind}.${variant}`)).map((variant) => `${d.kind}.${variant}`),
        );
        check(!missing.length, rule, "§13", [`Missing ${missing.length} kind/variant examples`, ...missing]);
      },
    },
  ];
  if (published !== undefined)
    cases.push({
      name: "breaking_changes_take_a_new_major_catalog_id",
      async run() {
        const rule = "breaking_changes_take_a_new_major_catalog_id";
        const before = value(validateCatalog(published), rule, "§5");
        const after = value(validateCatalog(catalog), rule, "§5");
        const change = classifyCatalogChange(before, after);
        const previous = before.catalogId.lastIndexOf("@");
        const next = after.catalogId.lastIndexOf("@");
        const compatible =
          change.level === "major"
            ? before.catalogId.slice(0, previous) === after.catalogId.slice(0, next) &&
              BigInt(after.catalogId.slice(next + 1)) > BigInt(before.catalogId.slice(previous + 1))
            : before.catalogId === after.catalogId;
        check(compatible, rule, "§5", [
          change.level === "major"
            ? "A breaking change must keep the catalog name and increase its major version"
            : "A compatible change must keep catalogId unchanged",
          ...change.reasons,
        ]);
      },
    });
  return cases;
}
