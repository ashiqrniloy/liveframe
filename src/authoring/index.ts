import { LiveframeFailure, type LiveframeError, type Result } from "../errors.ts";
import { type Capabilities, isRecord } from "../formats/capabilities.ts";
import type { Catalog, Definition } from "../formats/catalog.ts";
import { validateJson } from "../formats/json.ts";
import { validateManifestShape } from "../formats/manifest.ts";
import { type Scenario, validateScenario, type WidgetPackage } from "../formats/package.ts";
import type { Json, UiNode, UiTree } from "../formats/tree.ts";
import { canonicalJson, utf8 } from "../pack/hash.ts";
import { outcomeScenarios } from "../pack/outcome.ts";
import type { PreviewBinding, PreviewSession } from "../preview/authoring.ts";
import { type CaptureBackend, CaptureError, capture } from "../preview/capture/index.ts";
import type { Runner } from "../preview/runner.ts";
import { createPreview } from "../preview/session.ts";
import { isLanguageSchema, sourceOutcome } from "../schema.ts";
import { generate, generateDefinitions, generateElementsSchema } from "../sdk/gen.ts";
import { complete } from "../validate/complete.ts";
import { checkAll, type ScenarioStatus } from "./checks.ts";

export type AuthoringOptions = {
  readonly catalog: Catalog;
  readonly capabilities: Capabilities;
  readonly runner: Runner;
  readonly preview?: (binding: PreviewBinding) => Promise<{ readonly url: string; close(): Promise<void> }>;
  readonly capture?: CaptureBackend;
  /** Per-call capture cell bound: integer 1–48, default 12. Invalid values throw LiveframeFailure. */
  readonly maxCaptureCells?: number;
  readonly exposeMeta?: boolean;
};

/** Summary of the draft last packed successfully. */
export type PackedDraft = {
  hash: string;
  id: string;
  version: string;
  description?: string;
  meta?: Json;
  scenarios: readonly string[];
};

export type CaptureInput = { scenarios?: string[]; widths?: number[]; themes?: string[]; designSystems?: string[] };
export type AuthoringCaptureCell = {
  scenario: string;
  width: number;
  theme: string;
  designSystem: string;
  errors: readonly LiveframeError[];
  aria: string | null;
  png: Uint8Array;
};

/** Host `meta` is the host's own annotation; an agent sees it only when the config opts in. */
function withoutMeta(capabilities: Capabilities): Capabilities {
  const dropMeta = <T extends Record<string, { meta?: unknown }>>(entries: T): T =>
    Object.fromEntries(Object.entries(entries).map(([name, { meta: _, ...rest }]) => [name, rest])) as T;
  return { ...capabilities, actions: dropMeta(capabilities.actions), sources: dropMeta(capabilities.sources) };
}

/** A tree larger than this is refused: a whole tree is a poor tool result, and 256 KiB is plenty. */
const MAX_TREE_BYTES = 262144;

const at = (pointer: string, message: string, expected?: string): LiveframeError => ({
  kind: "invalid-document",
  pointer,
  message,
  ...(expected === undefined ? {} : { expected }),
});

/** Errors validated against a document take that document's root, not the tool's argument object. */
const rooted = (base: string, errors: readonly LiveframeError[]): LiveframeError[] =>
  errors.map((error) => ({ ...error, pointer: `${base}${error.pointer}` }));

const key = (path: string) => path.replaceAll("~", "~0").replaceAll("/", "~1");

export type PackInput = Parameters<PreviewSession["update"]>[0];
export type RenderInput = { scenario?: string; state?: Json; context?: Json; outcomes?: boolean };
export type SetStateInput = { origin: { nodeId: string; event: string }; value?: Json };

function setStateArguments(input: unknown): Result<SetStateInput> {
  if (!isRecord(input) || !isRecord(input.origin))
    return { ok: false, errors: [at("/origin", "Expected an origin with nodeId and event")] };
  for (const field of ["nodeId", "event"] as const)
    if (typeof input.origin[field] !== "string" || !input.origin[field].length)
      return { ok: false, errors: [at(`/origin/${field}`, "Expected a non-empty string")] };
  if (input.value !== undefined) {
    const checked = validateJson(input.value);
    if (!checked.ok) return { ok: false, errors: rooted("/value", checked.errors) };
  }
  return { ok: true, value: input as SetStateInput };
}

