import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pkg from "../../package.json" with { type: "json" };
import manifestDoc from "../../schemas/manifest.json" with { type: "json" };
import packageDoc from "../../schemas/widget-package.json" with { type: "json" };
import { type Capabilities, isRecord, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { type WidgetPackage, validateScenario } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import type { LiveframeError, Result } from "../index.ts";
import { validateJson } from "../formats/json.ts";
import { validateManifestShape } from "../formats/manifest.ts";
import type { Json, UiNode } from "../formats/tree.ts";
import type { AuthoringConfig, PreviewSession } from "../preview/authoring.ts";
import type { Runner } from "../preview/runner.ts";
import { createPreview } from "../preview/session.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { generate } from "../sdk/gen.ts";
import { capture, CaptureError } from "./capture.ts";

export class McpSdkMissing extends Error {
  override name = "McpSdkMissing";
  constructor() {
    super("The MCP SDK is required: run `bun add @modelcontextprotocol/server` in the app.");
  }
}

type Sdk = {
  readonly McpServer: typeof import("@modelcontextprotocol/server").McpServer;
  readonly fromJsonSchema: typeof import("@modelcontextprotocol/server").fromJsonSchema;
  readonly StdioServerTransport: typeof import("@modelcontextprotocol/server/stdio").StdioServerTransport;
};

type Server = InstanceType<Sdk["McpServer"]>;

const loadSdk = async (): Promise<Sdk> => {
  const [server, stdio] = await Promise.all([
    import("@modelcontextprotocol/server"),
    import("@modelcontextprotocol/server/stdio"),
  ]);
  return {
    McpServer: server.McpServer,
    fromJsonSchema: server.fromJsonSchema,
    StdioServerTransport: stdio.StdioServerTransport,
  };
};

type ConfigResult =
  | {
      readonly ok: true;
      readonly config: AuthoringConfig;
      readonly catalog: Catalog;
      readonly capabilities: Capabilities;
    }
  | { readonly ok: false; readonly errors: readonly LiveframeError[] };

const invalid = (message: string): LiveframeError => ({ kind: "invalid-document", pointer: "", message });

async function loadConfig(path: string): Promise<ConfigResult> {
  let module: { default?: unknown };
  try {
    module = await import(pathToFileURL(resolve(path)).href);
  } catch (error) {
    return { ok: false, errors: [invalid(error instanceof Error ? error.message : String(error))] };
  }
  const config = module.default as AuthoringConfig | undefined;
  if (typeof config !== "object" || config === null)
    return { ok: false, errors: [invalid("The module has no default export")] };
  const catalog = validateCatalog(config.catalog);
  if (!catalog.ok) return { ok: false, errors: catalog.errors };
  const capabilities = validateCapabilities(config.capabilities);
  if (!capabilities.ok) return { ok: false, errors: capabilities.errors };
  return { ok: true, config, catalog: catalog.value, capabilities: capabilities.value };
}

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const failure = (value: unknown) => ({ ...text(value), isError: true });

const kindsSchema = {
  type: "object",
  properties: {
    kinds: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, uniqueItems: true },
  },
  required: [],
  additionalProperties: false,
} as const;

/** Host `meta` is the host's own annotation; an agent sees it only when the config opts in. */
function withoutMeta(capabilities: Capabilities): Capabilities {
  const dropMeta = <T extends Record<string, { meta?: unknown }>>(entries: T): T =>
    Object.fromEntries(Object.entries(entries).map(([name, { meta: _, ...rest }]) => [name, rest])) as T;
  return { ...capabilities, actions: dropMeta(capabilities.actions), sources: dropMeta(capabilities.sources) };
}

