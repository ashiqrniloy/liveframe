import type { PropSchema } from "../../catalog/define.ts";
import { proofCatalog, type RenderOptions, type WidgetProps } from "../../runtime/index.ts";

export type Category = "decisions" | "tasks" | "alerts";
export interface QueueItem {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly status: string;
  readonly meta: string;
  readonly kicker: string;
  readonly facts: readonly { readonly label: string; readonly value: string }[];
  readonly reference: string;
  readonly note: string;
  readonly lead?: string;
  readonly foldedAlerts?: number;
}
export interface QueuePage {
  readonly cursor: string;
  readonly nextCursor?: string;
  readonly rows: readonly QueueItem[];
}
export interface QueueData {
  readonly status: "ready" | "loading" | "empty" | "failed";
  readonly checked: string;
  readonly stale: boolean;
  readonly groups: readonly {
    readonly id: Category;
    readonly label: string;
    readonly total: number;
    readonly pages: readonly QueuePage[];
  }[];
}
export interface QueueState {
  readonly filter: "all" | Category;
  readonly selected: string;
  readonly cursors: Readonly<Record<Category, string>>;
  readonly escalating: string;
  readonly reason: string;
}
export const queueParams = { canAct: true, canEscalate: true, canViewAlerts: true };
export const initialQueueState: QueueState = {
  filter: "all",
  selected: "decision-8812",
  cursors: { decisions: "start", tasks: "start", alerts: "start" },
  escalating: "",
  reason: "",
};
export type QueueProps = WidgetProps<typeof queueParams, QueueState, QueueData, { size: string }>;
const id = { type: "string", pattern: "^.+$", maxLength: 128 } as const;
const object = (properties: Record<string, PropSchema>): PropSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const agentHomeActions = {
  "decisions.review": object({ id }),
  "tasks.claim": object({ id }),
  "tasks.escalate": object({ id, reason: { type: "string", pattern: "[\\s\\S]", maxLength: 500 } }),
  "alerts.acknowledge": object({ id }),
  "alerts.snooze": object({ id, duration: { type: "string", enum: ["hour", "day"] } }),
  "alerts.convert": object({ id }),
  "queue.retry": object({}),
};
export const agentHomeOptions: RenderOptions = {
  catalog: proofCatalog,
  actions: Object.keys(agentHomeActions),
  params: object({ canAct: { type: "boolean" }, canEscalate: { type: "boolean" }, canViewAlerts: { type: "boolean" } }),
  state: {
    type: "object",
    properties: {
      filter: { type: "string", enum: ["all", "decisions", "tasks", "alerts"] },
      selected: { type: "string", maxLength: 128 },
      cursors: object({ decisions: id, tasks: id, alerts: id }),
      escalating: { type: "string", maxLength: 128 },
      reason: { type: "string", maxLength: 500 },
    },
    required: ["filter", "selected", "cursors", "escalating", "reason"],
    additionalProperties: false,
  },
  context: object({ size: { type: "string", enum: ["small", "medium", "large", "full"] } }),
};
