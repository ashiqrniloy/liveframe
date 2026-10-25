import { Profiler, type ReactNode, useEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { baseCss, designSystemCss, themeCss } from "../../css/index.ts";
import {
  type CompileValidatorOptions,
  compileValidator,
  type DesignSystem,
  type Intent,
  LiveframeFailure,
  type Result,
  type Theme,
  validateCatalog,
} from "../../index.ts";
import { binding } from "../../react/implement.ts";
import { createRenderer, type Implementation, implement } from "../../react/index.ts";

export type Styles = { theme: { id: string; version: string }; designSystem: { id: string; version: string } };
export type PageOptions = CompileValidatorOptions & {
  implementations: readonly Implementation[];
  themes: readonly Theme[];
  designSystems: readonly DesignSystem[];
  fallback: ReactNode;
};
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new LiveframeFailure(result.errors);
  return result.value;
}

function Mounted({ children, ready }: { children: ReactNode; ready?: () => void }) {
  useEffect(() => {
    ready?.();
  }, [ready]);
  return children;
}

/** Call from an app-owned test page using development/profiling React. No actions are dispatched. */
export function conformancePage(options: PageOptions) {
  const catalog = value(validateCatalog(options.catalog));
  const validator = compileValidator(options);
  let renders = 0;
  let profiled = false;
  const { Surface } = createRenderer({
    catalog,
    implementations: options.implementations.map((implementation) => {
      const { definition, Component } = implementation[binding];
      return implement(definition, (props) => {
        renders++;
        return (
          <Profiler
            id={definition.kind}
            onRender={(_id, phase) => {
              profiled = true;
              // Include local/context updates below the binding wrapper.
              if (phase !== "mount") renders++;
            }}
          >
            <Component {...props} />
          </Profiler>
        );
      });
    }),
  });
  const registry = Object.fromEntries(
    options.designSystems.map((system) => [`${system.id}@${system.version}`, system]),
  );
  const sheets = [
    value(baseCss(catalog)),
    ...options.themes.map((theme) => value(themeCss(theme, catalog))),
    ...options.designSystems.map((system) => value(designSystemCss(system, { catalog, registry }))),
  ];
  const sheet = document.createElement("style");
  sheet.textContent = sheets.join("\n");
  document.head.append(sheet);
  const container = document.createElement("div");
  container.setAttribute("data-lf-conformance", "");
  document.body.append(container);
  let root: Root | undefined;
  let tree: unknown;
  let styles: Styles;
  let recorded: Intent[] = [];
  const onIntent = (intent: Intent) => {
    recorded.push(intent);
  };
  function accept(input: unknown, nextStyles: Styles) {
    // Malformed arrivals go to Surface's validator; non-tree commands never mount.
    if (
      !input ||
      typeof input !== "object" ||
      !("format" in input) ||
      input.format !== "liveframe/1" ||
      !("catalogId" in input) ||
      typeof input.catalogId !== "string" ||
      !("surfaceId" in input) ||
      typeof input.surfaceId !== "string" ||
      !("revision" in input) ||
      !Number.isSafeInteger(input.revision) ||
      !("root" in input) ||
      typeof input.root !== "object" ||
      input.root === null
    )
      throw new TypeError("Expected a UI tree");
    if (
      !options.themes.some(
        (theme) => theme.id === nextStyles?.theme?.id && theme.version === nextStyles.theme.version,
      ) ||
      !options.designSystems.some(
        (system) => system.id === nextStyles?.designSystem?.id && system.version === nextStyles.designSystem.version,
      )
    )
      throw new TypeError("Unknown theme or design system");
    tree = input;
    styles = nextStyles;
  }
  const surface = () => (
    <Surface tree={tree} validator={validator} {...styles} fallback={options.fallback} onIntent={onIntent} />
  );
  const draw = () => {
    root ??= createRoot(container);
    flushSync(() => root?.render(<Mounted>{surface()}</Mounted>));
  };
  const api = {
    mount(input: unknown, nextStyles: Styles) {
      accept(input, nextStyles);
      draw();
    },
    async hydrate(markup: string, input: unknown, nextStyles: Styles) {
      accept(input, nextStyles);
      if (root) flushSync(() => root?.unmount());
      recorded = [];
      container.innerHTML = markup;
      const nodes = [...container.querySelectorAll("*")];
      const errors: string[] = [];
      await new Promise<void>((resolve, reject) => {
        root = hydrateRoot(container, <Mounted ready={resolve}>{surface()}</Mounted>, {
          onRecoverableError: (error) => errors.push(String(error)),
          onCaughtError: (error) => errors.push(String(error)),
          onUncaughtError: reject,
        });
      });
      return { errors, retained: nodes.every((node) => container.contains(node)) };
    },
    switch(nextStyles: Styles) {
      accept(tree, nextStyles);
      draw();
    },
    intents: () => structuredClone(recorded),
    renders() {
      if (renders && !profiled)
        throw new Error("Conformance render counts require a development or profiling React build");
      return renders;
    },
  };
  window.liveframeConformance = api;
  return api;
}

declare global {
  interface Window {
    liveframeConformance: ReturnType<typeof conformancePage>;
  }
}
