import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pkg from "../../package.json" with { type: "json" };
import { type Capabilities, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import type { LiveframeError } from "../index.ts";
import type { AuthoringConfig } from "../preview/authoring.ts";
import type { Runner } from "../preview/runner.ts";
import { workerRunner } from "../preview/worker/index.ts";
import { generate } from "../sdk/gen.ts";

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
  registerCatalogTools(sdk, server, catalog, capabilities);
  await server.connect(new sdk.StdioServerTransport());
  await new Promise<void>((resolveStop) => {
    const stop = () => resolveStop();
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    process.stdin.once("end", stop);
    process.stdin.once("close", stop);
  });
  await server.close().catch(() => {});
  if (owned) runner.close?.();
  return 0;
}
