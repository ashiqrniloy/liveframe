import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { surfaceAttributes } from "../../css/index.ts";
import { type CompileValidatorOptions, compileValidator, type Json, validateCatalog } from "../../index.ts";
import { binding } from "../../react/implement.ts";
import { createRenderer, type Implementation, implement } from "../../react/index.ts";
import type { SurfaceEvent } from "../../surface/index.ts";
import type { ConformanceCase } from "../case.ts";
import type { DrawCall } from "../renderer/page.ts";
import { type StructureRenderer, structureCases, structureSuiteCases } from "../renderer/structure.ts";

type Identity = { readonly id: string; readonly version: string };

/** Server examples must expose all their nodes; exercise deferred content in browser fixtures. */
export function rendererSuite(
  options: CompileValidatorOptions & {
    readonly implementations: readonly Implementation[];
    readonly themes: readonly Identity[];
    readonly designSystems: readonly Identity[];
    readonly examples: readonly unknown[];
    readonly fallback: ReactNode;
  },
): ConformanceCase[] {
  const { catalog, capabilities, manifest, implementations, fallback } = options;
  // Each implementation records its call, so the cases see what was drawn without reading React internals.
  let calls: DrawCall[] = [];
  const recorded = implementations.map((implementation) => {
    const { definition, Component } = implementation[binding];
    return implement(definition, (props) => {
      calls.push({ kind: definition.kind, domId: props.domId, props: props.props as Readonly<Record<string, Json>> });
      return <Component {...props} />;
    });
  });
  const open = async () => {
    const installed = validateCatalog(catalog);
    const validator = compileValidator({ catalog: installed.ok ? installed.value : catalog, capabilities, manifest });
    const { Surface } = createRenderer({ catalog, implementations: recorded });
    const renderer: StructureRenderer = {
      async render(tree, theme, designSystem, observe) {
        calls = [];
        const events: SurfaceEvent[] = [];
        const html = renderToString(
          <Surface
            tree={tree}
            validator={validator}
            theme={theme}
            designSystem={designSystem}
            fallback={fallback}
            onIntent={() => {}}
            {...(observe ? { onEvent: (event: SurfaceEvent) => void events.push(event) } : {})}
          />,
        );
        return { html, calls, events };
      },
      async fallbackSurface(tree, theme, designSystem) {
        const { class: className, ...scope } = surfaceAttributes({
          theme,
          designSystem,
          tree: { ...tree, root: { id: "root", kind: "fallback", props: {} } },
        });
        return renderToString(
          <>
            <div {...scope} className={className} tabIndex={-1}>
              {fallback}
            </div>
            <div {...scope} className={className} data-lf-portal="" />
          </>,
        );
      },
      async fallbackMarkup() {
        return renderToString(<>{fallback}</>);
      },
    };
    return { renderer, close: async () => {} };
  };
  return structureSuiteCases(
    {
      async registry_check_passes() {
        createRenderer({ catalog, implementations });
      },
      ...structureCases(options, open),
    },
    "Server rendering failed",
  );
}