/** `pack_draft`'s arguments, checked before the packer so its error set is the whole answer. */
function packArguments(input: unknown): Result<PackInput> {
  if (!isRecord(input))
    return { ok: false, errors: [at("", "Expected an object with files, entry, manifest and scenarios")] };
  const { files, entry, manifest, scenarios } = input;
  const errors: LiveframeError[] = [];
  if (!isRecord(files) || Object.keys(files).length === 0)
    errors.push(at("/files", "Expected a non-empty object of source files"));
  else
    for (const [path, source] of Object.entries(files))
      if (typeof source !== "string") errors.push(at(`/files/${key(path)}`, "Expected a source string"));
  if (typeof entry !== "string" || entry.length === 0)
    errors.push(at("/entry", "Expected the entry file path", "one of the keys of files"));
  else if (!isRecord(files) || !Object.hasOwn(files, entry))
    errors.push(at("/entry", `No file is named "${entry}"`, "one of the keys of files"));
  const shaped = validateManifestShape(manifest);
  if (!shaped.ok) errors.push(...rooted("/manifest", shaped.errors));
  if (!Array.isArray(scenarios) || scenarios.length === 0 || scenarios.length > 64)
    errors.push(at("/scenarios", "Expected one to 64 scenarios"));
  else
    for (const [index, scenario] of scenarios.entries()) {
      const checked = validateScenario(scenario);
      if (!checked.ok) errors.push(...rooted(`/scenarios/${index}`, checked.errors));
    }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input as PackInput };
}

/** `render_scenarios`' arguments: a scenario name and two JSON overrides. */
function renderArguments(input: unknown): Result<RenderInput> {
  if (!isRecord(input)) return { ok: false, errors: [at("", "Expected an object with scenario, state and context")] };
  const errors: LiveframeError[] = [];
  if (input.scenario !== undefined && (typeof input.scenario !== "string" || input.scenario.length === 0))
    errors.push(at("/scenario", "Expected a scenario name"));
  if (input.outcomes !== undefined && typeof input.outcomes !== "boolean")
    errors.push(at("/outcomes", "Expected a boolean"));
  for (const name of ["state", "context"] as const) {
    const value = input[name];
    if (value === undefined) continue;
    const checked = validateJson(value);
    if (!checked.ok) errors.push(...rooted(`/${name}`, checked.errors));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input as RenderInput };
}

function serialize(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.catch(() => {}); // a failed call must not break the queue
    return run;
  };
}

function success<T>(value: T): Result<T> {
  return { ok: true, value };
}
const failure = (kind: LiveframeError["kind"], pointer: string, message: string): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer, message }],
});
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
let nextAuthoring = 0;

