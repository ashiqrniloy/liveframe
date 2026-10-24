import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pkg from "../../package.json" with { type: "json" };
import manifestDoc from "../../schemas/manifest.json" with { type: "json" };
import packageDoc from "../../schemas/widget-package.json" with { type: "json" };
import { type Capabilities, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { LiveframeError } from "../index.ts";
import type { Json, UiNode } from "../formats/tree.ts";
import type { AuthoringConfig, PreviewSession } from "../preview/authoring.ts";
import type { Runner } from "../preview/runner.ts";
import { createPreview } from "../preview/session.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { generate } from "../sdk/gen.ts";
import { capture, PlaywrightMissing } from "./capture.ts";

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

/** The four read-only catalog tools. Their values are fixed for the server's lifetime. */
function registerCatalogTools(sdk: Sdk, server: Server, catalog: Catalog, capabilities: Capabilities): void {
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
        "The catalog's closed vocabulary — colour, surface, fillable and typography roles, tones, surfaceTypography, and the space, radius, size and bp names — so style props, recipes and themes use installed names.",
    },
    () => text(catalog.vocabulary),
  );
  server.registerTool(
    "list_capabilities",
    {
      description:
        "Every declared source's params and result schemas and every action's args schema, so a draft reads and dispatches only declared capabilities. Declarations only: nothing is resolved or called.",
    },
    () => text(capabilities),
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

/** `pack_draft`'s input: the published manifest and scenario schemas, with their `$defs` hoisted. */
const packSchema = {
  type: "object",
  properties: {
    files: { type: "object", minProperties: 1, additionalProperties: { type: "string" } },
    entry: { type: "string", minLength: 1 },
    manifest: strip(manifestSchema, ["$schema", "$id", "$defs"]),
    scenarios: { type: "array", minItems: 1, maxItems: 64, items: { $ref: "#/$defs/scenario" } },
  },
  required: ["files", "entry", "manifest", "scenarios"],
  additionalProperties: false,
  // `json` is byte-identical in both published schemas, so one copy serves both.
  $defs: { ...(manifestSchema.$defs as JsonObject), ...packageDefs },
};

const renderSchema = {
  type: "object",
  properties: {
    scenario: { type: "string", minLength: 1 },
    state: { $ref: "#/$defs/json" },
    context: { $ref: "#/$defs/json" },
  },
  required: [],
  additionalProperties: false,
  $defs: { json: packageDefs.json },
};

const nodes = (node: UiNode): number => 1 + (node.children?.reduce((sum, child) => sum + nodes(child), 0) ?? 0);

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
  let packed: WidgetPackage | undefined;
  let bound: { readonly url: string; close(): Promise<void> } | undefined;
  let dir: string | undefined;
  return {
    session,
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
      bound ??= await config.preview({ session, package: () => packed ?? unreachable() });
      return bound.url;
    },
    async dir(): Promise<string> {
      dir ??= await mkdtemp(join(tmpdir(), "liveframe-mcp-"));
      return dir;
    },
    async close(): Promise<void> {
      await bound?.close();
      if (dir) await rm(dir, { recursive: true, force: true });
    },
  };
}

function unreachable(): never {
  throw new Error("No draft has been packed");
}

/** The draft tools: one preview session, rendered by the app's own runner. */
function registerDraftTools(sdk: Sdk, server: Server, authoring: ReturnType<typeof createAuthoring>): void {
  const { session } = authoring;
  type PackInput = Parameters<typeof session.update>[0];
  type RenderInput = { scenario?: string; state?: Json; context?: Json };
  const schema = (value: object) => value as Parameters<Sdk["fromJsonSchema"]>[0];
  server.registerTool(
    "pack_draft",
    {
      description:
        "Packs a draft — files, entry, manifest and scenarios — through the same packer production uses, and returns its hash plus manifest id, version and scenario names. A failed pack returns its LiveframeErrors and keeps the previous draft current.",
      inputSchema: sdk.fromJsonSchema<PackInput>(schema(packSchema)),
    },
    (input) => {
      const result = authoring.update(input);
      if (!result.ok) return failure(result.errors);
      const { manifest, scenarios, hash } = result.value;
      return text({ hash, id: manifest.id, version: manifest.version, scenarios: scenarios.map(({ name }) => name) });
    },
  );
  server.registerTool(
    "render_scenarios",
    {
      description:
        "Renders the packed draft through the app's runner. With `scenario`, returns that scenario's UI tree or its LiveframeErrors, optionally overridden by `state` and `context`. Without it, returns every scenario's status: ok with its node count, or its errors.",
      inputSchema: sdk.fromJsonSchema<RenderInput>(schema(renderSchema)),
    },
    async ({ scenario, state, context }) => {
      if (!authoring.package)
        return failure([{ kind: "not-found", pointer: "", message: "Call pack_draft before render_scenarios" }]);
      if (scenario !== undefined) {
        const result = await session.render({
          scenario,
          ...(state === undefined ? {} : { state }),
          ...(context === undefined ? {} : { context }),
        });
        return result.ok ? text(result.value) : failure(result.errors);
      }
      const checked = await session.check();
      if (!checked.ok) return failure(checked.errors);
      return text(
        checked.value.map(({ scenario: name, result }) =>
          result.ok
            ? { scenario: name, ok: true, nodes: nodes(result.value.root) }
            : { scenario: name, ok: false, errors: result.errors },
        ),
      );
    },
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
function registerCaptureTool(sdk: Sdk, server: Server, authoring: ReturnType<typeof createAuthoring>): void {
  type Options = { scenarios?: string[]; widths?: number[]; themes?: string[]; designSystems?: string[] };
  server.registerTool(
    "capture_preview",
    {
      description:
        "Captures the bound preview page's cells — at most 12 per call — and returns each cell's coordinates, LiveframeErrors and accessibility snapshot as text with its PNG as an image. Omit an axis to keep every value the page declares.",
      inputSchema: sdk.fromJsonSchema<Options>(captureSchema as Parameters<Sdk["fromJsonSchema"]>[0]),
    },
    async (options: Options) => {
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
      const out = await authoring.dir();
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
        const message = String(error instanceof Error ? error.message : error);
        return failure([
          {
            kind: error instanceof PlaywrightMissing ? "not-found" : "limit-exceeded",
            pointer: "",
            message,
          },
        ]);
      }
    },
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
  const server = new sdk.McpServer({ name: "liveframe", version: pkg.version });
  const authoring = createAuthoring({ config, catalog, capabilities, runner });
  registerCatalogTools(sdk, server, catalog, capabilities);
  registerDraftTools(sdk, server, authoring);
  registerCaptureTool(sdk, server, authoring);
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
