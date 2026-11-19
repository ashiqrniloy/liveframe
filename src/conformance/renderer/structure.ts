// The renderer's structural cases, shared by `/conformance/react` (on server markup) and `/conformance/dom` (on the
// browser page's markup, since `/dom` has no server rendering). An adapter renders a tree and reports what it drew.
import { slotClass, styleDeclarations, surfaceAttributes } from "../../css/index.ts";
import { nodeAxisValues } from "../../formats/axes.ts";
import {
  type Catalog,
  type CompileValidatorOptions,
  compileValidator,
  type Result,
  type UiNode,
  type UiTree,
  validateCatalog,
} from "../../index.ts";
import { ConformanceFailure, check } from "../case.ts";
import type { Structure } from "./page.ts";

/** The root slot class of a node: its variant (or the default) and, for a kind with axes, its axis values. */
function rootClass(definition: Catalog["definitions"][number] | undefined, node: UiTree["root"]): string {
  const axes = definition && nodeAxisValues(definition, node.props);
  return slotClass(node.kind, node.variant ?? definition?.defaultVariant ?? "", "root", axes);
}

/** `tree` with `target` replaced by `node`; `target` is the root or one of its children. */
function withNode(tree: UiTree, target: UiNode, node: UiNode): UiTree {
  if (target === tree.root) return { ...tree, root: node };
  const children = (tree.root.children ?? []).map((child) => (child === target ? node : child));
  return { ...tree, root: { ...tree.root, children } };
}

type Identity = { readonly id: string; readonly version: string };

// Serializers escape attribute values, including quotes and angle brackets.
function elements(markup: string): Record<string, string>[] {
  return [...markup.matchAll(/<[a-z][^>]*>/g)].map(([tag]) =>
    Object.fromEntries([...tag.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value])),
  );
}

// A condition that passes the static checks and fails when evaluated: the renderer must draw the node fallback.
const failingWhen = { $eq: [{ $div: [1, 0] }, 1] };

