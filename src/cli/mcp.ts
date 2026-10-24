import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pkg from "../../package.json" with { type: "json" };
import { validateCapabilities } from "../formats/capabilities.ts";
import { validateCatalog } from "../formats/catalog.ts";
import type { LiveframeError } from "../index.ts";
import type { AuthoringConfig } from "../preview/authoring.ts";
import type { Runner } from "../preview/runner.ts";
import { workerRunner } from "../preview/worker/index.ts";

export class McpSdkMissing extends Error {
  override name = "McpSdkMissing";
  constructor() {
    super("The MCP SDK is required: run `bun add @modelcontextprotocol/server` in the app.");
  }
}

type Sdk = {
  readonly McpServer: typeof import("@modelcontextprotocol/server").McpServer;
  readonly StdioServerTransport: typeof import("@modelcontextprotocol/server/stdio").StdioServerTransport;
};

const loadSdk = async (): Promise<Sdk> => {
  const [server, stdio] = await Promise.all([
    import("@modelcontextprotocol/server"),
    import("@modelcontextprotocol/server/stdio"),
  ]);
  return { McpServer: server.McpServer, StdioServerTransport: stdio.StdioServerTransport };
};

type ConfigResult =
  | { readonly ok: true; readonly config: AuthoringConfig }
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
  return { ok: true, config };
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
  const { config } = loaded;
  const owned = config.runner === undefined;
  const runner: Runner & { close?(): void } = config.runner ?? workerRunner();
  const server = new sdk.McpServer({ name: "liveframe", version: pkg.version });
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
