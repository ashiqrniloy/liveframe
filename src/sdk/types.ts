import type { ActionStatus, Intent, Json, LocalIntent, TreeIntent } from "../formats/tree.ts";

export type { ActionStatus, Intent, Json, LocalIntent, TreeIntent };

/** A widget input, deeply readonly: the SDK freezes all four before the widget runs. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

/** The action statuses a widget receives when the host reports none. */
export type ActionStatuses = Readonly<Record<string, ActionStatus>>;

/** What a widget function receives (spec §7.1). */
export type WidgetProps<P = unknown, S = unknown, D = unknown, C = unknown, A = ActionStatuses> = {
  readonly params: DeepReadonly<P>;
  readonly state: DeepReadonly<S>;
  readonly data: DeepReadonly<D>;
  readonly context: DeepReadonly<C>;
  /** Action statuses by result key: the action name, or an intent's `resultKey`. `{}` when none. */
  readonly actions: DeepReadonly<A>;
};

/** What a host passes to a render: `WidgetProps`, with `actions` optional so a host that reports none keeps working. */
export type WidgetInputs<P = unknown, S = unknown, D = unknown, C = unknown, A = ActionStatuses> = Omit<
  WidgetProps<P, S, D, C, A>,
  "actions"
> & { readonly actions?: DeepReadonly<A> | undefined };