/** The four read-only catalog tools. Their values are fixed for the server's lifetime. */
function registerCatalogTools(
  sdk: Sdk,
  server: Server,
  catalog: Catalog,
  capabilities: Capabilities,
  exposeMeta: boolean,
): void {
  const known = catalog.definitions.map((definition) => definition.kind);
  server.registerTool(
    "list_primitives",
    {
      description:
        "The catalog's component definitions — props schema, children, events, variants, slots, style props, description and deprecation — so a draft uses only valid kinds, props and events. Pass `kinds` to narrow it.",
      inputSchema: sdk.fromJsonSchema<{ kinds?: string[] }>(kindsSchema),
    },
    ({ kinds }) => {
      const unknown = kinds?.filter((kind) => !known.includes(kind)) ?? [];
      if (unknown.length > 0)
        return failure(
          unknown.map((kind) => ({
            kind: "unknown-component",
            pointer: `/kinds/${kinds?.indexOf(kind) ?? 0}`,
            message: `Unknown kind "${kind}"`,
            expected: known.join(", "),
          })),
        );
      return text(
        kinds ? catalog.definitions.filter((definition) => kinds.includes(definition.kind)) : catalog.definitions,
      );
    },
  );
  server.registerTool(
    "list_vocabulary",
    {
      description:
        "The catalog's id and closed vocabulary — colour, surface, fillable and typography roles, tones, surfaceTypography, and the space, radius, size and bp names — so style props, recipes and themes use installed names, and a manifest names the catalog it was authored against.",
    },
    () => text({ catalogId: catalog.catalogId, vocabulary: catalog.vocabulary }),
  );
  server.registerTool(
    "list_capabilities",
    {
      description:
        "Every declared source's params and result schemas and every action's args schema, so a draft reads and dispatches only declared capabilities. Declarations only: nothing is resolved or called.",
    },
    () => text(exposeMeta ? capabilities : withoutMeta(capabilities)),
  );
  server.registerTool(
    "generated_types",
    {
      description:
        'The typed component module for this catalog, byte-identical to `liveframe gen` output. Save it as ui.gen.ts beside the widget and import the types from "./ui.gen".',
    },
    () =>
      text({ note: 'Save this as ui.gen.ts beside the widget and import from "./ui.gen".', types: generate(catalog) }),
  );
}

type JsonObject = Record<string, unknown>;
const strip = (schema: JsonObject, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(schema).filter(([key]) => !keys.includes(key)));

const manifestSchema = manifestDoc as JsonObject;
const packageSchema = packageDoc as JsonObject;
const packageDefs = packageSchema.$defs as JsonObject;

/**
 * `pack_draft` and `render_scenarios` take a permissive top-level object: the
 * handler validates the nested documents itself, so every argument error is a
 * `LiveframeError` with a document-root pointer (`/manifest/id`) rather than the
 * SDK's bare validation string. The published schemas stay in `$defs` so an agent
 * reading `tools/list` still sees the shapes it must author against.
 */
const packSchema = {
  type: "object",
  properties: {
    files: {
      description: 'Source files by path: a non-empty object of file path to module source. See "$defs".',
    },
    entry: { description: "The entry file path: one of `files`' keys." },
    manifest: { description: 'The widget manifest. Its published schema is "$defs" (urn:liveframe:manifest:1).' },
    scenarios: {
      description: 'One to 64 scenarios: name, params, context, optional state and data sources. See "$defs.scenario".',
    },
  },
  required: ["files", "entry", "manifest", "scenarios"],
  // `json` is byte-identical in both published schemas, so one copy serves both.
  $defs: { ...(manifestDoc.$defs as JsonObject), ...(packageDoc.$defs as JsonObject) },
};

const renderSchema = {
  type: "object",
  properties: {
    scenario: { description: "A scenario name from the packed draft. Omit it to check every scenario at once." },
    state: {
      description: 'Optional state override for this render: any JSON value. "$defs.json" is the value schema.',
    },
    context: {
      description: 'Optional context override for this render: any JSON value. "$defs.json" is the value schema.',
    },
  },
  $defs: { json: (packageDoc.$defs as JsonObject).json },
};

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

type PackInput = Parameters<PreviewSession["update"]>[0];
type RenderInput = { scenario?: string; state?: Json; context?: Json };

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
  for (const name of ["state", "context"] as const) {
    const value = input[name];
    if (value === undefined) continue;
    const checked = validateJson(value);
    if (!checked.ok) errors.push(...rooted(`/${name}`, checked.errors));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: input as RenderInput };
}

const nodes = (node: UiNode): number => 1 + (node.children?.reduce((sum, child) => sum + nodes(child), 0) ?? 0);

type ScenarioStatus =
  | { scenario: string; ok: true; nodes: number }
  | (LiveframeError & { ok: false; scenarios: string[] });

/** Every scenario's status; identical errors are reported once, naming the scenarios that share them. */
export function checkAll(
  results: readonly { readonly scenario: string; readonly result: Result<UiTree> }[],
): ScenarioStatus[] {
  const statuses: ScenarioStatus[] = [];
  const shared = new Map<string, ScenarioStatus & { ok: false }>();
  for (const { scenario: name, result } of results) {
    if (result.ok) {
      statuses.push({ scenario: name, ok: true, nodes: nodes(result.value.root) });
      continue;
    }
    for (const error of result.errors) {
      const id = `${error.kind}\u0000${error.pointer}\u0000${error.message}\u0000${error.expected ?? ""}`;
      const existing = shared.get(id);
      if (existing) {
        if (!existing.scenarios.includes(name)) existing.scenarios.push(name);
        continue;
      }
      const entry: ScenarioStatus & { ok: false } = { ...error, ok: false, scenarios: [name] };
      shared.set(id, entry);
      statuses.push(entry);
    }
  }
  return statuses;
}

