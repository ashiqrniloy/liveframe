import { type CaptureInput, createAuthoring, type PackInput, type RenderInput } from "../authoring/index.ts";

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pkg from "../../package.json" with { type: "json" };
import manifestDoc from "../../schemas/manifest.json" with { type: "json" };
import packageDoc from "../../schemas/widget-package.json" with { type: "json" };
import { type Capabilities, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import type { LiveframeError, Result } from "../index.ts";
import type { AuthoringConfig } from "../preview/authoring.ts";
import type { CaptureBackend } from "../preview/capture/index.ts";
import type { Runner } from "../preview/runner.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { defaultCaptureBackend } from "./capture.ts";

// Kept for existing internal consumers; business logic lives in /authoring.
export { checkAll } from "../authoring/checks.ts";

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

type Authoring = ReturnType<typeof createAuthoring>;
const mapped = <T>(result: Result<T>) => (result.ok ? text(result.value) : failure(result.errors));

function registerCatalogTools(sdk: Sdk, server: Server, authoring: Authoring): void {
  server.registerTool(
    "list_primitives",
    {
      description:
        "The catalog's component definitions — props schema, children, events, variants, slots, style props, description and deprecation — so a draft uses only valid kinds, props and events. Pass `kinds` to narrow it.",
      inputSchema: sdk.fromJsonSchema<{ kinds?: string[] }>(kindsSchema),
    },
    async (input) => mapped(await authoring.listPrimitives(input)),
  );
  server.registerTool(
    "list_vocabulary",
    {
      description:
        "The catalog's id and closed vocabulary — colour, surface, fillable and typography roles, tones, surfaceTypography, and the space, radius, size and bp names — so style props, recipes and themes use installed names, and a manifest names the catalog it was authored against.",
    },
    async (input) => mapped(await authoring.listVocabulary()),
  );
  server.registerTool(
    "list_capabilities",
    {
      description:
        "Every declared source's params and result schemas and every action's args schema, so a draft reads and dispatches only declared capabilities. Declarations only: nothing is resolved or called.",
    },
    async (input) => mapped(await authoring.listCapabilities()),
  );
  server.registerTool(
    "generated_types",
    {
      description:
        'The typed component module for this catalog, byte-identical to `liveframe gen` output. Save it as ui.gen.ts beside the widget and import the types from "./ui.gen".',
    },
    async (input) => mapped(await authoring.generatedTypes()),
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

function registerDraftTools(sdk: Sdk, server: Server, authoring: Authoring): void {
  const schema = (value: object) => value as Parameters<Sdk["fromJsonSchema"]>[0];
  server.registerTool(
    "pack_draft",
    {
      description:
        "Packs a draft — files, entry, manifest and scenarios — through the same packer production uses, and returns its hash plus manifest id, version, description and scenario names. A failed pack returns its LiveframeErrors and keeps the previous draft current.",
      inputSchema: sdk.fromJsonSchema<PackInput>(schema(packSchema)),
    },
    async (input) => mapped(await authoring.packDraft(input)),
  );
  server.registerTool(
    "render_scenarios",
    {
      description:
        "Renders the packed draft through the app's runner. With `scenario`, returns that scenario's UI tree (at most 256 KiB) or its LiveframeErrors, optionally overridden by `state` and `context`. Without it, returns every scenario's status — ok with its node count — plus each distinct error once, listing the scenarios that share it.",
      inputSchema: sdk.fromJsonSchema<RenderInput>(schema(renderSchema)),
    },
    async (input) => mapped(await authoring.renderScenarios(input)),
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

function registerCaptureTool(sdk: Sdk, server: Server, authoring: Authoring): void {
  server.registerTool(
    "capture_preview",
    {
      description:
        "Captures the bound preview page's cells — at most 12 per call — and returns each cell's coordinates, LiveframeErrors and accessibility snapshot as text with its PNG as an image. Omit an axis to keep every value the page declares.",
      inputSchema: sdk.fromJsonSchema<CaptureInput>(captureSchema as Parameters<Sdk["fromJsonSchema"]>[0]),
    },
    async (input) => {
      const result = await authoring.capturePreview(input);
      if (!result.ok) return failure(result.errors);
      const content: Content[] = [
        text(
          result.value.map(({ scenario, width, theme, designSystem, errors }) => ({
            scenario,
            width,
            theme,
            designSystem,
            errors,
          })),
        ).content[0]!,
      ];
      for (const cell of result.value) {
        content.push({
          type: "text",
          text: `${cell.scenario} @${cell.width}px
${cell.aria ?? ""}`,
        });
        content.push({ type: "image", data: Buffer.from(cell.png).toString("base64"), mimeType: "image/png" });
      }
      return { content };
    },
  );
}

function lazyCaptureBackend(): CaptureBackend {
  let backend: CaptureBackend | undefined;
  return {
    async open(url) {
      backend ??= await defaultCaptureBackend();
      return backend.open(url);
    },
    async close() {
      await backend?.close?.();
      backend = undefined;
    },
  };
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
  const authoring = createAuthoring({
    ...config,
    catalog,
    capabilities,
    runner,
    capture: config.capture ?? lazyCaptureBackend(),
  });
  registerCatalogTools(sdk, server, authoring);
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
