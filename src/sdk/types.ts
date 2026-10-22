import type { Intent, Json } from "../formats/tree.ts";

export type { Intent, Json };

/** A widget input, deeply readonly: the SDK freezes all four before the widget runs. */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

/** What a widget function receives (spec §7.1). */
export type WidgetProps<P = unknown, S = unknown, D = unknown, C = unknown> = {
  readonly params: DeepReadonly<P>;
  readonly state: DeepReadonly<S>;
  readonly data: DeepReadonly<D>;
  readonly context: DeepReadonly<C>;
};
