// The transport schema of `liveframe-template/1` (plan 028 Task 3): structure only. The catalog,
// manifest and expression rules, and every limit, are `validateTemplate`'s. Kept apart from the
// validator so the schema publisher imports it without the validation code.
import { jsonSchema, languageForms, objectSchema } from "../formats/language.ts";
import { treeSchema } from "../formats/tree.ts";
import { str } from "../schema.ts";

const json = { $ref: "#/$defs/json" } as const;
const jsonMap = { type: "object", additionalProperties: json } as const;
const nameForm = str({ maxLength: 32, pattern: "^[a-z][A-Za-z0-9]{0,31}$" });
const componentName = "^[A-Z][A-Za-z0-9]{0,63}$";
const token = str({ maxLength: 64, pattern: "^[a-z][A-Za-z0-9-]*$" });

export const templateSchema = {
  type: "object",
  properties: {
    format: str({ maxLength: 24, enum: ["liveframe-template/1"] }),
    components: {
      type: "object",
      patternProperties: { [componentName]: { $ref: "#/$defs/component" } },
      additionalProperties: false,
    },
    root: { $ref: "#/$defs/node" },
  },
  required: ["format", "root"],
  additionalProperties: false,
  $defs: {
    ...languageForms(false),
    objectSchema,
    json: jsonSchema,
    intent: treeSchema.$defs.intent,
    component: {
      type: "object",
      properties: { params: { $ref: "#/$defs/objectSchema" }, root: { $ref: "#/$defs/node" } },
      required: ["params", "root"],
      additionalProperties: false,
    },
    node: {
      type: "object",
      properties: {
        kind: token,
        key: json,
        variant: token,
        $anchor: str({ maxLength: 128, pattern: "^.+$" }),
        props: jsonMap,
        style: jsonMap,
        events: { type: "object", additionalProperties: { $ref: "#/$defs/intent" } },
        children: { type: "array", items: { $ref: "#/$defs/node" } },
        $let: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: { as: nameForm, value: json },
            required: ["as", "value"],
            additionalProperties: false,
          },
        },
        $if: json,
        $each: {
          type: "object",
          properties: { in: json, as: nameForm, index: nameForm, key: json },
          required: ["in", "as"],
          additionalProperties: false,
        },
        $use: str({ maxLength: 64, pattern: componentName }),
        with: jsonMap,
      },
      additionalProperties: false,
      not: { properties: { kind: {}, $use: {} }, required: ["kind", "$use"] },
    },
  },
} as const;
