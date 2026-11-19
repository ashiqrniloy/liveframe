import { bool, type Infer, int, obj, str } from "../schema.ts";
import { capabilityName } from "./capabilities.ts";
import { jsonSchema } from "./language.ts";

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

const name = str({ maxLength: 128, pattern: "^.+$" });
const token = str({ maxLength: 64, pattern: "^[a-z][A-Za-z0-9-]*$" });
const localWriteFields = obj({ key: name }, { value: bool(), until: str({ maxLength: 8, enum: ["revision"] }) });
const stateFields = obj(
  { type: str({ maxLength: 8, enum: ["setState"] }), key: name },
  { value: bool(), local: bool(), fromLocal: name },
);
const localFields = obj({ type: str({ maxLength: 8, enum: ["setLocal"] }), key: name }, { value: bool() });
const actionFields = obj(
  { type: str({ maxLength: 6, enum: ["action"] }), name: capabilityName, args: bool() },
  { bind: name, bindAll: bool(), resultKey: name, local: bool(), fromLocal: bool() },
);
/** One renderer-applied local write attached to a host intent (spec §8). */
export type LocalWrite = {
  readonly key: string;
  readonly value?: Json;
  readonly until?: "revision";
};
export type Intent =
  | (Omit<Infer<typeof stateFields>, "value" | "local"> & {
      readonly value?: Json;
      readonly local?: readonly LocalWrite[];
    })
  | (Omit<Infer<typeof actionFields>, "args" | "bindAll" | "local" | "fromLocal"> & {
      readonly args: Readonly<Record<string, Json>>;
      readonly bindAll?: true;
      readonly local?: readonly LocalWrite[];
      readonly fromLocal?: Readonly<Record<string, string>>;
    });

/**
 * A renderer-applied write to the surface's local state (spec §8). It never reaches `onIntent`, so it is
 * not an `Intent`: `Intent` is exactly what a host can dispatch, and `checkOffered` rejects this one.
 */
export type LocalIntent = Omit<Infer<typeof localFields>, "value"> & { readonly value?: Json };
/** What an event in the tree may carry: a host intent, or a local write the renderer applies itself. */
export type TreeIntent = Intent | LocalIntent;

/**
 * What the host last reported about an action (spec §8, tier 3). `value` accompanies `ok` and fits the
 * action's capability `result` schema; `action` names the manifest action when the result key is a
 * row key such as `"claim:42"`.
 */
export type ActionStatus<V = Json> = {
  readonly status: "pending" | "ok" | "failed" | "refused";
  readonly action?: string;
  readonly reason?: string;
  readonly value?: V;
  readonly at?: string;
};

/** The accepted surface and exact event that produced an intent. */
export type IntentOrigin = {
  readonly surfaceId: string;
  readonly revision: number;
  readonly nodeId: string;
  readonly event: string;
};

const nodeFields = obj(
  { id: name, kind: token, props: bool() },
  { variant: token, style: bool(), events: bool(), when: bool(), bind: bool(), children: bool() },
);
export type UiNode = Omit<Infer<typeof nodeFields>, "props" | "style" | "events" | "when" | "bind" | "children"> & {
  readonly props: Readonly<Record<string, Json>>;
  readonly style?: Readonly<Record<string, Json>>;
  readonly events?: Readonly<Record<string, TreeIntent>>;
  /** A browser-evaluated condition (spec §8): the node renders only when it is true. Data, not code. */
  readonly when?: Json;
  /** Browser-evaluated prop overrides (spec §8), by prop name; `props` remains the static fallback. */
  readonly bind?: Readonly<Record<string, Json>>;
  readonly children?: readonly UiNode[];
};
const treeFields = obj(
  {
    format: str({ maxLength: 11, enum: ["liveframe/1"] }),
    catalogId: str({ maxLength: 128, pattern: "^[a-z][a-z0-9.-]*@[1-9][0-9]*$" }),
    surfaceId: name,
    revision: int({ minimum: 0 }),
    root: bool(),
  },
  { focus: bool() },
);
/** A node id: `root`, or an encoded key path under it (spec §9). */
const nodeId = { type: "string", pattern: "^root(?:/(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+)*$" } as const;
export type UiTree = Omit<Infer<typeof treeFields>, "root" | "focus"> & {
  /** The id of the node that takes focus when a later revision first draws this mark (spec §11). */
  readonly focus?: string;
  readonly root: UiNode;
};

const json = { $ref: "#/$defs/json" } as const;
const jsonMap = { type: "object", additionalProperties: json } as const;
const node = { $ref: "#/$defs/node" } as const;
const localWrites = { type: "array", minItems: 1, maxItems: 4, items: { $ref: "#/$defs/localWrite" } } as const;
const fromLocalMap = { type: "object", minProperties: 1, maxProperties: 16, additionalProperties: name } as const;

// Style names and tokens remain catalog-owned; transport rejects inert dimension fractions.
const noFraction = { not: { type: "string", pattern: "^[0-9]+(?:\\.[0-9]+)?fr$" } } as const;
const dimension = {
  ...noFraction,
  if: { type: "object" },
  // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword.
  then: { type: "object", additionalProperties: noFraction },
} as const;
const style = {
  type: "object",
  allOf: [jsonMap],
  properties: {
    width: dimension,
    height: dimension,
    minWidth: dimension,
    maxWidth: dimension,
    minHeight: dimension,
    maxHeight: dimension,
  },
} as const;

/** Structural transport schema; catalog checks and configurable limits belong to the compiled validator. */
export const treeSchema = {
  ...treeFields,
  properties: {
    format: treeFields.properties.format,
    catalogId: treeFields.properties.catalogId,
    surfaceId: treeFields.properties.surfaceId,
    revision: treeFields.properties.revision,
    focus: nodeId,
    root: node,
  },
  $defs: {
    json: jsonSchema,
    localWrite: { ...localWriteFields, properties: { ...localWriteFields.properties, value: json } },
    intent: {
      oneOf: [
        {
          ...stateFields,
          properties: { ...stateFields.properties, value: json, local: localWrites },
          not: { properties: { value: {}, fromLocal: {} }, required: ["value", "fromLocal"] },
        },
        {
          ...actionFields,
          properties: {
            ...actionFields.properties,
            args: jsonMap,
            bindAll: { const: true },
            local: localWrites,
            fromLocal: fromLocalMap,
          },
          not: { properties: { bind: {}, bindAll: {} }, required: ["bind", "bindAll"] },
        },
        { ...localFields, properties: { ...localFields.properties, value: json } },
      ],
    },
    node: {
      ...nodeFields,
      properties: {
        ...nodeFields.properties,
        // The path grammar matches the proof's encoded JSX keys; depth and bytes are configurable.
        id: nodeId,
        props: jsonMap,
        style,
        events: { type: "object", additionalProperties: { $ref: "#/$defs/intent" } },
        when: json,
        bind: jsonMap,
        children: { type: "array", items: node },
      },
    },
  },
} as const;

/** Author-side reference marker; the emitted tree carries the resolved id string. */
export type NodeRef = { readonly $ref: string };
