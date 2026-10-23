import type { Result } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import type { RenderLimits } from "../sdk/render.ts";
import type { WidgetProps } from "../sdk/types.ts";

export type RunnerOptions = {
  readonly catalog: Catalog;
  readonly capabilities: Capabilities;
  readonly surfaceId: string;
  readonly revision: number;
  readonly limits?: RenderLimits;
  readonly timeoutMs?: number;
};

/** Backend execution supplied by the app, shared by preview and production. */
export interface Runner {
  render(pkg: WidgetPackage, inputs: WidgetProps, options: RunnerOptions): Promise<Result<UiTree>>;
}
