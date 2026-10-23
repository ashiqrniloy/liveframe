import type { WidgetProps } from "@arnilo/liveframe/sdk";
export type Category = "decisions" | "tasks" | "alerts";
export interface QueueItem {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly status: string;
  readonly meta: string;
  readonly rowStatus: string;
  readonly rowMeta: readonly string[];
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
