import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { slotClass, styleDeclarations, surfaceAttributes } from "../../css/index.ts";
import { nodeAxisValues } from "../../formats/axes.ts";
import {
  type Catalog,
  type CompileValidatorOptions,
  compileValidator,
  type Result,
  type UiTree,
  validateCatalog,
} from "../../index.ts";
import { binding } from "../../react/implement.ts";
import { createRenderer, type Implementation, implement } from "../../react/index.ts";
import { type ConformanceCase, ConformanceFailure, check } from "../case.ts";

/** The root slot class of a node: its variant (or the default) and, for a kind with axes, its axis values. */
function rootClass(definition: Catalog["definitions"][number] | undefined, node: UiTree["root"]): string {
  const axes = definition && nodeAxisValues(definition, node.props);
  return slotClass(node.kind, node.variant ?? definition?.defaultVariant ?? "", "root", axes);
}

type Identity = { readonly id: string; readonly version: string };

// React's server serializer escapes attribute values, including quotes and angle brackets.
function elements(markup: string): Record<string, string>[] {
  return [...markup.matchAll(/<[a-z][^>]*>/g)].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value])),
  );
}

const entities: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#x27;": "'", "&lt;": "<", "&gt;": ">" };
const decoded = (value: string) => value.replace(/&(?:amp|quot|#x27|lt|gt);/g, (entity) => entities[entity] ?? entity);

/** Server examples must expose all their nodes; exercise deferred content in browser fixtures. */
export function rendererSuite({
  catalog,
  capabilities,
  manifest,
  implementations,
  themes,
  designSystems,
  examples,
  fallback,
}: CompileValidatorOptions & {
  readonly implementations: readonly Implementation[];
  readonly themes: readonly Identity[];
  readonly designSystems: readonly Identity[];
  readonly examples: readonly unknown[];
  readonly fallback: ReactNode;
}): ConformanceCase[] {
  const cases = {
    registry_check_passes() {
      createRenderer({ catalog, implementations });
    },
    every_example_renders_on_the_server_under_every_design_system() {
      each((tree, render, theme, designSystem, rule) => {
        const html = elements(render(tree));
        const { class: classes, ...attributes } = surfaceAttributes({ tree, theme, designSystem });
        const expected = elements(renderToString(<div {...attributes} />))[0] ?? {};
        check(
          html.some(
            (element) =>
              classes.split(" ").every((name) => element.class?.split(/\s+/).includes(name)) &&
              Object.entries(expected).every(([name, value]) => element[name] === value),
          ),
          rule,
          "§11",
          [
            `Missing surface attributes: ${tree.surfaceId}, ${theme.id}@${theme.version}, ${designSystem.id}@${designSystem.version}`,
          ],
        );
      }, "every_example_renders_on_the_server_under_every_design_system");
    },
    every_node_carries_its_root_slot_class_and_style() {
      each((tree, render, _theme, _designSystem, rule, installed) => {
        const html = elements(render(tree));
        const definitions = new Map(installed.definitions.map((d) => [d.kind, d]));
        const pending = [tree.root];
        const requirements = new Map<string, { classes: string[]; styles: string[]; count: number }>();
        for (const node of pending) {
          const projection = styleDeclarations(node.style ?? {}, installed);
          const classes = [rootClass(definitions.get(node.kind), node), ...[...projection.classes].sort()];
          const styles = (elements(renderToString(<div style={projection.style} />))[0]?.style ?? "")
            .split(";")
            .filter(Boolean)
            .sort();
          // Check total roots as well as counts for each distinct style projection.
          for (const requirement of [
            { classes: classes.slice(0, 1), styles: [] },
            ...(classes.length > 1 || styles.length ? [{ classes, styles }] : []),
          ]) {
            const key = JSON.stringify(requirement);
            const previous = requirements.get(key);
            if (previous) previous.count++;
            else requirements.set(key, { ...requirement, count: 1 });
          }
          pending.push(...(node.children ?? []));
        }
        for (const { classes, styles, count } of requirements.values()) {
          const found = html.filter(
            (element) =>
              classes.every((name) => element.class?.split(/\s+/).includes(name)) &&
              styles.every((declaration) => element.style?.split(";").includes(declaration)),
          ).length;
          check(found >= count, rule, "§11", [
            `${tree.surfaceId}: expected ${count} roots with ${classes.join(" ")} and ${styles.join(";")}; found ${found}`,
          ]);
        }
      }, "every_node_carries_its_root_slot_class_and_style");
    },
    invalid_arrival_renders_only_the_fallback() {
      let calls = 0;
      const counted = implementations.map((implementation) => {
        const { definition, Component } = implementation[binding];
        return implement(definition, (props) => {
          calls++;
          return <Component {...props} />;
        });
      });
      each(
        (tree, render, theme, designSystem, rule, installed) => {
          const { class: className, ...scope } = surfaceAttributes({
            theme,
            designSystem,
            tree: { ...tree, root: { id: "root", kind: "fallback", props: {} } },
          });
          const expected = renderToString(
            <>
              <div {...scope} className={className} tabIndex={-1}>
                {fallback}
              </div>
              <div {...scope} className={className} data-lf-portal="" />
            </>,
          );
          const target = tree.root.children?.[0] ?? tree.root;
          let unknownKind = "conformanceUnknownKind";
          while (installed.definitions.some((d) => d.kind === unknownKind)) unknownKind += "X";
          let unknownEvent = "conformanceUndeclaredEvent";
          const definition = installed.definitions.find((d) => d.kind === target.kind);
          while (Object.hasOwn(definition?.events ?? {}, unknownEvent)) unknownEvent += "X";
          for (const invalid of [
            { ...target, kind: unknownKind },
            {
              ...target,
              events: { ...target.events, [unknownEvent]: { type: "setState", key: "undeclared", value: null } },
            },
          ]) {
            const root =
              target === tree.root
                ? invalid
                : {
                    ...tree.root,
                    children: [invalid, ...(tree.root.children?.slice(1) ?? [])],
                  };
            calls = 0;
            check(render({ ...tree, root }) === expected && calls === 0, rule, "§11", [
              `${tree.surfaceId}: invalid arrival must render only fallback and call no implementation (calls: ${calls})`,
            ]);
          }
        },
        "invalid_arrival_renders_only_the_fallback",
        counted,
      );
    },
    ref_props_resolve_to_elements_in_the_surface() {
      const seen: string[] = [];
      const recorded = implementations.map((implementation) => {
        const { definition, Component } = implementation[binding];
        if (!definition.refProps?.length) return implementation;
        return implement(definition, (props) => {
          for (const name of definition.refProps ?? []) {
            const value = (props.props as Record<string, unknown>)[name];
            if (typeof value === "string") seen.push(value);
          }
          return <Component {...props} />;
        });
      });
      const rule = "ref_props_resolve_to_elements_in_the_surface";
      each(
        (tree, render) => {
          seen.length = 0;
          const ids = new Set(elements(render(tree)).flatMap((element) => (element.id ? [decoded(element.id)] : [])));
          for (const value of seen)
            check(ids.has(value), rule, "§11", [
              `${tree.surfaceId}: reference ${value} names no element; the target's implementation must render domId as its id`,
            ]);
        },
        rule,
        recorded,
      );
    },
  };
  function each(
    run: (
      tree: UiTree,
      render: (tree: unknown) => string,
      theme: Identity,
      designSystem: Identity,
      rule: string,
      installed: Catalog,
    ) => void,
    rule: string,
    bindings = implementations,
  ) {
    check(examples.length && themes.length && designSystems.length, rule, "§11", [
      "Supply at least one example, theme and design system",
    ]);
    const installed = validateCatalog(catalog);
    check(installed.ok, rule, "§11", installed.ok ? [] : installed.errors);
    const validator = compileValidator({ catalog: installed.value, capabilities, manifest });
    const { Surface } = createRenderer({ catalog, implementations: bindings });
    for (const example of examples) {
      const checked: Result<UiTree> = validator.validateTree(example);
      check(checked.ok, rule, "§11", checked.ok ? [] : checked.errors);
      for (const theme of themes)
        for (const designSystem of designSystems)
          run(
            checked.value,
            (tree) =>
              renderToString(
                <Surface
                  tree={tree}
                  validator={validator}
                  theme={theme}
                  designSystem={designSystem}
                  fallback={fallback}
                  onIntent={() => {}}
                />,
              ),
            theme,
            designSystem,
            rule,
            installed.value,
          );
    }
  }
  return Object.entries(cases).map(([name, run]) => ({
    name,
    async run() {
      try {
        run();
      } catch (error) {
        if (error instanceof ConformanceFailure) throw error;
        throw new ConformanceFailure(name, "§11", [error instanceof Error ? error.message : "Server rendering failed"]);
      }
    },
  }));
}