/** What the draft and capture tools share: the one session, the last good package, the bound page. */
function createAuthoring({
  config,
  catalog,
  capabilities,
  runner,
}: {
  config: AuthoringConfig;
  catalog: Catalog;
  capabilities: Capabilities;
  runner: Runner;
}) {
  const session: PreviewSession = createPreview({ catalog, capabilities, runner });
  const exposeMeta = config.exposeMeta === true;
  let packed: WidgetPackage | undefined;
  let bound: Promise<{ readonly url: string; close(): Promise<void> }> | undefined;
  return {
    session,
    exposeMeta,
    get package() {
      return packed;
    },
    update(input: Parameters<PreviewSession["update"]>[0]) {
      const result = session.update(input);
      if (result.ok) packed = result.value;
      return result;
    },
    /** Binds the app's page on first use, so a run that never captures never starts a host. */
    async url(): Promise<string> {
      if (!config.preview)
        throw new Error(
          "The config module names no preview(): add `preview: async (binding) => ({ url, close })` to serve the app's own page.",
        );
      // One binding for the session, even if two captures race: the promise is what is memoized.
      bound ??= config.preview({ session, package: () => packed ?? unreachable() });
      const bridge = await bound.catch((error: unknown) => {
        bound = undefined; // a binding that failed is not cached: the next capture tries again
        throw error;
      });
      return bridge.url;
    },
    async close(): Promise<void> {
      await (await bound?.catch(() => undefined))?.close();
    },
  };
}

function unreachable(): never {
  throw new Error("No draft has been packed");
}

/**
 * One queue for the tools that share the session and the bound page, so a capture
 * always shows the draft packed before it. Catalog reads need no ordering and
 * stay concurrent.
 */
function serialize(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.catch(() => {}); // a failed call must not break the queue
    return run;
  };
}

/** The draft tools: one preview session, rendered by the app's own runner. */
function registerDraftTools(
  sdk: Sdk,
  server: Server,
  authoring: ReturnType<typeof createAuthoring>,
  exclusive: <T>(work: () => Promise<T>) => Promise<T>,
): void {
  const { session } = authoring;
  const schema = (value: object) => value as Parameters<Sdk["fromJsonSchema"]>[0];

  /** One scenario's tree, refused when its JSON would exceed the tool-result limit. */
  async function renderOne(input: RenderInput) {
    const { scenario, state, context } = input;
    if (scenario === undefined)
      return failure([{ kind: "not-found", pointer: "/scenario", message: "Unknown scenario" }]);
    const result = await session.render({
      scenario,
      ...(state === undefined ? {} : { state }),
      ...(context === undefined ? {} : { context }),
    });
    if (!result.ok) return failure(result.errors);
    const body = JSON.stringify(result.value);
    const size = Buffer.byteLength(body, "utf8");
    if (size > MAX_TREE_BYTES)
      return failure([
        {
          kind: "limit-exceeded",
          pointer: "/scenario",
          message: `Scenario "${scenario}" rendered ${size} bytes, over the ${MAX_TREE_BYTES}-byte limit`,
          expected: `a tree of at most ${MAX_TREE_BYTES} bytes`,
        },
      ]);
    return { content: [{ type: "text" as const, text: body }] };
  }

  server.registerTool(
    "pack_draft",
    {
      description:
        "Packs a draft — files, entry, manifest and scenarios — through the same packer production uses, and returns its hash plus manifest id, version, description and scenario names. A failed pack returns its LiveframeErrors and keeps the previous draft current.",
      inputSchema: sdk.fromJsonSchema<unknown>(schema(packSchema)),
    },
    (input) =>
      exclusive(async () => {
        const arguments_ = packArguments(input);
        if (!arguments_.ok) return failure(arguments_.errors);
        const result = authoring.update(arguments_.value);
        if (!result.ok) return failure(result.errors);
        const { manifest, scenarios, hash } = result.value;
        return text({
          hash,
          id: manifest.id,
          version: manifest.version,
          ...(manifest.description === undefined ? {} : { description: manifest.description }),
          ...(authoring.exposeMeta && manifest.meta !== undefined ? { meta: manifest.meta } : {}),
          scenarios: scenarios.map(({ name }) => name),
        });
      }),
  );
  server.registerTool(
    "render_scenarios",
    {
      description:
        "Renders the packed draft through the app's runner. With `scenario`, returns that scenario's UI tree (at most 256 KiB) or its LiveframeErrors, optionally overridden by `state` and `context`. Without it, returns every scenario's status — ok with its node count — plus each distinct error once, listing the scenarios that share it.",
      inputSchema: sdk.fromJsonSchema<unknown>(schema(renderSchema)),
    },
    (input) =>
      exclusive(async () => {
        const arguments_ = renderArguments(input);
        if (!arguments_.ok) return failure(arguments_.errors);
        if (!authoring.package)
          return failure([{ kind: "not-found", pointer: "", message: "Call pack_draft before render_scenarios" }]);
        if (arguments_.value.scenario !== undefined) return renderOne(arguments_.value);
        const checked = await session.check();
        if (!checked.ok) return failure(checked.errors);
        return text(checkAll(checked.value));
      }),
  );
}

