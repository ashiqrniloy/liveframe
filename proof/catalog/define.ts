// The proof needs only this JSON Schema subset; validation belongs to Task 4.
export type PropSchema =
  | {
      readonly type: "string";
      readonly maxLength?: number;
      readonly pattern?: string;
      readonly enum?: readonly string[];
    }
  | { readonly type: "number" | "integer"; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: "boolean" }
  | { readonly type: "array"; readonly items: PropSchema; readonly maxItems: number }
  | {
      readonly type: "object";
      readonly properties: Readonly<Record<string, PropSchema>>;
      readonly required: readonly string[];
      readonly additionalProperties: false;
    };

export type StyleProp =
  | "padding"
  | "paddingX"
  | "paddingY"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "margin"
  | "marginX"
  | "marginY"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "gap"
  | "direction"
  | "align"
  | "justify"
  | "wrap"
  | "width"
  | "height"
  | "minWidth"
  | "maxWidth"
  | "minHeight"
  | "maxHeight"
  | "grow"
  | "shrink"
  | "basis"
  | "columns"
  | "rows"
  | "area"
  | "surface"
  | "fill"
  | "radius"
  | "position"
  | "insetTop"
  | "insetBottom"
  | "deferOffscreen"
  | "textAlign"
  | "textStyle"
  | "tone";

export interface Definition {
  readonly kind: string;
  readonly props: Extract<PropSchema, { type: "object" }>;
  readonly children: "none" | "any" | readonly { readonly kind: string; readonly min: number; readonly max: number }[];
  readonly events: Readonly<Record<string, { readonly carries: "none" | "string" | "boolean" }>>;
  readonly variants: readonly string[];
  readonly slots: readonly string[];
  readonly styleProps: readonly StyleProp[];
  readonly a11y: { readonly role: string; readonly name?: string };
}
