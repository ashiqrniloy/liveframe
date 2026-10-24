import type { WidgetPackage } from "../formats/package.ts";
import type { Runner } from "./runner.ts";
import type { createPreview } from "./session.ts";

/** One backend draft session, as `createPreview()` returns it (spec §7.5). */
export type PreviewSession = ReturnType<typeof createPreview>;

/** What `liveframe mcp` hands a host's `preview()` factory to bind its own `<Preview>` page. */
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
  /** Binds the app's preview page to the server's session; called once, after the first successful pack. */
  readonly preview?: (binding: PreviewBinding) => Promise<{ readonly url: string; close(): Promise<void> }>;
};
