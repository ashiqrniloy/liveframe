import { expect, test } from "bun:test";
import * as liveframe from "@arnilo/liveframe";
import type {
  CompiledValidator,
  CompileValidatorOptions,
  LiveframeError,
  NodeCheck,
  NodeCheckSink,
  Result,
  UiTree,
  ValidateTreeOptions,
} from "@arnilo/liveframe";
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

test("root_export_surface", () => {
  expect(Object.keys(liveframe).sort()).toEqual(
    [
      "LIVEFRAME_FORMAT",
      "arr",
      "bool",
      "checkValue",
      "classifyCatalogChange",
      "compileValidator",
      "defineComponent",
      "int",
      "isLanguageSchema",
      "num",
      "obj",
      "recipeProperties",
      "resolveRecipes",
      "semantics",
      "states",
      "str",
      "styleProps",
      "validateCapabilities",
      "validateCatalog",
      "validateDesignSystem",
      "validateManifest",
      "validateTheme",
      "validateVocabulary",
    ].sort(),
  );
});

test("public_validator_types_support_error_guided_repairs", () => {
  const inputs: CompileValidatorOptions = { catalog, capabilities, manifest };
  const validator: CompiledValidator = liveframe.compileValidator(inputs);
  const check: NodeCheck = validator.checkNode;
  const errors: LiveframeError[] = [];
  const sink: NodeCheckSink = { errors, maxErrors: 20 };
  const root = { id: "root", kind: "button", props: { label: 7 } };
  expect(check(root, "/root", sink)).toBe(false);
  expect(errors[0]).toMatchObject({ kind: "invalid-prop", nodeId: "root", pointer: "/root/props/label" });

  const options: ValidateTreeOptions = { limits: { nodes: 5000, depth: 64, bytes: 1048576 }, maxErrors: 20 };
  const tree = {
    format: liveframe.LIVEFRAME_FORMAT,
    catalogId: catalog.catalogId,
    surfaceId: "main",
    revision: 1,
    root,
  };
  const rejected: Result<UiTree> = validator.validateTree(tree, options);
  expect(rejected.ok).toBe(false);
  const repaired = { ...tree, root: { ...root, props: { label: "Claim" } } };
  const accepted: Result<UiTree> = validator.validateTree(repaired, options);
  expect(accepted).toEqual({ ok: true, value: repaired });
});