/** Backend-only authoring. The host supplies its runner; no operation grants runtime authority. */
export function createAuthoring(options: AuthoringOptions) {
  const maxCaptureCells = options.maxCaptureCells === undefined ? 12 : options.maxCaptureCells;
  if (!Number.isInteger(maxCaptureCells) || maxCaptureCells < 1 || maxCaptureCells > 48)
    throw new LiveframeFailure([at("/maxCaptureCells", "Expected maxCaptureCells to be an integer from 1 to 48")]);
  const { catalog, capabilities, runner } = options;
  const exposeMeta = options.exposeMeta === true;
  const session = createPreview({ catalog, capabilities, runner });
  const exclusive = serialize();
  const surfaceId = `authoring-${++nextAuthoring}`;
  let revision = 0;
  let packed: WidgetPackage | undefined;
  let current: { scenario: string; tree: UiTree } | undefined;
  let bound: Promise<{ readonly url: string; close(): Promise<void> }> | undefined;

  function bounded(result: Result<UiTree>, scenario: string): Result<UiTree> {
    if (!result.ok) return result;
    const size = utf8(JSON.stringify(result.value)).byteLength;
    if (size > MAX_TREE_BYTES)
      return {
        ok: false,
        errors: [
          {
            kind: "limit-exceeded",
            pointer: "/scenario",
            message: `Scenario "${scenario}" rendered ${size} bytes, over the ${MAX_TREE_BYTES}-byte limit`,
            expected: `a tree of at most ${MAX_TREE_BYTES} bytes`,
          },
        ],
      };
    return result;
  }

  function remember(result: Result<UiTree>, scenario: string): Result<UiTree> {
    const checked = bounded(result, scenario);
    current = checked.ok ? { scenario, tree: checked.value } : undefined;
    return checked;
  }

  async function renderOne(input: RenderInput): Promise<Result<UiTree>> {
    return remember(
      await session.render({ ...input, scenario: input.scenario!, preserveState: false }),
      input.scenario!,
    );
  }

  // Page snapshots advance revisions too; keep the tool's origin tied to the served tree.
  const boundSession: PreviewSession = {
    ...session,
    async render(input) {
      const result = await session.render(input);
      if (current?.scenario === input.scenario) remember(result, input.scenario);
      else current = undefined;
      return result;
    },
    async intent(intent, origin) {
      const result = await session.intent(intent, origin);
      if (current && result.ok) remember(result, current.scenario);
      return result;
    },
  };

  async function renderOutcomes(input: RenderInput): Promise<Result<ScenarioStatus[]>> {
    const pkg = packed!;
    const selected =
      input.scenario === undefined ? pkg.scenarios : pkg.scenarios.filter((s) => s.name === input.scenario);
    if (!selected.length) return failure("not-found", "/scenario", "Unknown scenario");
    const expanded: Scenario[] = [];
    for (const scenario of selected) {
      const sources = Object.keys(scenario.data).filter((alias) => {
        const declaration = Object.hasOwn(pkg.manifest.sources, alias) ? pkg.manifest.sources[alias] : undefined;
        const schema =
          declaration && Object.hasOwn(capabilities.sources, declaration.source)
            ? capabilities.sources[declaration.source]?.result
            : undefined;
        const payload =
          isLanguageSchema(schema) && "mapping" in schema ? schema.mapping.ok?.properties.value : undefined;
        return payload !== undefined && canonicalJson(schema) === canonicalJson(sourceOutcome(payload));
      });
      const pointer = `/scenarios/${pkg.scenarios.indexOf(scenario)}`;
      if (sources.length > 1)
        return failure(
          "invalid-document",
          pointer,
          "Outcome expansion requires at most one sourceOutcome source per scenario",
        );
      if (sources.length === 0) expanded.push(scenario);
      else {
        const result = outcomeScenarios(scenario, { source: sources[0]!, manifest: pkg.manifest, capabilities });
        if (!result.ok) return { ok: false, errors: rooted(pointer, result.errors) };
        expanded.push(...result.value);
      }
    }
    const results = [];
    for (const scenario of expanded) {
      const result = await runner.render(
        pkg,
        {
          params: scenario.params,
          state: input.state === undefined ? (scenario.state ?? pkg.manifest.initialState) : input.state,
          context: input.context === undefined ? scenario.context : input.context,
          data: scenario.data,
        },
        { catalog, capabilities, surfaceId, revision: ++revision },
      );
      results.push({ scenario: scenario.name, result });
    }
    return success(checkAll(results));
  }

  return {
    async listPrimitives({ kinds }: { kinds?: string[] } = {}): Promise<Result<readonly Definition[]>> {
      const known = catalog.definitions.map((definition) => definition.kind);
      const unknown = kinds?.filter((kind) => !known.includes(kind)) ?? [];
      if (unknown.length)
        return {
          ok: false as const,
          errors: unknown.map((kind) => ({
            kind: "unknown-component" as const,
            pointer: `/kinds/${kinds?.indexOf(kind) ?? 0}`,
            message: `Unknown kind "${kind}"`,
            expected: known.join(", "),
          })),
        };
      return success(
        kinds ? catalog.definitions.filter((definition) => kinds.includes(definition.kind)) : catalog.definitions,
      );
    },
    async listVocabulary() {
      return success({ catalogId: catalog.catalogId, vocabulary: catalog.vocabulary });
    },
    async listCapabilities() {
      return success(exposeMeta ? capabilities : withoutMeta(capabilities));
    },
    async generatedTypes({ module = "types" }: { module?: "types" | "implementations" | "elementsSchema" } = {}) {
      if (module === "implementations")
        return success({
          note: 'Save this as ui.definitions.gen.ts and import from "./ui.definitions.gen".',
          types: generateDefinitions(catalog),
        });
      if (module === "elementsSchema")
        return success({
          note: "Save this as elements.schema.json to validate agent-authored elements.",
          types: generateElementsSchema(catalog),
        });
      if (module !== "types")
        return {
          ok: false as const,
          errors: [at("/module", "Unknown generated module", '"types", "implementations", "elementsSchema"')],
        };
      return success({
        note: 'Save this as ui.gen.ts beside the widget and import from "./ui.gen".',
        types: generate(catalog),
      });
    },
    packDraft(input: PackInput): Promise<Result<PackedDraft>> {
      return exclusive(async () => {
        const checked = packArguments(input);
        if (!checked.ok) return checked;
        const result = session.update(checked.value);
        if (!result.ok) return result;
        packed = result.value;
        current = undefined;
        const { manifest, scenarios, hash } = packed;
        return success({
          hash,
          id: manifest.id,
          version: manifest.version,
          ...(manifest.description === undefined ? {} : { description: manifest.description }),
          ...(exposeMeta && manifest.meta !== undefined ? { meta: manifest.meta } : {}),
          scenarios: scenarios.map(({ name }) => name),
        });
      });
    },
    renderScenarios(input: RenderInput = {}): Promise<Result<UiTree | ScenarioStatus[]>> {
      return exclusive(async () => {
        const checked = renderArguments(input);
        if (!checked.ok) return checked;
        if (!packed) return failure("not-found", "", "Call pack_draft before render_scenarios");
        if (input.outcomes) return renderOutcomes(input);
        if (input.scenario !== undefined) return renderOne(input);
        const results = await session.check();
        return results.ok ? success(checkAll(results.value)) : results;
      });
    },
    setState(input: SetStateInput): Promise<Result<UiTree>> {
      return exclusive(async () => {
        if (!current) return failure("not-found", "", "Call render_scenarios with a scenario first");
        const checked = setStateArguments(input);
        if (!checked.ok) return checked;
        const { tree, scenario } = current;
        const find = (node: UiNode): UiNode | undefined =>
          node.id === input.origin.nodeId ? node : node.children?.map(find).find(Boolean);
        const node = find(tree.root);
        if (!node) return failure("not-found", "/origin/nodeId", "Unknown origin node");
        const offered =
          node.events && Object.hasOwn(node.events, input.origin.event) ? node.events[input.origin.event] : undefined;
        if (!offered) return failure("undeclared-event", "/origin/event", "Event was not offered by this node");
        if (offered.type !== "setState")
          return failure("invalid-prop", "/origin/event", "Expected an offered setState event; actions are refused");
        const result = await session.intent(complete(offered, input.value), {
          surfaceId: tree.surfaceId,
          revision: tree.revision,
          nodeId: input.origin.nodeId,
          event: input.origin.event,
        });
        return result.ok ? remember(result, scenario) : result;
      });
    },
    capturePreview(input: CaptureInput = {}): Promise<Result<AuthoringCaptureCell[]>> {
      return exclusive(async () => {
        if (!packed) return failure("not-found", "", "Call pack_draft before capture_preview");
        let url: string;
        try {
          if (!options.preview)
            throw new Error(
              "The config module names no preview(): add `preview: async (binding) => ({ url, close })` to serve the app's own page.",
            );
          bound ??= options.preview({ session: boundSession, package: () => packed! });
          const bridge = await bound.catch((error: unknown) => {
            bound = undefined;
            throw error;
          });
          url = bridge.url;
        } catch (error) {
          return failure("not-found", "", message(error));
        }
        try {
          if (!options.capture)
            return failure("not-found", "", "No capture backend configured: inject capture in createAuthoring().");
          const { index, files } = await capture(url, {
            ...input,
            backend: options.capture,
            maxCells: maxCaptureCells,
          });
          return success(
            index.cells.map(({ scenario, width, theme, designSystem, errors, snapshot, png }) => ({
              scenario,
              width,
              theme,
              designSystem,
              errors,
              aria: snapshot === null ? null : new TextDecoder().decode(files.get(snapshot)),
              png: files.get(png)!,
            })),
          );
        } catch (error) {
          return failure(
            error instanceof CaptureError ? error.kind : "render-failed",
            "",
            error instanceof CaptureError && error.kind === "limit-exceeded"
              ? `maxCaptureCells: ${maxCaptureCells}. ${message(error)}`
              : message(error),
          );
        }
      });
    },
    close(): Promise<void> {
      return exclusive(async () => {
        await (await bound?.catch(() => undefined))?.close();
      });
    },
  };
}
