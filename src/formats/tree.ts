import { bool, type Infer, int, obj, str } from "../schema.ts";
import { capabilityName } from "./capabilities.ts";

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

const name = str({ maxLength: 128, pattern: "^.+$" });
const token = str({ maxLength: 64, pattern: "^[a-z][A-Za-z0-9-]*$" });
const stateFields = obj({ type: str({ maxLength: 8, enum: ["setState"] }), key: name }, { value: bool() });
const actionFields = obj(
  { type: str({ maxLength: 6, enum: ["action"] }), name: capabilityName, args: bool() },
  { bind: name, bindAll: bool() },
);
export type Intent =
  | (Omit<Infer<typeof stateFields>, "value"> & { readonly value?: Json })
  | (Omit<Infer<typeof actionFields>, "args" | "bindAll"> & {
      readonly args: Readonly<Record<string, Json>>;
      readonly bindAll?: true;
    });

const nodeFields = obj(
  { id: name, kind: token, props: bool() },
  { variant: token, style: bool(), events: bool(), children: bool() },
);
export type UiNode = Omit<Infer<typeof nodeFields>, "props" | "style" | "events" | "children"> & {
  readonly props: Readonly<Record<string, Json>>;
  readonly style?: Readonly<Record<string, Json>>;
  readonly events?: Readonly<Record<string, Intent>>;
  readonly children?: readonly UiNode[];
};
const treeFields = obj({
  format: str({ maxLength: 11, enum: ["liveframe/1"] }),
  catalogId: str({ maxLength: 128, pattern: "^[a-z][a-z0-9.-]*@[1-9][0-9]*$" }),
  surfaceId: name,
  revision: int({ minimum: 0 }),
  root: bool(),
});
export type UiTree = Omit<Infer<typeof treeFields>, "root"> & { readonly root: UiNode };

const json = { $ref: "#/$defs/json" } as const;
const jsonMap = { type: "object", additionalProperties: json } as const;
const node = { $ref: "#/$defs/node" } as const;

/** Structural transport schema; catalog checks and configurable limits belong to the compiled validator. */
export const treeSchema = {
  ...treeFields,
  properties: { ...treeFields.properties, root: node },
  $defs: {
    json: {
      anyOf: [
        { type: "null" },
        { type: "boolean" },
        { type: "number" },
        { type: "string" },
        { type: "array", items: json },
        jsonMap,
      ],
    },
    intent: {
      oneOf: [
        { ...stateFields, properties: { ...stateFields.properties, value: json } },
        {
          ...actionFields,
          properties: { ...actionFields.properties, args: jsonMap, bindAll: { const: true } },
          not: { properties: { bind: {}, bindAll: {} }, required: ["bind", "bindAll"] },
        },
      ],
    },
    node: {
      ...nodeFields,
      properties: {
        ...nodeFields.properties,
        // The path grammar matches the proof's encoded JSX keys; depth and bytes are configurable.
        id: { type: "string", pattern: "^root(?:/(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+)*$" },
        props: jsonMap,
        style: jsonMap,
        events: { type: "object", additionalProperties: { $ref: "#/$defs/intent" } },
        children: { type: "array", items: node },
      },
    },
  },
} as const;
