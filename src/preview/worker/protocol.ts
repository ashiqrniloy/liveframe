import type { Result } from "../../errors.ts";
import type { WidgetPackage } from "../../formats/package.ts";
import type { UiTree } from "../../formats/tree.ts";
import type { WidgetProps } from "../../sdk/types.ts";
import type { RunnerOptions } from "../runner.ts";

export type WorkerMessage =
  | { type: "configure"; catalog: RunnerOptions["catalog"]; capabilities: RunnerOptions["capabilities"] }
  | {
      type: "render";
      pkg: WidgetPackage;
      inputs: WidgetProps;
      options: Omit<RunnerOptions, "catalog" | "capabilities">;
    }
  | { type: "result"; result: Result<UiTree> };
