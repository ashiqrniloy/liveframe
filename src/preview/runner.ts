import type { Result } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import type { WidgetProps } from "../sdk/types.ts";
import type { TemplateLimits } from "../template/render.ts";

export type RunnerOptions = {
  readonly catalog: Catalog;
  readonly capabilities: Capabilities;
  readonly surfaceId: string;
  readonly revision: number;
  /** `steps` bounds a template widget's evaluation (spec §7.6); a code widget ignores it. */
  readonly limits?: TemplateLimits;
  readonly timeoutMs?: number;
};

/** Backend execution supplied by the app, shared by preview and production. */
export interface Runner {
  render(pkg: WidgetPackage, inputs: WidgetProps, options: RunnerOptions): Promise<Result<UiTree>>;
}
