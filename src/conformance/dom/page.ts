import { baseCss, designSystemCss, surfaceAttributes, themeCss } from "../../css/index.ts";
import { createDomRenderer, type DomImplementation, type DomSurface, implement } from "../../dom/index.ts";
import { domBinding } from "../../dom/implement.ts";
import {
  compileValidator,
  type Intent,
  type IntentOrigin,
  type Json,
  LiveframeFailure,
  type Result,
  type UiTree,
  validateCatalog,
} from "../../index.ts";
import type { SurfaceEvent } from "../../surface/index.ts";
import type { ConformancePageApi, DrawCall, Styles, SuiteOptions } from "../renderer/page.ts";

export type DomPageOptions = SuiteOptions & {
  implementations: readonly DomImplementation[];
  /** A new element each call, as `mount`'s `fallback` takes it. */
  fallback: () => Element;
};

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new LiveframeFailure(result.errors);
  return result.value;
}

/** Writes each declaration `name:value`, as a server serializer does, so structural cases compare one form. */
function canonicalStyle(style: string): string {
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => declaration.replace(/^([^:]+?)\s*:\s*/, "$1:"))
    .join(";");
}

/** The markup with every element's attributes sorted by name and its style declarations written `name:value`. */
function canonical(markup: string): string {
  const template = document.createElement("template");
  template.innerHTML = markup;
  for (const element of template.content.querySelectorAll("*")) {
    const attributes = [...element.attributes]
      .map(({ name, value }) => [name, name === "style" ? canonicalStyle(value) : value] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [name] of attributes) element.removeAttribute(name);
    for (const [name, value] of attributes) element.setAttribute(name, value);
  }
  return template.innerHTML;
}

const sameIdentity = (a: Styles["theme"], b: Styles["theme"]) => a.id === b.id && a.version === b.version;

/**
 * Call from an app-owned test page bundling `/dom` and the app's DOM implementations. It mounts one surface in a
 * `[data-lf-conformance]` container and records intents without dispatching actions.
 */
export function domConformancePage(options: DomPageOptions) {
  const catalog = value(validateCatalog(options.catalog));
  const validator = compileValidator(options);
  let renders = 0;
  let calls: DrawCall[] = [];
  const { mount: mountSurface } = createDomRenderer({
    catalog,
    implementations: options.implementations.map((implementation) => {
      const { definition, draw, hooks } = implementation[domBinding];
      return implement(
        definition,
        (node, element) => {
          renders++;
          calls.push({ kind: definition.kind, domId: node.domId, props: node.props as Readonly<Record<string, Json>> });
          return draw(node, element);
        },
        hooks,
      );
    }),
  });
  const registry = Object.fromEntries(
    options.designSystems.map((system) => [`${system.id}@${system.version}`, system]),
  );
  const sheet = document.createElement("style");
  sheet.textContent = [
    value(baseCss(catalog)),
    ...options.themes.map((theme) => value(themeCss(theme, catalog))),
    ...options.designSystems.map((system) => value(designSystemCss(system, { catalog, registry }))),
  ].join("\n");
  document.head.append(sheet);
  const container = document.createElement("div");
  container.setAttribute("data-lf-conformance", "");
  document.body.append(container);

  let surface: DomSurface | undefined;
  let tree: unknown;
  let styles: Styles;
  let invalid: "fallback" | "keep-last" = "fallback";
  const recorded: { intent: Intent; origin: IntentOrigin }[] = [];
  let events: SurfaceEvent[] = [];
  function accept(input: unknown, nextStyles: Styles) {
    // Malformed arrivals go to the surface's validator; non-tree commands never mount.
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
      !options.themes.some((theme) => sameIdentity(theme, nextStyles?.theme ?? { id: "", version: "" })) ||
      !options.designSystems.some((system) => sameIdentity(system, nextStyles?.designSystem ?? { id: "", version: "" }))
    )
      throw new TypeError("Unknown theme or design system");
    tree = input;
    styles = nextStyles;
  }
  function fresh(): DomSurface {
    surface?.dispose();
    surface = mountSurface(container, {
      validator,
      theme: styles.theme,
      designSystem: styles.designSystem,
      fallback: options.fallback,
      invalid,
      onIntent: (intent, origin) => {
        recorded.push({ intent, origin });
      },
      onEvent: (event) => {
        events.push(event);
      },
    });
    return surface;
  }
  /** Applies the current styles and mode to the mounted surface: a changed scope runs the switching sequence. */
  function restyle(current: DomSurface, before: Styles | undefined) {
    if (!before || !sameIdentity(before.theme, styles.theme) || !sameIdentity(before.designSystem, styles.designSystem))
      current.set({ theme: styles.theme, designSystem: styles.designSystem });
  }
  const api = {
    mount(input: unknown, nextStyles: Styles, mode: "fallback" | "keep-last" = "fallback") {
      const before = surface ? styles : undefined;
      accept(input, nextStyles);
      const current = surface ?? fresh();
      restyle(current, before);
      if (mode !== invalid) {
        invalid = mode;
        current.set({ invalid });
      }
      current.update(tree);
    },
    switch(nextStyles: Styles) {
      const before = styles;
      accept(tree, nextStyles);
      if (surface) restyle(surface, before);
    },
    structure(input: unknown, nextStyles: Styles) {
      accept(input, nextStyles);
      invalid = "fallback";
      calls = [];
      events = [];
      fresh().update(input);
      return { html: canonical(container.innerHTML), calls: structuredClone(calls), events: structuredClone(events) };
    },
    fallbackMarkup(canonicalForm = false) {
      const markup = options.fallback().outerHTML;
      return canonicalForm ? canonical(markup) : markup;
    },
    fallbackSurface(input: unknown, nextStyles: Styles) {
      const scope = surfaceAttributes({
        ...nextStyles,
        tree: { ...(input as UiTree), root: { id: "root", kind: "fallback", props: {} } },
      });
      const parts = [document.createElement("div"), document.createElement("div")] as const;
      for (const part of parts)
        for (const [name, value] of Object.entries(scope)) part.setAttribute(name, String(value));
      parts[0].setAttribute("tabindex", "-1");
      parts[0].append(options.fallback());
      parts[1].setAttribute("data-lf-portal", "");
      return canonical(parts.map((part) => part.outerHTML).join(""));
    },
    intents: () => structuredClone(recorded.map(({ intent }) => intent)),
    emissions: () => structuredClone(recorded),
    /** What the surface reported to `onEvent`, such as `focus-missed`. */
    events: () => structuredClone(events),
    renders: () => renders,
  };
  window.liveframeConformance = api satisfies ConformancePageApi;
  return api;
}
