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
import * as conformance from "@arnilo/liveframe/conformance";
import type { ConformanceCase } from "@arnilo/liveframe/conformance";
import * as pack from "@arnilo/liveframe/pack";
import * as store from "@arnilo/liveframe/store";
import * as fileStore from "@arnilo/liveframe/store/fs";
import * as preview from "@arnilo/liveframe/preview";
import * as worker from "@arnilo/liveframe/preview/worker";
import * as previewReact from "@arnilo/liveframe/preview/react";
import * as liveframe from "@arnilo/liveframe";
import * as css from "@arnilo/liveframe/css";
import * as react from "@arnilo/liveframe/react";
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
import theme from "./fixtures/proof/certified.theme.json" with { type: "json" };
import designSystem from "./fixtures/proof/certified.design-system.json" with { type: "json" };

test("css_exports_are_pinned", () => {
  expect(Object.keys(css).sort()).toEqual([
    "baseCss",
    "colourVar",
    "designSystemCss",
    "slotClass",
    "styleDeclarations",
    "surfaceAttributes",
    "themeCss",
    "valueVar",
  ]);
});

test("react_export_surface", () => {
  expect(Object.keys(react).sort()).toEqual(["createRenderer", "implement"]);
});

test("css_public_return_types", () => {
  function value<T>(result: Result<T>): T {
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.value;
  }
  const installedCatalog = value(liveframe.validateCatalog(catalog));
  const installedTheme = value(liveframe.validateTheme(theme, installedCatalog.vocabulary));
  const context = { catalog: installedCatalog, registry: {} };
  const installedSystem = value(liveframe.validateDesignSystem(designSystem, context));
  const tree: UiTree = {
    format: liveframe.LIVEFRAME_FORMAT,
    catalogId: installedCatalog.catalogId,
    surfaceId: "main",
    revision: 1,
    root: { id: "root", kind: "button", props: { label: "Claim" } },
  };
  const sheets: Result<string>[] = [
    css.baseCss(installedCatalog),
    css.themeCss(installedTheme, installedCatalog),
    css.designSystemCss(installedSystem, context),
  ];
  const declarations: { style: Record<string, string>; classes: readonly string[] } = css.styleDeclarations(
    { gap: "space.2" },
    installedCatalog,
  );
  const attributes: { class: string; "data-lf-theme": string; "data-lf-ds": string } = css.surfaceAttributes({
    theme: installedTheme,
    designSystem: installedSystem,
    tree,
  });
  const names: string[] = [
    css.slotClass("button", "primary", "root"),
    css.colourVar("text.primary"),
    css.valueVar("space.2"),
  ];
  expect(sheets.every((sheet) => sheet.ok)).toBe(true);
  expect(declarations.style.gap).toBe(`var(${names[2]})`);
  expect(attributes["data-lf-theme"]).toBe(`${theme.id}@${theme.version}`);
});

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

test("subpath_export_surfaces", () => {
  expect(Object.keys(conformance).sort()).toEqual(["ConformanceFailure", "storeSuite"]);
  const cases: ConformanceCase[] = conformance.storeSuite({ create: store.memoryStore });
  expect(cases).toHaveLength(9);
  expect(Object.keys(previewReact).sort()).toEqual(["Preview"]);
  expect(Object.keys(fileStore).sort()).toEqual(["fileStore"]);
  expect(Object.keys(preview).sort()).toEqual(["createPreview", "inProcessRunner"]);
  expect(Object.keys(worker).sort()).toEqual(["workerRunner"]);
  expect(Object.keys(pack).sort()).toEqual(["pack", "validateScenario", "validateWidgetPackageShape", "verifyPackage"]);
  expect(Object.keys(store).sort()).toEqual([
    "loadPlacement",
    "memoryStore",
    "validatePlacement",
    "validateState",
    "validateStyleRecord",
  ]);
});
