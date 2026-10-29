import type { CaptureBackend } from "./capture/index.ts";
import type { Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { Intent, IntentOrigin, Json, UiTree } from "../formats/tree.ts";
import type { pack } from "../pack/pack.ts";
import type { Runner } from "./runner.ts";

/** One backend draft session (spec §7.5). */
export type PreviewSession = {
  /** Pack a draft; on success it becomes the session's current package. */
  update(draft: Parameters<typeof pack>[0]): Result<WidgetPackage>;
  /** Render one scenario, with optional state and context overrides. */
  render(options: { scenario: string; state?: Json; context?: Json }): Promise<Result<UiTree>>;
  /** Apply `setState` or a declared action to the current render. */
  intent(intent: Intent, origin?: IntentOrigin): Promise<Result<UiTree>>;
  /** Every intent applied since the current package was packed. */
  intents(): readonly Intent[];
  /** Render and check every scenario of the current package. */
  check(): Promise<Result<readonly { scenario: string; result: Result<UiTree> }[]>>;
};

/** What authoring hands a host's `preview()` factory to bind its own `<Preview>` page. */
export type PreviewBinding = {
  readonly session: PreviewSession;
  /** The draft last packed successfully, for the page's manifest and scenario names. */
  package(): WidgetPackage;
};

/** The module `liveframe mcp <config-module>` default-exports (spec §13). */
export type AuthoringConfig = {
  /** A catalog document, validated on start. */
  readonly catalog: unknown;
  /** A capabilities document, validated on start. */
  readonly capabilities: unknown;
  /** The app's runner. Defaults to `workerRunner()`. */
  readonly runner?: Runner;
  /** Capture engine; the CLI lazily defaults to Playwright when omitted. */
  readonly capture?: CaptureBackend;
  /** Show host `meta` (capability and manifest) to the agent. Default false: `meta` is the host's, not the agent's. */
  readonly exposeMeta?: boolean;
  /** Binds the app's preview page to the server's session; called once, after the first successful pack. */
  readonly preview?: (binding: PreviewBinding) => Promise<{ readonly url: string; close(): Promise<void> }>;
};