const entities: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#x27;": "'", "&lt;": "<", "&gt;": ">" };
const decoded = (value: string) => value.replace(/&(?:amp|quot|#x27|lt|gt);/g, (entity) => entities[entity] ?? entity);

const hyphenated = (name: string) =>
  name.startsWith("--") ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/** Style declarations as a serializer writes them in a `style` attribute: `name:value`. */
const declarations = (style: Readonly<Record<string, string>>) =>
  Object.entries(style).map(([name, value]) => `${hyphenated(name)}:${value}`);

export type StructureOptions = CompileValidatorOptions & {
  readonly themes: readonly Identity[];
  readonly designSystems: readonly Identity[];
  readonly examples: readonly unknown[];
};

/** Renders trees for the structural cases. */
export type StructureRenderer = {
  /** Draws `tree` afresh and reports the markup, every implementation call and every surface event. */
  render(tree: unknown, theme: Identity, designSystem: Identity, onEvent?: boolean): Promise<Structure>;
  /** The markup a wholly invalid arrival of `tree` must draw. */
  fallbackSurface(tree: UiTree, theme: Identity, designSystem: Identity): Promise<string>;
  /** The markup of one fallback, as `render` writes it. */
  fallbackMarkup(): Promise<string>;
};

/**
 * The structural cases, by name. `open` gives a renderer for one case run; the cases close it when they finish.
 * Examples must expose all their nodes; exercise deferred content in browser fixtures.
 */
export function structureCases(
  { catalog, capabilities, manifest, themes, designSystems, examples }: StructureOptions,
  open: () => Promise<{ readonly renderer: StructureRenderer; close(): Promise<void> }>,
): Record<string, () => Promise<void>> {
  const cases = {
    async every_example_renders_on_the_server_under_every_design_system() {
      await each(async (tree, renderer, theme, designSystem, rule) => {
        const drawn = await renderer.render(tree, theme, designSystem, true);
        const html = elements(drawn.html);
        const { class: classes, ...expected } = surfaceAttributes({ tree, theme, designSystem });
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
        // An adapter that contains a throwing implementation still drew a fallback in its place.
        const failed = drawn.events.filter((event) => event.type === "implementation-failed");
        check(!failed.length, rule, "§11", [
          `${tree.surfaceId}: an implementation threw: ${failed.map((event) => JSON.stringify(event)).join(", ")}`,
        ]);
      }, "every_example_renders_on_the_server_under_every_design_system");
    },
    async every_node_carries_its_root_slot_class_and_style() {
      await each(async (tree, renderer, theme, designSystem, rule, installed) => {
        const html = elements((await renderer.render(tree, theme, designSystem)).html);
        const definitions = new Map(installed.definitions.map((d) => [d.kind, d]));
        const pending = [tree.root];
        const requirements = new Map<string, { classes: string[]; styles: string[]; count: number }>();
        for (const node of pending) {
          const projection = styleDeclarations(node.style ?? {}, installed);
          const classes = [rootClass(definitions.get(node.kind), node), ...[...projection.classes].sort()];
          const styles = declarations(projection.style).sort();
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
    async invalid_arrival_renders_only_the_fallback() {
      await each(async (tree, renderer, theme, designSystem, rule, installed) => {
        const expected = await renderer.fallbackSurface(tree, theme, designSystem);
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
          const drawn = await renderer.render({ ...tree, root }, theme, designSystem);
          check(drawn.html === expected && drawn.calls.length === 0, rule, "§11", [
            `${tree.surfaceId}: invalid arrival must render only fallback and call no implementation (calls: ${drawn.calls.length})`,
          ]);
        }
      }, "invalid_arrival_renders_only_the_fallback");
    },
    async ref_props_resolve_to_elements_in_the_surface() {
      const rule = "ref_props_resolve_to_elements_in_the_surface";
      await each(async (tree, renderer, theme, designSystem, _rule, installed) => {
        const referring = new Map(installed.definitions.map((d) => [d.kind, d.refProps ?? []]));
        const drawn = await renderer.render(tree, theme, designSystem);
        const seen = drawn.calls.flatMap((call) =>
          (referring.get(call.kind) ?? []).flatMap((name) => {
            const value = call.props[name];
            return typeof value === "string" ? [value] : [];
          }),
        );
        const ids = new Set(elements(drawn.html).flatMap((element) => (element.id ? [decoded(element.id)] : [])));
        for (const value of seen)
          check(ids.has(value), rule, "§11", [
            `${tree.surfaceId}: reference ${value} names no element; the target's implementation must render domId as its id`,
          ]);
      }, rule);
    },
    async failed_binding_draws_the_node_fallback() {
      const rule = "failed_binding_draws_the_node_fallback";
      await each(async (tree, renderer, theme, designSystem, _rule, installed) => {
        const marker = await renderer.fallbackMarkup();
        // The first child whose gate the validator accepts (a parent's child-count bounds may refuse one).
        const validator = compileValidator({ catalog: installed, capabilities, manifest });
        const candidates = [...(tree.root.children ?? []), tree.root];
        const failing = candidates
          .map((target) => ({ target, tree: withNode(tree, target, { ...target, when: failingWhen }) }))
          .find((candidate) => validator.validateTree(candidate.tree).ok);
        check(failing, rule, "§13", [`${tree.surfaceId}: no node of this example accepts a \`when\``]);
        const { target } = failing;
        const drawn = await renderer.render(failing.tree, theme, designSystem, true);
        const called = new Set(drawn.calls.map((call) => call.domId));
        const drawnFallbacks = drawn.html.split(marker).length - 1;
        const wholeSurface =
          target !== tree.root &&
          !drawn.html.includes(
            rootClass(
              installed.definitions.find((d) => d.kind === tree.root.kind),
              tree.root,
            ),
          );
        check(
          drawnFallbacks > 0 && !wholeSurface && ![...called].some((domId) => domId.endsWith(`:${target.id}`)),
          rule,
          "§8",
          [
            `${tree.surfaceId}: ${target.id} has a failing binding; the renderer must draw the node fallback in its place, keep the rest of the surface and call no implementation for it`,
          ],
        );
        check(
          drawn.events.some((event) => event.type === "binding-failed" && event.nodeId === target.id),
          rule,
          "§11",
          [`${tree.surfaceId}: no binding-failed event for ${target.id}`],
        );
      }, rule);
    },
  };
  async function each(
    run: (
      tree: UiTree,
      renderer: StructureRenderer,
      theme: Identity,
      designSystem: Identity,
      rule: string,
      installed: Catalog,
    ) => Promise<void>,
    rule: string,
  ) {
    check(examples.length && themes.length && designSystems.length, rule, "§11", [
      "Supply at least one example, theme and design system",
    ]);
    const installed = validateCatalog(catalog);
    check(installed.ok, rule, "§11", installed.ok ? [] : installed.errors);
    const validator = compileValidator({ catalog: installed.value, capabilities, manifest });
    const { renderer, close } = await open();
    try {
      for (const example of examples) {
        const checked: Result<UiTree> = validator.validateTree(example);
        check(checked.ok, rule, "§11", checked.ok ? [] : checked.errors);
        for (const theme of themes)
          for (const designSystem of designSystems)
            await run(checked.value, renderer, theme, designSystem, rule, installed.value);
      }
    } finally {
      await close();
    }
  }
  return cases;
}

/** Wraps each structural case so an unexpected error is reported against the case's rule. */
export function structureSuiteCases(cases: Record<string, () => Promise<void>>, message: string) {
  return Object.entries(cases).map(([name, run]) => ({
    name,
    async run() {
      try {
        await run();
      } catch (error) {
        if (error instanceof ConformanceFailure) throw error;
        throw new ConformanceFailure(name, "§11", [error instanceof Error ? error.message : message]);
      }
    },
  }));
}