const captureSchema = {
  type: "object",
  properties: {
    scenarios: { type: "array", items: { type: "string" } },
    widths: { type: "array", items: { type: "integer" } },
    themes: { type: "array", items: { type: "string" } },
    designSystems: { type: "array", items: { type: "string" } },
  },
  additionalProperties: false,
};

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: "image/png" };

/** `capture_preview`: the bound page's cells, captured by the same `capture()` the CLI uses. */
function registerCaptureTool(
  sdk: Sdk,
  server: Server,
  authoring: ReturnType<typeof createAuthoring>,
  exclusive: <T>(work: () => Promise<T>) => Promise<T>,
): void {
  type Options = { scenarios?: string[]; widths?: number[]; themes?: string[]; designSystems?: string[] };
  server.registerTool(
    "capture_preview",
    {
      description:
        "Captures the bound preview page's cells — at most 12 per call — and returns each cell's coordinates, LiveframeErrors and accessibility snapshot as text with its PNG as an image. Omit an axis to keep every value the page declares.",
      inputSchema: sdk.fromJsonSchema<Options>(captureSchema as Parameters<Sdk["fromJsonSchema"]>[0]),
    },
    (options: Options) =>
      exclusive(async () => {
        if (!authoring.package)
          return failure([{ kind: "not-found", pointer: "", message: "Call pack_draft before capture_preview" }]);
        let url: string;
        try {
          url = await authoring.url();
        } catch (error) {
          return failure([
            { kind: "not-found", pointer: "", message: String(error instanceof Error ? error.message : error) },
          ]);
        }
        // A directory per capture, removed once its files are read: cell names repeat across calls.
        const out = await mkdtemp(join(tmpdir(), "liveframe-mcp-"));
        try {
          const index = await capture(url, { out, ...options, maxCells: 12 });
          const content: Content[] = [
            text(
              index.cells.map(({ scenario, width, theme, designSystem, errors }) => ({
                scenario,
                width,
                theme,
                designSystem,
                errors,
              })),
            ).content[0] as Content,
          ];
          for (const cell of index.cells) {
            content.push({
              type: "text",
              text: `${cell.scenario} @${cell.width}px
${await Bun.file(join(out, cell.snapshot)).text()}`,
            });
            content.push({
              type: "image",
              data: Buffer.from(await Bun.file(join(out, cell.png)).arrayBuffer()).toString("base64"),
              mimeType: "image/png",
            });
          }
          return { content };
        } catch (error) {
          return failure([
            {
              kind: error instanceof CaptureError ? error.kind : "render-failed",
              pointer: "",
              message: String(error instanceof Error ? error.message : error),
            },
          ]);
        } finally {
          await rm(out, { recursive: true, force: true });
        }
      }),
  );
}

/** Runs the authoring MCP server until stdin ends or a signal arrives. Returns the exit code. */
export async function mcp(path: string, load: () => Promise<Sdk> = loadSdk): Promise<number> {
  const sdk = await load().catch(() => {
    throw new McpSdkMissing();
  });
  const loaded = await loadConfig(path);
  if (!loaded.ok) {
    console.error(JSON.stringify(loaded.errors, null, 2));
    return 2;
  }
  const { config, catalog, capabilities } = loaded;
  const owned = config.runner === undefined;
  const runner: Runner & { close?(): void } = config.runner ?? workerRunner();
  // Say plainly what the default runner means: agent-written code runs with this process's permissions.
  if (owned)
    console.error(
      "liveframe mcp: no runner configured, so drafts run in workerRunner() with this process's permissions. Give an untrusted agent an isolated runner (config.runner).",
    );
  const server = new sdk.McpServer({ name: "liveframe", version: pkg.version });
  const exclusive = serialize();
  const authoring = createAuthoring({ config, catalog, capabilities, runner });
  registerCatalogTools(sdk, server, catalog, capabilities, authoring.exposeMeta);
  registerDraftTools(sdk, server, authoring, exclusive);
  registerCaptureTool(sdk, server, authoring, exclusive);
  await server.connect(new sdk.StdioServerTransport());
  await new Promise<void>((resolveStop) => {
    const stop = () => resolveStop();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    process.stdin.once("end", stop);
    process.stdin.once("close", stop);
  });
  await server.close().catch(() => {});
  await authoring.close();
  if (owned) runner.close?.();
  return 0;
}
