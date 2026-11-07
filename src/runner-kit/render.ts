import { LiveframeFailure, type Result } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import { validateJson } from "../formats/json.ts";
import type { Manifest } from "../formats/manifest.ts";
import type { UiTree } from "../formats/tree.ts";
import { errorMessage } from "../internal.ts";
import { canonicalJson } from "../pack/hash.ts";
import { render } from "../sdk/render.ts";
import type { WidgetProps } from "../sdk/types.ts";
import type { Template } from "../template/document.ts";
import { renderTemplate, type TemplateLimits } from "../template/render.ts";
import { compiledValidator } from "./cache.ts";

export type RenderModuleOptions = {
  readonly catalog: Catalog;
  readonly capabilities: Capabilities;
  readonly manifest: Manifest;
  readonly surfaceId: string;
  readonly revision: number;
  readonly limits?: TemplateLimits;
  readonly maxErrors?: number;
};

/** A manifest is immutable for a render, so its canonical text is computed once per object. */
const manifestKeys = new WeakMap<Manifest, string>();

function manifestKey(manifest: Manifest): string {
  let key = manifestKeys.get(manifest);
  if (key === undefined) {
    key = canonicalJson(manifest);
    manifestKeys.set(manifest, key);
  }
  return key;
}

/** The manifest's cache key, or the errors that say why it is not JSON. */
function manifestKeyOrErrors(manifest: Manifest): string | Result<never> {
  try {
    return manifestKey(manifest);
  } catch {
    const checked = validateJson(manifest);
    if (!checked.ok)
      return { ok: false, errors: checked.errors.map((error) => ({ ...error, pointer: `/manifest${error.pointer}` })) };
    return {
      ok: false,
      errors: [{ kind: "invalid-document", pointer: "/manifest", message: "Manifest must be a JSON value" }],
    };
  }
}

/**
 * @internal Renders a loaded module's default export against a validator cached under
 * `key`; `renderModule` keys by manifest, the reference runners by verified package hash.
 */
export function renderWidget(
  widget: unknown,
  inputs: WidgetProps,
  options: RenderModuleOptions,
  key: string,
): Result<UiTree> {
  try {
    if (typeof widget !== "function") throw new Error("Widget module must have a function default export");
    const { surfaceId, revision, limits, maxErrors } = options;
    return render((props) => widget(props), inputs, {
      validator: compiledValidator(options, key),
      surfaceId,
      revision,
      ...(limits ? { limits } : {}),
      ...(maxErrors === undefined ? {} : { maxErrors }),
    });
  } catch (error) {
    if (error instanceof LiveframeFailure) return { ok: false, errors: error.errors };
    return {
      ok: false,
      errors: [{ kind: "render-failed", pointer: "", message: errorMessage(error) }],
    };
  }
}

/**
 * @internal Renders a template against a validator cached under `key`, with the error handling
 * `renderWidget` has. A template runs no author code.
 */
export function renderTemplateWidget(
  template: Template,
  inputs: WidgetProps,
  options: RenderModuleOptions,
  key: string,
): Result<UiTree> {
  try {
    const { surfaceId, revision, limits, maxErrors } = options;
    return renderTemplate(template, inputs, {
      validator: compiledValidator(options, key),
      surfaceId,
      revision,
      ...(limits ? { limits } : {}),
      ...(maxErrors === undefined ? {} : { maxErrors }),
    });
  } catch (error) {
    if (error instanceof LiveframeFailure) return { ok: false, errors: error.errors };
    return { ok: false, errors: [{ kind: "render-failed", pointer: "", message: errorMessage(error) }] };
  }
}

/**
 * The in-sandbox half of a runner: calls a loaded widget module's default export and
 * returns a validated tree, exactly as `render()` does. It is synchronous, so it
 * cannot bound a widget's time; the sandbox does. It is not an isolation boundary, and
 * the host must still validate every tree it receives from a sandbox (law 2). The
 * compiled validator is cached for the 64 most recent manifests per `(catalog,
 * capabilities)`. Throwing widgets and non-function defaults are `render-failed`.
 */
export function renderModule(
  widgetDefault: unknown,
  inputs: WidgetProps,
  options: RenderModuleOptions,
): Result<UiTree> {
  const key = manifestKeyOrErrors(options.manifest);
  return typeof key === "string" ? renderWidget(widgetDefault, inputs, options, key) : key;
}

/**
 * The in-sandbox half of a template runner: renders a template package's document exactly as
 * `renderTemplate` does and returns a validated tree. It runs no author code, so it needs no
 * sandbox; the host still validates every tree it receives from one (law 2). The compiled validator
 * is cached with `renderModule`'s.
 */
export function renderTemplatePackage(
  template: Template,
  inputs: WidgetProps,
  options: RenderModuleOptions,
): Result<UiTree> {
  const key = manifestKeyOrErrors(options.manifest);
  return typeof key === "string" ? renderTemplateWidget(template, inputs, options, key) : key;
}
