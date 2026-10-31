import type { Definition, PropSchema } from "../catalog/define.ts";
import type { definitions } from "../catalog/definitions.ts";
import type {
  Breakpoint,
  ColourRole,
  fillableRoles,
  RadiusName,
  SizeName,
  TypographyRole,
  valueNames,
} from "../styles/types.ts";

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type Intent =
  | { readonly type: "setState"; readonly key: string; readonly value?: Json }
  | { readonly type: "action"; readonly name: string; readonly args: Readonly<Record<string, Json>> };

export interface UiNode {
  readonly id: string;
  readonly kind: string;
  readonly variant?: string;
  readonly props: Readonly<Record<string, Json>>;
  readonly style?: Readonly<Record<string, Json>>;
  readonly events?: Readonly<Record<string, Intent>>;
  readonly children?: readonly UiNode[];
}
export interface UiTree {
  readonly format: "liveframe/1";
  readonly catalogId: string;
  readonly surfaceId: string;
  readonly revision: number;
  readonly root: UiNode;
}
export interface RenderOptions {
  readonly catalog: { readonly catalogId: string; readonly definitions: readonly Definition[] };
  readonly actions: readonly string[];
  readonly state: Extract<PropSchema, { type: "object" }>;
  readonly params?: PropSchema;
  readonly context?: PropSchema;
  readonly surfaceId?: string;
  readonly revision?: number;
  readonly limits?: { readonly nodes?: number; readonly depth?: number; readonly bytes?: number };
}
type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export interface WidgetProps<P = unknown, S = unknown, D = unknown, C = unknown> {
  readonly params: DeepReadonly<P>;
  readonly state: DeepReadonly<S>;
  readonly data: DeepReadonly<D>;
  readonly context: DeepReadonly<C>;
}

export interface WidgetElement {
  readonly type: unknown;
  readonly props: Readonly<Record<string, unknown>>;
  readonly key: unknown;
  readonly staticChildren: boolean;
}
export type Child = WidgetElement | null | undefined | boolean | readonly Child[];
export type Space = (typeof valueNames.space)[number];
export type Dimension = Space | SizeName | "fill" | "fit" | `${number}fr` | `${number}ch` | `${number}%`;
export type Responsive<V> = V | ({ readonly base: V } & { readonly [B in Breakpoint]?: V });
export interface StyleValues {
  readonly padding: Space;
  readonly paddingX: Space;
  readonly paddingY: Space;
  readonly paddingTop: Space;
  readonly paddingRight: Space;
  readonly paddingBottom: Space;
  readonly paddingLeft: Space;
  readonly margin: Space;
  readonly marginX: Space;
  readonly marginY: Space;
  readonly marginTop: Space;
  readonly marginRight: Space;
  readonly marginBottom: Space;
  readonly marginLeft: Space;
  readonly gap: Space;
  readonly direction: "horizontal" | "vertical";
  readonly align: "start" | "center" | "end" | "stretch" | "baseline";
  readonly justify: "start" | "center" | "end" | "between" | "around" | "evenly";
  readonly wrap: "nowrap" | "wrap";
  readonly position: "static" | "sticky";
  readonly insetTop: Space;
  readonly insetBottom: Space;
  readonly deferOffscreen: Space | SizeName;
  readonly width: Dimension;
  readonly height: Dimension;
  readonly minWidth: Dimension;
  readonly maxWidth: Dimension;
  readonly minHeight: Dimension;
  readonly maxHeight: Dimension;
  readonly grow: number;
  readonly shrink: number;
  readonly basis: number;
  readonly columns: readonly Dimension[];
  readonly rows: readonly Dimension[];
  readonly area: readonly string[];
  readonly surface: Extract<ColourRole, `surface.${string}`>;
  readonly fill: (typeof fillableRoles)[number];
  readonly radius: RadiusName | "full";
  readonly textAlign: "start" | "center" | "end";
  readonly textStyle: TypographyRole;
  readonly tone: "default" | "muted" | "meta" | "accent" | "success" | "warning" | "danger" | "info" | "foil";
}

type SchemaValue<S> = S extends { readonly type: "string"; readonly enum: readonly (infer E)[] }
  ? E
  : S extends { readonly type: "string" }
    ? string
    : S extends { readonly type: "number" | "integer" }
      ? number
      : S extends { readonly type: "boolean" }
        ? boolean
        : S extends { readonly type: "array"; readonly items: infer I }
          ? readonly SchemaValue<I>[]
          : S extends { readonly type: "object"; readonly properties: infer P; readonly required: readonly (infer R)[] }
            ? { readonly [K in keyof P as K extends R ? K : never]: SchemaValue<P[K]> } & {
                readonly [K in keyof P as K extends R ? never : K]?: SchemaValue<P[K]>;
              }
            : never;
export type PrimitiveDefinition = (typeof definitions)[number];
export type PrimitiveProps<D extends PrimitiveDefinition> = SchemaValue<D["props"]> &
  Partial<{ readonly [P in D["styleProps"][number]]: Responsive<StyleValues[P]> }> & {
    readonly [E in keyof D["events"]]?: Intent;
  } & {
    readonly variant?: D["variants"][number];
    readonly key?: string | number;
  } & (D["children"] extends "none" ? { readonly children?: never } : { readonly children?: Child });
