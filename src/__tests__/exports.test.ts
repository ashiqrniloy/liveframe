import { expect, test } from "bun:test";
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
import * as pack from "@arnilo/liveframe/pack";
import * as store from "@arnilo/liveframe/store";
import * as liveframe from "@arnilo/liveframe";
import type {
  Component,
  DeepReadonly,
  Element,
  Intent,
  Json,
  RenderLimits,
  RenderOptions,
  WidgetProps,
} from "@arnilo/liveframe/sdk";
import * as sdk from "@arnilo/liveframe/sdk";
import type { JSX as DevJSX } from "@arnilo/liveframe/sdk/jsx-dev-runtime";
import * as devRuntime from "@arnilo/liveframe/sdk/jsx-dev-runtime";
import type { JSX } from "@arnilo/liveframe/sdk/jsx-runtime";
import * as runtime from "@arnilo/liveframe/sdk/jsx-runtime";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };

test("sdk_export_surface", () => {
  expect(Object.keys(sdk).sort()).toEqual(["Fragment", "action", "jsx", "jsxs", "primitive", "render", "state"]);
  expect(Object.keys(runtime).sort()).toEqual(["Fragment", "jsx", "jsxs"]);
  expect(Object.keys(devRuntime).sort()).toEqual(["Fragment", "jsxDEV"]);
  expect(sdk.jsx).toBe(runtime.jsx);
  expect(sdk.jsxs).toBe(runtime.jsxs);
  expect(sdk.Fragment).toBe(devRuntime.Fragment);
});

test("sdk_public_types", () => {
  const limits: RenderLimits = { nodes: 10, depth: 4, bytes: 4096 };
  const options: RenderOptions = {
    validator: liveframe.compileValidator({ catalog, capabilities, manifest }),
    surfaceId: "main",
    revision: 1,
    limits,
  };
  const props: WidgetProps<
    Record<string, never>,
    { selected: string },
    Record<string, never>,
    Record<string, never>
  > = {
    params: {},
    state: { selected: "a" },
    data: {},
    context: {},
  };
  const selected: DeepReadonly<{ selected: string }> = props.state;
  const json: Json = selected;
  const intent: Intent = sdk.state.set("selected", json);
  const Label: Component<{ text: string }> = sdk.primitive("text");
  const element: Element = runtime.jsx(Label, { text: "Hello" });
  const jsxElement: JSX.Element = element;
  const devElement: DevJSX.Element = devRuntime.jsxDEV(Label, { text: "Hello" });
  const key: JSX.IntrinsicAttributes = { key: "label" };
  const children: DevJSX.ElementChildrenAttribute = { children: element };
  const intrinsic: keyof JSX.IntrinsicElements extends never ? true : false = true;
  expect([
    options.limits,
    intent.type,
    jsxElement.type,
    devElement.type,
    key.key,
    children.children,
    intrinsic,
  ]).toHaveLength(7);
});

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

test("build_facts_are_internal", () => {
  const validator = liveframe.compileValidator({ catalog, capabilities, manifest });
  // `render()` reads these facts from the validator; the root export publishes no name for them.
  expect(Object.keys(validator).sort()).toEqual(["build", "checkNode", "validateTree"]);
  expect(Object.keys(liveframe).filter((name) => /build|structure|facts/i.test(name))).toEqual([]);
  expect(validator.build.structure.children.get("stack")).toBeDefined();
  expect(validator.build.kinds.get("button")?.events.has("onPress")).toBe(true);
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

test("package_and_record_format_export_surfaces", () => {
  expect(Object.keys(pack).sort()).toEqual(["pack", "validateScenario", "validateWidgetPackageShape", "verifyPackage"]);
  expect(Object.keys(store).sort()).toEqual([
    "loadPlacement",
    "memoryStore",
    "validatePlacement",
    "validateState",
    "validateStyleRecord",
  ]);
});
