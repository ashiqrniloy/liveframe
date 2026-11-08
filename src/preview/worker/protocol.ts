import type { Result } from "../../errors.ts";
import type { WidgetPackage } from "../../formats/package.ts";
import type { UiTree } from "../../formats/tree.ts";
import type { WidgetInputs } from "../../sdk/types.ts";
import type { RunnerOptions } from "../runner.ts";

/** Every render carries an id, and only that render's result is accepted. */
export type WorkerMessage =
  | { type: "configure"; catalog: RunnerOptions["catalog"]; capabilities: RunnerOptions["capabilities"] }
  | {
      type: "render";
      id: number;
      pkg: WidgetPackage;
      inputs: WidgetInputs;
      options: Omit<RunnerOptions, "catalog" | "capabilities">;
    }
  | { type: "result"; id: number; result: Result<UiTree> };
