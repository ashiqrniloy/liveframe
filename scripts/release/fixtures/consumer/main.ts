/** The consumer every subpath must type-check against, from the installed package. */
import {
  type Catalog,
  compileValidator,
  type CompiledValidator,
  type LiveframeError,
  type Manifest,
  type Result,
  type UiTree,
  validateCatalog,
} from "@arnilo/liveframe";
import { baseCss, designSystemCss } from "@arnilo/liveframe/css";
import { createRenderer, type ImplementationProps } from "@arnilo/liveframe/react";
import { jsx, primitive, type WidgetProps } from "@arnilo/liveframe/sdk";
import { jsxDEV } from "@arnilo/liveframe/sdk/jsx-dev-runtime";
import { type JSX, jsxs } from "@arnilo/liveframe/sdk/jsx-runtime";
import { pack, type Scenario, type WidgetPackage } from "@arnilo/liveframe/pack";
import { loadPlacement, memoryStore, type Placement, type Store } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";
import { inProcessRunner, type PreviewSession, type Runner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { Preview, type PreviewProps } from "@arnilo/liveframe/preview/react";
import { catalogSuite, type ConformanceCase } from "@arnilo/liveframe/conformance";
import { conformancePage, rendererSuite } from "@arnilo/liveframe/conformance/react";

export type PublicTypes = {
  catalog: Catalog;
  manifest: Manifest;
  result: Result<UiTree>;
  errors: readonly LiveframeError[];
  validator: CompiledValidator;
  renderer: ReturnType<typeof createRenderer>;
  implementation: ImplementationProps;
  props: WidgetProps;
  element: JSX.Element;
  scenario: Scenario;
  pkg: WidgetPackage;
  placement: Placement;
  store: Store;
  runner: Runner;
  session: PreviewSession;
  preview: PreviewProps;
  cases: ConformanceCase[];
  css: ReturnType<typeof baseCss>;
};

export const publicValues = {
  validateCatalog,
  compileValidator,
  baseCss,
  designSystemCss,
  createRenderer,
  jsx,
  jsxs,
  jsxDEV,
  primitive,
  pack,
  loadPlacement,
  memoryStore,
  fileStore,
  inProcessRunner,
  workerRunner,
  Preview,
  catalogSuite,
  rendererSuite,
  conformancePage,
};
