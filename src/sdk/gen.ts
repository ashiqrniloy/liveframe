import { LiveframeFailure } from "../errors.ts";
import type { Capabilities, ObjectSchema } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { styleProps } from "../formats/fixed.ts";
import type { Manifest } from "../formats/manifest.ts";
import type { LanguageSchema } from "../schema.ts";
import { type UrlRule, urlExpected, urlPattern } from "../url.ts";
import { MAX_BINDINGS, MAX_TREE_EXPRESSION_NODES, TREE_EXPRESSION, TREE_OPERATORS } from "../validate/bindings.ts";
import { DEFAULT_LIMITS } from "../validate/tree.ts";

const quote = (value: string) => JSON.stringify(value);
const property = (value: string) => (/^[A-Za-z_$][\w$]*$/.test(value) ? value : quote(value));
const union = (values: readonly string[]) => values.map(quote).join(" | ") || "never";
const componentName = (kind: string) =>
  kind.replace(/(^|-+)([A-Za-z0-9])/g, (_, _dash, letter: string) => letter.toUpperCase()).replace(/-+$/g, "");

function wrapUnion(type: string, indent: string): string {
  return `${indent}| ${type.replace(/"(?:\\.|[^"\\])*"| \| /g, (token) => (token === " | " ? `\n${indent}| ` : token))}`;
}

function schemaType(schema: LanguageSchema, indent: string): string {
  const type = formType(schema, indent);
  return schema.nullable === true ? `${type}${type.startsWith("\n") ? `\n${indent}  | null` : " | null"}` : type;
}

function formType(schema: LanguageSchema, indent: string): string {
  if ("discriminator" in schema) {
    const entries = Object.entries(schema.mapping);
    return entries
      .map(([tag, entry]) =>
        formType(
          {
            ...entry,
            properties: {
              ...entry.properties,
              [schema.discriminator]: { type: "string", maxLength: 64, enum: [tag] } as const,
            },
            required: [schema.discriminator, ...entry.required],
          },
          entries.length > 1 ? `${indent}    ` : indent,
        ),
      )
      .map((entry) => (entries.length > 1 ? `\n${indent}  | ${entry}` : entry))
      .join("");
  }
  switch (schema.type) {
    case "string":
      return schema.enum ? union(schema.enum) : "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "array": {
      const item = schemaType(schema.items, indent);
      return `ReadonlyArray<${item}${item.startsWith("\n") ? `\n${indent}` : ""}>`;
    }
    case "object": {
      const entries = Object.entries(schema.properties);
      if (!entries.length) return "Record<string, never>";
      return `{\n${entries.map(([key, child]) => member(key, !schema.required.includes(key), schemaType(child, `${indent}  `), `${indent}  `)).join("\n")}\n${indent}}`;
    }
  }
}

function member(key: string, optional: boolean, type: string, indent = "  "): string {
  const prefix = `${indent}readonly ${property(key)}${optional ? "?" : ""}:`;
  if (type.startsWith("\n")) return `${prefix}${type};`;
  if (!type.includes("\n") && `${prefix} ${type};`.length > 120 && type.includes(" | "))
    return `${prefix}\n${wrapUnion(type, `${indent}  `)};`;
  return `${prefix} ${type};`;
}

/** A prop's doc comment naming the schemes a `url` string accepts. */
function urlDoc(rule: UrlRule): string {
  return `  /** Expects ${urlExpected(rule)}. */\n`;
}

function alias(name: string, type: string): string {
  const prefix = `type ${name} =`;
  return `${prefix} ${type};`.length <= 120 || !type.includes(" | ")
    ? `${prefix} ${type};`
    : `${prefix}\n${wrapUnion(type, "  ")};`;
}

/** The emitted TypeScript type of each style prop. */
const styleTypes = {
  padding: "_Space",
  paddingX: "_Space",
  paddingY: "_Space",
  paddingTop: "_Space",
  paddingRight: "_Space",
  paddingBottom: "_Space",
  paddingLeft: "_Space",
  margin: "_Space",
  marginX: "_Space",
  marginY: "_Space",
  marginTop: "_Space",
  marginRight: "_Space",
  marginBottom: "_Space",
  marginLeft: "_Space",
  gap: "_Space",
  insetTop: "_Space",
  insetBottom: "_Space",
  deferOffscreen: "_Length",
  direction: union(["horizontal", "vertical"]),
  align: union(["start", "center", "end", "stretch", "baseline"]),
  justify: union(["start", "center", "end", "between", "around", "evenly"]),
  wrap: union(["nowrap", "wrap"]),
  textAlign: union(["start", "center", "end"]),
  position: union(["static", "sticky"]),
  width: "_Dimension",
  height: "_Dimension",
  minWidth: "_Dimension",
  maxWidth: "_Dimension",
  minHeight: "_Dimension",
  maxHeight: "_Dimension",
  grow: "number",
  shrink: "number",
  basis: "number",
  columns: "ReadonlyArray<_Track>",
  rows: "ReadonlyArray<_Track>",
  area: "ReadonlyArray<string>",
  surface: "_Surface",
  fill: "_Fill",
  radius: "_Radius",
  textStyle: "_TextStyle",
  tone: "_Tone",
} satisfies Record<(typeof styleProps)[number], string>;

/** The module head: imports and the vocabulary-derived helper types every component uses. */
function prelude(v: Catalog["vocabulary"]): string[] {
  return [
    "// Generated by liveframe gen. Do not edit.",
    "import {",
    "  type Element as _Element,",
    "  type Expr as _Expr,",
    "  type Intent as _Intent,",
    "  type Json as _Json,",
    "  type LocalIntent as _LocalIntent,",
    "  primitive,",
    '} from "@arnilo/liveframe/sdk";',
    "",
    alias("_Space", union(v.space)),
    alias("_Length", union([...v.space, ...v.size])),
    // biome-ignore lint/suspicious/noTemplateCurlyInString: These are emitted TypeScript template literal types.
    "type _Track = _Length | `${number}fr`;",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: These are emitted TypeScript template literal types.
    'type _Dimension = _Length | "fill" | "fit" | `${number}ch` | `${number}%`;',
    alias("_Surface", union(v.surfaceRoles)),
    alias("_Fill", union(v.fillableRoles)),
    alias("_Radius", union([...v.radius, "full"])),
    alias("_TextStyle", union(v.typographyRoles)),
    alias("_Tone", union(Object.keys(v.tones))),
    "type _Responsive<T> =",
    "  | T",
    "  | {",
    "      readonly base: T;",
    ...v.breakpoints.map((key) => member(key, true, "T", "      ")),
    "    };",
    "type _Child = _Element | null | undefined | boolean | readonly _Child[];",
    "type _ExplicitIntent =",
    '  | { readonly type: "setState"; readonly key: string; readonly value: _Json }',
    '  | { readonly type: "setLocal"; readonly key: string; readonly value: _Json }',
    "  | {",
    '      readonly type: "action";',
    "      readonly name: string;",
    "      readonly args: Readonly<Record<string, _Json>>;",
    "      readonly bind?: never;",
    "      readonly bindAll?: never;",
    "    };",
  ];
}

/** `bind`, typed per bindable prop (references name other nodes, so a binding cannot rewrite them). */
function bindMember(d: Catalog["definitions"][number]): string[] {
  const names = Object.keys(d.props.properties).filter((key) => !d.refProps?.includes(key));
  const entries = names.map((key) => `    readonly ${property(key)}?: _Expr;`);
  return names.length ? [`  readonly bind?: {\n${entries.join("\n")}\n  };`] : [];
}

/** One definition's `primitive<…>()` export, with its doc comment. `names` catches component name collisions. */
function component(d: Catalog["definitions"][number], names: Set<string>): string {
  const name = componentName(d.kind);
  if (names.has(name)) throw new TypeError(`Component name collision: ${name}`);
  names.add(name);
  const reserved = new Set([
    "key",
    "variant",
    "children",
    "when",
    "bind",
    "focus",
    ...d.styleProps,
    ...Object.keys(d.events),
  ]);
  for (const key of Object.keys(d.props.properties))
    if (reserved.has(key)) throw new TypeError(`Prop name collision: ${d.kind}.${key}`);
  const props = [
    ...Object.entries(d.props.properties).map(([key, schema]) => {
      const doc = schema.type === "string" && schema.url ? urlDoc(schema.url) : "";
      return `${doc}${member(key, !d.props.required.includes(key), d.refProps?.includes(key) ? "_NodeRef" : schemaType(schema, "  "))}`;
    }),
    member("variant", true, union(d.variants)),
    ...d.styleProps.map((key) => member(key, true, `_Responsive<${styleTypes[key]}>`)),
    ...Object.entries(d.events).map(([key, event]) =>
      member(key, true, event.carries === "none" ? "_ExplicitIntent" : "_Intent | _LocalIntent"),
    ),
    member("when", true, "_Expr"),
    ...bindMember(d),
    member("focus", true, "boolean"),
    ...(d.children === "none" ? [] : [member("children", true, "_Child")]),
  ];
  const description = d.description
    .replaceAll("*/", "* /")
    .split(/\r\n|[\n\r\u2028\u2029]/)
    .map((line) => ` * ${line}`)
    .join("\n");
  return `/**\n${description}\n */\nexport const ${name} = primitive<{\n${props.join("\n")}\n}>(${quote(d.kind)});`;
}

/** Manifest-typed `action` and `state` exports emitted when `generate` receives a manifest. */
function manifestIntentPrelude(manifest: Manifest): string[] {
  const localSchema = manifest.local;
  const entries = localSchema ? Object.entries(localSchema.properties) : [];
  const localType = entries.length
    ? `{\n${entries.map(([key, schema]) => member(key, !localSchema?.required.includes(key), schemaType(schema, "  "), "  ")).join("\n")}\n}`
    : "Record<never, never>";
  const writeUnion = entries.length
    ? entries
        .map(([key, schema]) => {
          const valType = schemaType(schema, "  ");
          return [
            `  | (_LocalIntent & { readonly key: ${quote(key)}; readonly value?: ${valType} })`,
            `  | { readonly key: ${quote(key)}; readonly value?: ${valType}; readonly until?: "revision" }`,
          ].join("\n");
        })
        .join("\n")
    : "  never";
  return [
    "type _Local =",
    localType.startsWith("{") ? localType : `  ${localType};`,
    "type _ManifestLocalWrite =",
    `${writeUnion};`,
    "type _ManifestStateOptions = { readonly local?: readonly _ManifestLocalWrite[]; readonly fromLocal?: keyof _Local & string };",
    "type _ManifestActionOptions = {",
    "  readonly resultKey?: string;",
    "  readonly local?: readonly _ManifestLocalWrite[];",
    "  readonly fromLocal?: Readonly<Record<string, keyof _Local & string>>;",
    "};",
    "export const state: {",
    "  readonly set: {",
    '    (key: string, value: _Json, options?: _ManifestStateOptions): Extract<_Intent, { type: "setState" }> & { readonly value: _Json };',
    '    (key: string, value?: undefined, options?: _ManifestStateOptions): Extract<_Intent, { type: "setState" }> & { readonly value?: never };',
    '    (key: string, value?: _Json, options?: _ManifestStateOptions): Extract<_Intent, { type: "setState" }>;',
    "  };",
    "} = _state;",
    "export const action: {",
    '  (actionName: string, args?: Readonly<Record<string, _Json>>, options?: _ManifestActionOptions & { readonly bind?: never; readonly bindAll?: never }): Extract<_Intent, { type: "action" }> & { readonly bind?: never; readonly bindAll?: never };',
    '  (actionName: string, args: Readonly<Record<string, _Json>>, options: _ManifestActionOptions & { readonly bind: string; readonly bindAll?: never }): Extract<_Intent, { type: "action" }> & { readonly bind: string; readonly bindAll?: never };',
    '  (actionName: string, args: Readonly<Record<string, _Json>>, options: _ManifestActionOptions & { readonly bindAll: true; readonly bind?: never }): Extract<_Intent, { type: "action" }> & { readonly bindAll: true; readonly bind?: never };',
    '  (actionName: string, args?: Readonly<Record<string, _Json>>, options?: _ManifestActionOptions & { readonly bind?: string; readonly bindAll?: true }): Extract<_Intent, { type: "action" }>;',
    "} = _action;",
  ];
}

/** Emits a typed source module from a validated catalog, without host APIs or a formatter dependency. */
export function generate(catalog: Catalog, options?: { readonly manifest?: Manifest }): string {
  const names = new Set<string>();
  const components = catalog.definitions.map((d) => component(d, names));
  const imports = catalog.definitions.some((d) => d.refProps?.length)
    ? ['import type { NodeRef as _NodeRef } from "@arnilo/liveframe";']
    : [];
  const head = prelude(catalog.vocabulary);
  if (options?.manifest) {
    const idx = head.indexOf("  primitive,");
    if (idx >= 0) head.splice(idx, 1, "  action as _action,", "  primitive,", "  state as _state,");
    head.push(...manifestIntentPrelude(options.manifest));
  }
  return `${[...head, ...imports].join("\n")}\n\n${components.join("\n\n")}\n`;
}

const LINE = 120;

function inlineLiteral(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineLiteral).join(", ")}]`;
  if (value && typeof value === "object")
    return `{ ${Object.entries(value)
      .map(([key, child]) => `${property(key)}: ${inlineLiteral(child)}`)
      .join(", ")} }`;
  return JSON.stringify(value) ?? "null";
}

/** Objects keep one member per line; arrays stay inline while they fit, as the formatter renders them. */
function literal(value: unknown, indent: string, column: number): string {
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const inline = inlineLiteral(value);
    if (column + inline.length + 1 <= LINE) return inline;
    const inner = `${indent}  `;
    return `[\n${value.map((child) => `${inner}${literal(child, inner, inner.length)},`).join("\n")}\n${indent}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    const inner = `${indent}  `;
    return `{\n${entries
      .map(([key, child]) => {
        const head = `${inner}${property(key)}: `;
        return `${head}${literal(child, inner, head.length)},`;
      })
      .join("\n")}\n${indent}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Emits literal `as const` definitions, so `implement()` infers what a hand-written definition would. */
export function generateDefinitions(catalog: Catalog): string {
  const names = new Set<string>();
  const definitions = catalog.definitions.map((definition) => {
    const name = componentName(definition.kind);
    if (names.has(name)) throw new TypeError(`Component name collision: ${name}`);
    names.add(name);
    return `export const ${name} = ${literal(definition, "", 0)} as const satisfies Definition;`;
  });
  return `${[
    "// Generated by liveframe gen. Do not edit.",
    'import type { Definition } from "@arnilo/liveframe";',
    "",
  ].join("\n")}\n${definitions.join("\n\n")}\n`;
}

/** The tree format's JSON-Schema fragments, rebuilt here so this host-free subpath never names a host API. */
function intentSchemas(localKeys?: readonly string[]): {
  json: Record<string, unknown>;
  intent: Record<string, unknown>;
} {
  const json = { $ref: "#/$defs/json" };
  const jsonMap = { type: "object", additionalProperties: json };
  const name = { type: "string", maxLength: 128, pattern: "^.+$" };
  // With the caller's `local`, every local key is one it declares, and `setLocal` is offered.
  const localName = localKeys ? { enum: [...localKeys] } : name;
  const capability = {
    type: "string",
    maxLength: 128,
    pattern: "^[a-z][a-zA-Z0-9]*(\\.[a-z][a-zA-Z0-9]*)*$",
  };
  const localWrites = {
    type: "array",
    minItems: 1,
    maxItems: 4,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["key"],
      properties: { key: localName, value: json, until: { type: "string", enum: ["revision"] } },
    },
  };
  const setLocal = {
    type: "object",
    additionalProperties: false,
    required: ["type", "key"],
    properties: { type: { const: "setLocal" }, key: localName, value: json },
  };
  return {
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
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "key"],
          properties: { type: { const: "setState" }, key: name, value: json, local: localWrites, fromLocal: localName },
          not: { properties: { value: {}, fromLocal: {} }, required: ["value", "fromLocal"] },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "name", "args"],
          properties: {
            type: { const: "action" },
            name: capability,
            args: jsonMap,
            bind: name,
            bindAll: { const: true },
            local: localWrites,
            fromLocal: { type: "object", minProperties: 1, maxProperties: 16, additionalProperties: localName },
          },
          not: { properties: { bind: {}, bindAll: {} }, required: ["bind", "bindAll"] },
        },
        ...(localKeys ? [setLocal] : []),
      ],
    },
  };
}

function discriminatedSchema(
  schema: Extract<LanguageSchema, { readonly discriminator: string }>,
): Record<string, unknown> {
  return {
    oneOf: Object.entries(schema.mapping).map(([tag, entry]) => {
      const branch = jsonSchema(entry);
      return {
        ...branch,
        properties: { ...(branch.properties as Record<string, unknown>), [schema.discriminator]: { const: tag } },
        required: [schema.discriminator, ...((branch.required as string[] | undefined) ?? [])],
      };
    }),
  };
}

/** JSON Schema 2020-12 for the schema language; keywords only, no annotations a port would ignore. */
function jsonSchema(schema: LanguageSchema): Record<string, unknown> {
  const base = "discriminator" in schema ? discriminatedSchema(schema) : formSchema(schema);
  return schema.nullable === true ? { anyOf: [base, { type: "null" }] } : base;
}

/** One non-discriminated schema form, with only the keywords it sets. */
function formSchema(schema: Exclude<LanguageSchema, { readonly discriminator: string }>): Record<string, unknown> {
  switch (schema.type) {
    case "string":
      return stringSchema(schema);
    case "number":
    case "integer": {
      const out: Record<string, unknown> = { type: schema.type };
      if (schema.minimum !== undefined) out.minimum = schema.minimum;
      if (schema.maximum !== undefined) out.maximum = schema.maximum;
      return out;
    }
    case "boolean":
      return { type: "boolean" };
    case "array": {
      const out: Record<string, unknown> = {
        type: "array",
        items: jsonSchema(schema.items),
        maxItems: schema.maxItems,
      };
      if (schema.minItems !== undefined) out.minItems = schema.minItems;
      return out;
    }
    case "object":
      return objectSchema(schema);
  }
}

function stringSchema(schema: Extract<LanguageSchema, { readonly type: "string" }>): Record<string, unknown> {
  const out: Record<string, unknown> = { type: "string", maxLength: schema.maxLength };
  if (schema.minLength !== undefined) out.minLength = schema.minLength;
  if (schema.pattern !== undefined) out.pattern = schema.pattern;
  if (schema.url !== undefined) out.pattern = urlPattern(schema.url);
  if (schema.enum !== undefined) out.enum = [...schema.enum];
  return out;
}

function objectSchema(schema: Extract<LanguageSchema, { readonly type: "object" }>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(schema.properties)) properties[key] = jsonSchema(child);
  const out: Record<string, unknown> = { type: "object", properties, additionalProperties: false };
  if (schema.required.length) out.required = [...schema.required];
  return out;
}

/** What `generateElementsSchema` adds to the element schema. */
export type ElementsSchemaOptions = {
  /**
   * The `local` schema the caller passes to `ephemeralManifest` (spec §8). With it, elements may carry
   * `when` and `bind`, and intents may write and read the declared local keys. Without it the schema is
   * unchanged.
   */
  readonly local?: ObjectSchema;
};

/** A tree `$path` reads a declared local key, `shown`, or one of the node's own props (spec §8). */
function treePathOperand(local: ObjectSchema): Record<string, unknown> {
  return {
    anyOf: [
      { enum: [...Object.keys(local.properties).map((key) => `local.${key}`), "shown"] },
      { type: "string", maxLength: 64, pattern: "^self\\.[a-z][A-Za-z0-9]*$" },
    ],
  };
}

/** The tree expression grammar (spec §8): the template operators narrowed to the tree allow-list. */
function treeExpressionDefs(local: ObjectSchema): Record<string, unknown> {
  const operands = operatorOperands(treePathOperand(local));
  return {
    expr: {
      anyOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
        { type: "array", items: expr },
        ref("operator"),
        // An object constructor: no `$` key, so a misspelt operator is not one.
        { type: "object", propertyNames: { pattern: "^[^$]" }, additionalProperties: expr },
      ],
    },
    operator: {
      anyOf: Object.entries(operands)
        .filter(([name]) => TREE_OPERATORS.has(name))
        .map(([name, operand]) => ({
          type: "object",
          additionalProperties: false,
          required: [name],
          properties: { [name]: operand },
        })),
    },
  };
}

/** `when` and `bind` for one kind: `bind` reaches its bindable props, never its reference props. */
function expressionMembers(definition: Catalog["definitions"][number]): Record<string, unknown> {
  const bindable = Object.keys(definition.props.properties).filter((name) => !definition.refProps?.includes(name));
  return {
    when: { ...expr, description: "Draws the node only while this boolean expression holds." },
    bind: {
      type: "object",
      maxProperties: MAX_BINDINGS,
      properties: Object.fromEntries(bindable.map((name) => [name, expr])),
      additionalProperties: false,
    },
  };
}

/**
 * Deterministic agent-facing element JSON Schema for one catalog (LF-16). With `local`, it also
 * describes `when`, `bind`, the tree expression grammar and the local intents (spec §7.2).
 */
export function generateElementsSchema(catalog: Catalog, options: ElementsSchemaOptions = {}): string {
  const { local } = options;
  const fragment = {
    type: "object",
    description: "A keyed group with no node of its own.",
    additionalProperties: false,
    required: ["kind", "children"],
    properties: {
      kind: { const: "fragment" },
      key: { anyOf: [{ type: "string" }, { type: "number" }] },
      children: { type: "array", items: { $ref: "#/$defs/element" } },
    },
  };
  const element = {
    oneOf: [
      fragment,
      ...catalog.definitions.map((definition) => ({
        type: "object",
        description: definition.description,
        additionalProperties: false,
        required: ["kind"],
        properties: {
          kind: { const: definition.kind },
          key: { anyOf: [{ type: "string" }, { type: "number" }] },
          ...(definition.variants.length ? { variant: { enum: [...definition.variants] } } : {}),
          $anchor: { type: "string" },
          props: {
            ...jsonSchema(definition.props),
            properties: Object.fromEntries(
              Object.entries(definition.props.properties).map(([name, schema]) => [
                name,
                definition.refProps?.includes(name)
                  ? {
                      type: "object",
                      additionalProperties: false,
                      required: ["$ref"],
                      properties: { $ref: { type: "string" } },
                    }
                  : jsonSchema(schema),
              ]),
            ),
          },
          style: {
            type: "object",
            properties: Object.fromEntries(definition.styleProps.map((name) => [name, {}])),
            additionalProperties: false,
          },
          events: {
            type: "object",
            properties: Object.fromEntries(
              Object.keys(definition.events).map((name) => [name, { $ref: "#/$defs/intent" }]),
            ),
            additionalProperties: false,
          },
          ...(local ? expressionMembers(definition) : {}),
          focus: { type: "boolean", description: "Moves focus here when a later revision first carries this mark." },
          children: { type: "array", items: { $ref: "#/$defs/element" } },
        },
      })),
    ],
  };
  const intents = intentSchemas(local && Object.keys(local.properties));
  const document = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:liveframe:elements:1",
    title: `Liveframe elements for ${catalog.catalogId}`,
    $ref: "#/$defs/element",
    $defs: {
      json: intents.json,
      intent: intents.intent,
      ...(local ? treeExpressionDefs(local) : {}),
      element,
    },
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

// ---- Template schema (spec §7.6) ------------------------------------------------------------------

/** What `generateTemplateSchema` narrows by. Everything is optional; each document adds precision. */
export type TemplateSchemaOptions = {
  /** Enumerates the `$path`s the widget can read, the state keys it can set and the actions it can request. */
  readonly manifest?: Manifest;
  /** Types action arguments and, with no manifest, lists every declared action. */
  readonly capabilities?: Capabilities;
  /** Drop the constraint keywords structured-output APIs reject (see `structuredSubset`). */
  readonly structuredSubset?: boolean;
};

const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const expr = ref("expr");
const exprList = (min: number, max?: number) => ({
  type: "array",
  items: expr,
  minItems: min,
  ...(max === undefined ? {} : { maxItems: max }),
});
const bindingName = { type: "string", maxLength: 32, pattern: "^[a-z][A-Za-z0-9]{0,31}$" };
const binder = (body: "where" | "value") => ({
  type: "object",
  additionalProperties: false,
  required: ["in", "as", body],
  properties: { in: expr, as: bindingName, index: bindingName, [body]: expr },
});

/** Operand shape of each operator (spec §7.6). */
function operatorOperands(path: Record<string, unknown>): Record<string, unknown> {
  return {
    $path: path,
    $lit: ref("json"),
    $ref: { type: "string", maxLength: 128 },
    $omit: { type: "null" },
    $has: expr,
    $eq: exprList(2, 2),
    $ne: exprList(2, 2),
    $lt: exprList(2, 2),
    $lte: exprList(2, 2),
    $gt: exprList(2, 2),
    $gte: exprList(2, 2),
    $and: exprList(2),
    $or: exprList(2),
    $not: expr,
    $cond: exprList(3, 3),
    $coalesce: exprList(2),
    $len: expr,
    $concat: exprList(2),
    $join: exprList(2, 2),
    $text: expr,
    $contains: exprList(2, 2),
    $split: exprList(2, 2),
    $slice: exprList(2, 3),
    $add: exprList(2),
    $mul: exprList(2),
    $sub: exprList(2, 2),
    $div: exprList(2, 2),
    $round: exprList(1, 2),
    $sum: expr,
    $filter: binder("where"),
    $map: binder("value"),
    $findIndex: binder("where"),
    $flat: expr,
    $at: exprList(2, 2),
    $get: exprList(2, 2),
    $merge: exprList(2),
    $fromEntries: expr,
    $let: {
      type: "object",
      additionalProperties: false,
      required: ["bind", "in"],
      properties: {
        bind: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["as", "value"],
            properties: { as: bindingName, value: expr },
          },
        },
        in: expr,
      },
    },
  };
}

const PATH_ROOTS = ["params", "state", "context", "data"] as const;
const MAX_PATHS = 1000;
const PATH_SEGMENT = /^[A-Za-z0-9]+$/;

/** Every dotted path into a schema that stops at arrays, in document order. */
function collectPaths(prefix: string, schema: LanguageSchema, depth: number, out: Set<string>): void {
  out.add(prefix);
  if (depth === 0 || out.size > MAX_PATHS) return;
  const members =
    "discriminator" in schema
      ? [[schema.discriminator, undefined] as const, ...Object.values(schema.mapping).flatMap(propertiesOf)]
      : schema.type === "object"
        ? propertiesOf(schema)
        : [];
  for (const [name, child] of members)
    if (PATH_SEGMENT.test(name)) {
      if (child) collectPaths(`${prefix}.${name}`, child, depth - 1, out);
      else out.add(`${prefix}.${name}`);
    }
}
const propertiesOf = (schema: Extract<LanguageSchema, { readonly type: "object" }>) =>
  Object.entries(schema.properties);

/** The `$path`s a widget with this manifest can read, or undefined when there are too many to list. */
function knownPaths(manifest: Manifest, capabilities: Capabilities | undefined): string[] | undefined {
  const out = new Set<string>();
  const data: Record<string, LanguageSchema> = {};
  for (const [alias, declared] of Object.entries(manifest.sources)) {
    const result = capabilities?.sources[declared.source]?.result;
    if (result) data[alias] = result;
  }
  const roots: Record<(typeof PATH_ROOTS)[number], LanguageSchema> = {
    params: manifest.params,
    state: manifest.state,
    context: manifest.context,
    data: { type: "object", properties: data, required: Object.keys(data), additionalProperties: false },
  };
  for (const root of PATH_ROOTS) collectPaths(root, roots[root], 6, out);
  // Action names hold dots, so `actions` is read whole and its entries are reached with `$get`.
  out.add("actions");
  return out.size > MAX_PATHS ? undefined : [...out];
}

/** A `$path` is one of the widget's own inputs, or a bound name (`row.id`) that no root shadows. */
function pathOperand(paths: string[] | undefined): Record<string, unknown> {
  if (!paths) return { type: "string", maxLength: 256 };
  return {
    anyOf: [
      { enum: paths },
      {
        type: "string",
        maxLength: 256,
        pattern: "^(?!(?:params|state|data|context|actions)(?:\\.|$))[a-z][A-Za-z0-9]*(?:\\.[A-Za-z0-9]+)*$",
      },
    ],
  };
}

/** `fromLocal` schema for one template action branch. */
function templateActionFromLocal(
  hasLocal: boolean,
  localName: Record<string, unknown>,
  capability: Capabilities["actions"][string] | undefined,
): Record<string, unknown> {
  if (!hasLocal) return {};
  return {
    fromLocal: {
      type: "object",
      minProperties: 1,
      maxProperties: 16,
      ...(capability
        ? {
            additionalProperties: false,
            properties: Object.fromEntries(Object.keys(capability.args.properties).map((key) => [key, localName])),
          }
        : { additionalProperties: localName }),
    },
  };
}

/** `setState`, `setLocal` and `action` intents whose `value` and `args` members are expressions. */
function templateIntent(manifest: Manifest | undefined, capabilities: Capabilities | undefined) {
  const stateKeys = manifest ? Object.keys(manifest.state.properties) : undefined;
  const localKeys = manifest ? Object.keys(manifest.local?.properties ?? {}) : undefined;
  const hasLocal = !localKeys || localKeys.length > 0;
  const localName = localKeys ? { enum: localKeys } : { type: "string", maxLength: 128 };
  const localWrites = hasLocal
    ? {
        local: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key"],
            properties: {
              key: localName,
              value: expr,
              until: { enum: ["revision"] },
            },
          },
        },
      }
    : {};
  const fromLocalState = hasLocal ? { fromLocal: localName } : {};
  const actionNames = manifest ? manifest.actions : capabilities ? Object.keys(capabilities.actions) : undefined;
  const branches: Record<string, unknown>[] = [];
  if (!stateKeys || stateKeys.length)
    branches.push({
      type: "object",
      additionalProperties: false,
      required: ["type", "key"],
      properties: {
        type: { const: "setState" },
        key: stateKeys ? { enum: stateKeys } : { type: "string", maxLength: 128 },
        value: expr,
        ...localWrites,
        ...fromLocalState,
      },
    });
  if (hasLocal)
    branches.push({
      type: "object",
      additionalProperties: false,
      required: ["type", "key"],
      properties: {
        type: { const: "setLocal" },
        key: localName,
        value: expr,
      },
    });
  const bind = { bind: { type: "string", maxLength: 128 }, bindAll: { const: true } };
  const action = (name: string | undefined) => {
    const capability =
      name !== undefined && capabilities && Object.hasOwn(capabilities.actions, name)
        ? capabilities.actions[name]
        : undefined;
    return {
      type: "object",
      additionalProperties: false,
      required: ["type", "name", "args"],
      properties: {
        type: { const: "action" },
        name: name === undefined ? { type: "string", maxLength: 128 } : { const: name },
        args: capability
          ? {
              type: "object",
              additionalProperties: false,
              properties: Object.fromEntries(Object.keys(capability.args.properties).map((key) => [key, expr])),
            }
          : { type: "object", additionalProperties: expr },
        ...bind,
        ...localWrites,
        ...templateActionFromLocal(hasLocal, localName, capability),
      },
    };
  };
  if (actionNames) for (const name of actionNames) branches.push(action(name));
  else branches.push(action(undefined));
  // A widget with no state keys and no actions can offer no intent: the schema that accepts nothing.
  return branches.length ? { anyOf: branches } : false;
}

/** The language-schema meta-form a component's `params` is written in; closed forms only. */
const paramsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "properties", "required", "additionalProperties"],
  properties: {
    type: { const: "object" },
    properties: { type: "object", additionalProperties: ref("schemaNode") },
    required: { type: "array", items: { type: "string" } },
    additionalProperties: { const: false },
  },
};
const schemaNode = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "maxLength"],
      properties: {
        type: { const: "string" },
        maxLength: { type: "integer" },
        minLength: { type: "integer" },
        enum: { type: "array", items: { type: "string" } },
      },
    },
    ...["number", "integer"].map((type) => ({
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: { type: { const: type }, minimum: { type: "number" }, maximum: { type: "number" } },
    })),
    { type: "object", additionalProperties: false, required: ["type"], properties: { type: { const: "boolean" } } },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "items", "maxItems"],
      properties: { type: { const: "array" }, items: ref("schemaNode"), maxItems: { type: "integer" } },
    },
    ref("paramsSchema"),
  ],
};

/** A node of one catalog kind: typed props, closed style and event names, and the directives. */
function templateKind(
  definition: Catalog["definitions"][number],
  styleRef: (names: readonly string[]) => Record<string, unknown>,
): Record<string, unknown> {
  const prop = (name: string, schema: LanguageSchema) =>
    definition.refProps?.includes(name)
      ? ref("nodeRef")
      : !("discriminator" in schema) && ["string", "number", "integer", "boolean"].includes(schema.type)
        ? { anyOf: [jsonSchema(schema), ref("operator")] }
        : expr;
  const props = {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(definition.props.properties).map(([name, schema]) => [name, prop(name, schema)]),
    ),
    ...(definition.props.required.length ? { required: [...definition.props.required] } : {}),
  };
  return {
    type: "object",
    description: definition.description,
    additionalProperties: false,
    required: definition.props.required.length ? ["kind", "props"] : ["kind"],
    properties: {
      kind: { const: definition.kind },
      key: expr,
      ...(definition.variants.length ? { variant: { enum: [...definition.variants] } } : {}),
      $anchor: { type: "string", maxLength: 128 },
      props,
      style: styleRef(definition.styleProps),
      events: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(Object.keys(definition.events).map((name) => [name, ref("intent")])),
      },
      // Tree expressions the renderer evaluates (spec §7.6); `$embed` is the one template value inside them.
      when: expr,
      bind: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(
          Object.keys(definition.props.properties)
            .filter((name) => !definition.refProps?.includes(name))
            .map((name) => [name, expr]),
        ),
      },
      focus: { anyOf: [{ type: "boolean" }, ref("operator")] },
      ...(definition.children === "none" ? {} : { children: { type: "array", items: ref("node") } }),
      ...directives,
    },
  };
}
const directives = { $let: ref("let"), $if: expr, $each: ref("each") };

/** Keywords some structured-output APIs reject (checked against the OpenAI and Claude docs). */
const SUBSET_DROPPED = new Set([
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "patternProperties",
  "propertyNames",
  "allOf",
  "not",
]);

/** The reduced form: constraint keywords removed and `oneOf` read as `anyOf`; the shape is unchanged. */
function structuredSubset(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (SUBSET_DROPPED.has(key)) continue;
    const target = key === "oneOf" ? "anyOf" : key;
    if (key === "properties" || key === "$defs")
      out[target] = Object.fromEntries(
        Object.entries(value as object).map(([name, child]) => [name, structuredSubset(child)]),
      );
    else if (key === "anyOf" || key === "oneOf") out[target] = (value as unknown[]).map(structuredSubset);
    else if (key === "items" || key === "additionalProperties") out[target] = structuredSubset(value);
    else out[target] = value;
  }
  return out;
}

/**
 * Deterministic agent-facing JSON Schema for template documents over one catalog. Kinds, variants,
 * props, style names and event names come from the catalog; a manifest adds the readable `$path`s,
 * state keys and actions; capabilities type action arguments. The install validator stays the
 * authority: this schema guides generation and cannot express scope, types or bounds.
 */
export function generateTemplateSchema(catalog: Catalog, options: TemplateSchemaOptions = {}): string {
  const { manifest, capabilities } = options;
  const operands = operatorOperands(pathOperand(manifest ? knownPaths(manifest, capabilities) : undefined));
  const operator = {
    anyOf: Object.entries(operands).map(([name, operand]) => ({
      type: "object",
      additionalProperties: false,
      required: [name],
      properties: { [name]: operand },
    })),
  };
  const intents = intentSchemas();
  // Kinds that accept the same style names share one definition.
  const styles = new Map<string, Record<string, unknown>>();
  const sharedStyles: Record<string, unknown> = {};
  const styleRef = (names: readonly string[]) => {
    const id = `style${styles.size}`;
    const known = styles.get(names.join(","));
    if (known) return known;
    const reference = ref(id);
    styles.set(names.join(","), reference);
    sharedStyles[id] = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(names.map((name) => [name, expr])),
    };
    return reference;
  };
  const node = {
    anyOf: [
      {
        type: "object",
        description: "A keyed group with no node of its own.",
        additionalProperties: false,
        required: ["kind", "children"],
        properties: {
          kind: { const: "fragment" },
          key: expr,
          children: { type: "array", items: ref("node") },
          ...directives,
        },
      },
      {
        type: "object",
        description: "Expands a component in place; the component's params receive `with`.",
        additionalProperties: false,
        required: ["$use"],
        properties: {
          $use: { type: "string", maxLength: 64, pattern: "^[A-Z][A-Za-z0-9]{0,63}$" },
          with: { type: "object", additionalProperties: expr },
          key: expr,
          ...directives,
        },
      },
      ...catalog.definitions.map((definition) => templateKind(definition, styleRef)),
    ],
  };
  const document = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:liveframe:template-schema:1",
    title: `Liveframe template for ${catalog.catalogId}`,
    type: "object",
    additionalProperties: false,
    required: ["format", "root"],
    properties: {
      format: { const: "liveframe-template/1" },
      components: { type: "object", additionalProperties: ref("component") },
      root: ref("node"),
    },
    $defs: {
      json: intents.json,
      expr: {
        anyOf: [
          { type: "string" },
          { type: "number" },
          { type: "boolean" },
          { type: "null" },
          { type: "array", items: expr },
          ref("operator"),
          // An object constructor: no `$` key, so a misspelt operator is not one.
          { type: "object", propertyNames: { pattern: "^[^$]" }, additionalProperties: expr },
        ],
      },
      operator,
      nodeRef: {
        type: "object",
        additionalProperties: false,
        required: ["$ref"],
        properties: { $ref: { type: "string", maxLength: 128 } },
      },
      let: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["as", "value"],
          properties: { as: bindingName, value: expr },
        },
      },
      each: {
        type: "object",
        additionalProperties: false,
        required: ["in", "as", "key"],
        properties: { in: expr, as: bindingName, index: bindingName, key: expr },
      },
      intent: templateIntent(manifest, capabilities),
      component: {
        type: "object",
        additionalProperties: false,
        required: ["params", "root"],
        properties: { params: ref("paramsSchema"), root: ref("node") },
      },
      paramsSchema,
      schemaNode,
      ...sharedStyles,
      node,
    },
  };
  return `${JSON.stringify(options.structuredSubset ? structuredSubset(document) : document, null, 2)}\n`;
}

/** What `generateDigest` describes beside the catalog, and its size bound. */
export type DigestOptions = {
  /** The actions and sources to describe. Pass a filtered copy to leave some out (the library never reads `meta`). */
  readonly capabilities?: Capabilities;
  /** The `local` schema the caller passes to `ephemeralManifest`; with it the digest describes expressions and local intents. */
  readonly local?: ObjectSchema;
  /** The largest digest, in characters (string length). A longer one throws `LiveframeFailure`; it is never cut. */
  readonly budget?: number;
};

function sortedEntries<T>(record: Readonly<Record<string, T>>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
/** A path from the `self` root, joined at run time so the host-API scans do not read it as the worker global. */
const selfPath = (name: string) => ["self", name].join(".");
const flags = (...names: (string | false | undefined)[]) => {
  const shown = names.filter(Boolean);
  return shown.length ? ` (${shown.join(", ")})` : "";
};

/** A compact type notation with bounds: `string≤80`, `integer 1..6`, `a|b`, `url≤2048(https; relative)`. */
function digestType(schema: LanguageSchema): string {
  const type = digestForm(schema);
  return schema.nullable === true ? `${type}|null` : type;
}

function digestRange(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return min === max ? ` ${min}` : ` ${min}..${max}`;
  if (min !== undefined) return ` ≥${min}`;
  return max === undefined ? "" : ` ≤${max}`;
}

function digestForm(schema: LanguageSchema): string {
  if ("discriminator" in schema)
    return sortedEntries(schema.mapping)
      .map(([tag, entry]) => digestMembers(entry, [`${schema.discriminator}: ${quote(tag)}`]))
      .join(" | ");
  switch (schema.type) {
    case "string": {
      if (schema.enum) return schema.enum.join("|");
      const length = schema.minLength ? `${schema.minLength}..${schema.maxLength}` : `≤${schema.maxLength}`;
      if (schema.url) return `url${length}(${schema.url.schemes.join(", ")}${schema.url.relative ? "; relative" : ""})`;
      return `string${length}${schema.pattern ? ` /${schema.pattern}/` : ""}`;
    }
    case "number":
    case "integer":
      return `${schema.type}${digestRange(schema.minimum, schema.maximum)}`;
    case "boolean":
      return "boolean";
    case "array": {
      const item = digestType(schema.items);
      const bound = schema.minItems ? `${schema.minItems}..${schema.maxItems}` : `≤${schema.maxItems}`;
      return `${/[|\s]/.test(item) && !item.startsWith("{") ? `(${item})` : item}[${bound}]`;
    }
    case "object":
      return digestMembers(schema);
  }
}

function digestMembers(schema: ObjectSchema, head: readonly string[] = []): string {
  return `{${[...head, ...digestProps(schema)].join("; ")}}`;
}

/** `name?: type`, sorted, with deprecation and description. */
function digestProps(schema: ObjectSchema, refProps: readonly string[] = []): string[] {
  return sortedEntries(schema.properties).map(([name, child]) => {
    const optional = schema.required.includes(name) ? "" : "?";
    const type = refProps.includes(name) ? 'ref {"$ref": anchor}' : digestType(child);
    return `${name}${optional}: ${type}${flags(child.deprecated && "deprecated", child.description)}`;
  });
}

function digestCarries(carries: Catalog["definitions"][number]["events"][string]["carries"]): string {
  if (typeof carries === "string") return carries === "none" ? "" : carries;
  if ("object" in carries) return digestMembers(carries.object);
  return `${digestType(carries.array.items)}[≤${carries.array.maxItems}]`;
}

/** The value set each style prop's `styleTypes` entry names in the digest. */
function styleValueSets(v: Catalog["vocabulary"]): [string, string][] {
  return [
    ["space", v.space.join(", ")],
    ["size", v.size.join(", ")],
    ["length", "a space or size name"],
    ["dimension", "a length, fill, fit, <n>ch or <n>%"],
    ["track", "a length or <n>fr"],
    ["surface", v.surfaceRoles.join(", ")],
    ["fill", v.fillableRoles.join(", ")],
    ["radius", [...v.radius, "full"].join(", ")],
    ["textStyle", v.typographyRoles.join(", ")],
    ["tone", Object.keys(v.tones).sort().join(", ")],
  ];
}

const styleValueNames: Record<string, string> = {
  _Space: "space",
  _Length: "length",
  _Dimension: "dimension",
  "ReadonlyArray<_Track>": "track[]",
  "ReadonlyArray<string>": "string[]",
  _Surface: "surface",
  _Fill: "fill",
  _Radius: "radius",
  _TextStyle: "textStyle",
  _Tone: "tone",
};

function digestStyle(catalog: Catalog): string[] {
  const used = new Set(catalog.definitions.flatMap((d) => d.styleProps));
  const groups = new Map<string, string[]>();
  for (const [name, type] of Object.entries(styleTypes)) {
    if (!used.has(name as keyof typeof styleTypes)) continue;
    const value = styleValueNames[type] ?? type.replaceAll('"', "").replaceAll(" | ", "|");
    groups.set(value, [...(groups.get(value) ?? []), name]);
  }
  const v = catalog.vocabulary;
  return [
    "## Style values",
    "",
    '`style` takes the kind\'s style props (listed per kind). Any value may instead be responsive: `{"base": value, "<breakpoint>"?: value}`,',
    `with breakpoints ${v.breakpoints.join(", ")}.`,
    "",
    ...styleValueSets(v).map(([name, values]) => `- ${name}: ${values}`),
    "",
    ...[...groups].map(([value, names]) => `- ${names.join(", ")}: ${value}`),
    "",
  ];
}

/** A value that fits the schema with no pattern to satisfy, or undefined; used only for the digest's example. */
function sampleValue(schema: LanguageSchema, text: string): unknown {
  if (schema.nullable === true) return null;
  if ("discriminator" in schema) return undefined;
  switch (schema.type) {
    case "string":
      if (schema.enum) return schema.enum[0];
      return schema.pattern || schema.url || (schema.minLength ?? 0) > text.length
        ? undefined
        : text.slice(0, schema.maxLength);
    case "number":
    case "integer":
      return Math.min(schema.minimum ?? 0, schema.maximum ?? Number.POSITIVE_INFINITY);
    case "boolean":
      return false;
    case "array":
      return schema.minItems ? undefined : [];
    case "object":
      return sampleProps(schema, text, []);
  }
}

function sampleProps(
  schema: ObjectSchema,
  text: string,
  refProps: readonly string[],
): Record<string, unknown> | undefined {
  const props: Record<string, unknown> = {};
  for (const name of schema.required) {
    const child = schema.properties[name];
    const value = child && !refProps.includes(name) ? sampleValue(child, text) : undefined;
    if (value === undefined) return undefined;
    props[name] = value;
  }
  return props;
}

/** A small document from the catalog's first container and first text-bearing leaf, so it is valid for this catalog. */
function digestExample(catalog: Catalog, local: ObjectSchema | undefined): string[] {
  const sample = (d: Catalog["definitions"][number], text: string) => sampleProps(d.props, text, d.refProps ?? []);
  const container = catalog.definitions.find((d) => d.children === "any" && !d.deprecated && sample(d, "List"));
  const leaf = catalog.definitions.find(
    (d) =>
      d.children === "none" &&
      !d.deprecated &&
      sample(d, "First") &&
      d.props.required.some((name) => typeof sample(d, "First")?.[name] === "string"),
  );
  if (!container || !leaf) return [];
  const textProp = leaf.props.required.find((name) => typeof sample(leaf, "First")?.[name] === "string") as string;
  const filterKey = local && sortedEntries(local.properties).find(([, s]) => s.type === "string" && !s.enum)?.[0];
  const child = (key: string, text: string) => ({
    kind: leaf.kind,
    key,
    props: sample(leaf, text),
    ...(filterKey ? { when: { $contains: [{ $path: selfPath(textProp) }, { $path: `local.${filterKey}` }] } } : {}),
  });
  const props = sample(container, "List") ?? {};
  const head = [
    `  "kind": ${quote(container.kind)},`,
    ...(Object.keys(props).length ? [`  "props": ${JSON.stringify(props)},`] : []),
  ];
  return [
    "Example:",
    "",
    "```json",
    "{",
    ...head,
    '  "children": [',
    `    ${JSON.stringify(child("a", "First"))},`,
    `    ${JSON.stringify(child("b", "Second"))}`,
    "  ]",
    "}",
    "```",
    "",
  ];
}

function digestWriting(catalog: Catalog, local: ObjectSchema | undefined): string[] {
  return [
    "## Writing element JSON",
    "",
    'Each element is `{"kind", "key"?, "$anchor"?, "variant"?, "props"?, "style"?, "events"?, "when"?, "bind"?, "focus"?, "children"?}`.',
    "",
    '- `kind`: a kind below, or `"fragment"` (`{"kind": "fragment", "key"?, "children"}` groups children without adding a node).',
    "- `key`: a string or number, distinct among siblings. Give one to every element of a list.",
    "- `props`: the kind's props; the ones without `?` are required. A `ref` prop names another element's `$anchor`.",
    "- `variant`, `style`, `events`, `children`: as each kind lists. `events` maps an event name to one intent.",
    ...(local ? ["- `when`, `bind`: see Expressions."] : []),
    "- `focus`: `true` moves focus here when a later revision first carries it.",
    "- Write `children` after the element's other members, so the document can be drawn while it streams.",
    `- At most ${DEFAULT_LIMITS.nodes} elements, depth ${DEFAULT_LIMITS.depth} and ${DEFAULT_LIMITS.bytes} bytes (the host may set less).`,
    "",
    ...digestExample(catalog, local),
    "Intents:",
    "",
    '- `{"type": "setState", "key": <state key>, "value"?: <json>}`: without `value`, the value the event carries.',
    '- `{"type": "action", "name": <action>, "args": {…}, "bind"?: <arg>, "bindAll"?: true}`: `bind` fills one argument with the value the event carries; `bindAll` fills arguments from the object it carries.',
    ...(local
      ? [
          '- `{"type": "setLocal", "key": <local key>, "value"?: <json>}`: changes local state in the browser, with no request; without `value`, the value the event carries.',
          '- On `setState` or `action`, `"local": [{"key": <local key>, "value"?: <json>, "until"?: "revision"}]` (1 to 4) also writes local state, and `fromLocal` reads it: a local key on `setState` (instead of `value`), `{<arg>: <local key>}` on `action`.',
        ]
      : []),
    "",
    "The host decides which state keys and actions a surface may use; anything else is rejected.",
    "",
  ];
}

/** Operator operand shapes in the digest's notation, from the same table the schemas use. */
function operandText(name: string, operand: Record<string, unknown>): string {
  if (name === "$path") return "path";
  if (name === "$lit") return "json";
  if (operand.type === "null") return "null";
  if (operand.type !== "array") return "x";
  const min = operand.minItems as number;
  const max = operand.maxItems as number | undefined;
  const names = ["a", "b", "c"];
  const items = names.slice(0, max ?? min).map((n, i) => (i < min ? n : `${n}?`));
  return `[${items.join(", ")}${max === undefined ? ", …" : ""}]`;
}

function digestExpressions(local: ObjectSchema): string[] {
  const groups = new Map<string, string[]>();
  for (const [name, operand] of Object.entries(operatorOperands({}))) {
    if (!TREE_OPERATORS.has(name)) continue;
    const text = operandText(name, operand as Record<string, unknown>);
    groups.set(text, [...(groups.get(text) ?? []), name]);
  }
  return [
    "## Expressions",
    "",
    "`when` draws the element only while its expression is true. `bind` maps prop names to expressions that supply",
    "those props; `props` still holds a complete static value. A kind's props are bindable except `ref` props; `variant`,",
    "`style` and `events` never are.",
    "",
    "An expression is a JSON literal, an array or object of expressions, or an object with one operator key:",
    "",
    ...[...groups].map(([text, names]) => `- ${names.join(", ")}: ${text}`),
    "",
    "`$contains: [text, part]` is true when `part` occurs in `text`, case-sensitive (an empty `part` always does);",
    "`$contains: [array, item]` tests membership. A string literal is a valid operand.",
    "",
    "`$path` reads:",
    "",
    ...digestProps(local).map((entry) => `- local.${entry.replace("?:", ":")}`),
    `- ${selfPath("<prop>")}: the element's own props`,
    "- shown: integer ≥0, how many of the element's siblings that carry `when` are drawn (an element that reads `shown` is not counted)",
    "",
    `Limits: ${TREE_EXPRESSION.depth} levels and ${TREE_EXPRESSION.nodes} nodes per expression, ${MAX_BINDINGS} \`bind\` entries per element, ${MAX_TREE_EXPRESSION_NODES} expression nodes per surface.`,
    "",
  ];
}

function digestKind(d: Catalog["definitions"][number]): string[] {
  const children =
    typeof d.children === "string" ? d.children : d.children.map((c) => `${c.kind} ${c.min}..${c.max}`).join(", ");
  const events = sortedEntries(d.events).map(([name, event]) => `${name}(${digestCarries(event.carries)})`);
  const axes = sortedEntries(d.axes ?? {}).map(([name, axis]) => `${name} (default ${axis.default})`);
  const props = digestProps(d.props, d.refProps);
  return [
    `### ${d.kind}${d.deprecated ? ` (deprecated: ${d.deprecated})` : ""}`,
    "",
    d.description,
    "",
    ...(props.length ? [`- props: ${props.join("; ")}`] : []),
    ...(d.variants.length > 1 ? [`- variants: ${d.variants.join(", ")} (default ${d.defaultVariant})`] : []),
    ...(axes.length ? [`- axes: ${axes.join(", ")}`] : []),
    ...(events.length ? [`- events: ${events.join(", ")}`] : []),
    `- children: ${children}`,
    ...(d.styleProps.length ? [`- style: ${d.styleProps.join(", ")}`] : []),
    "",
  ];
}

function digestCapabilities(capabilities: Capabilities): string[] {
  const actions = sortedEntries(capabilities.actions).map(([name, a]) => {
    const result = a.result ? ` → ${digestType(a.result)}` : "";
    return `- ${name}(${digestProps(a.args).join("; ")})${result}: ${a.description}${flags(a.confirm && "confirm", a.irreversible && "irreversible")}`;
  });
  const sources = sortedEntries(capabilities.sources).map(
    ([name, s]) => `- ${name}(${digestProps(s.params).join("; ")}) → ${digestType(s.result)}: ${s.description}`,
  );
  return [
    ...(actions.length ? ["## Actions", "", ...actions, ""] : []),
    ...(sources.length ? ["## Sources", "", ...sources, ""] : []),
  ];
}

/**
 * A deterministic Markdown description of a catalog for an agent that writes element JSON without MCP
 * (spec §7.2): kinds, props with bounds, variants, events and their carries, child rules, style values,
 * and, when given, expressions over `local` and the declared actions and sources. Over `budget` characters
 * it throws `LiveframeFailure` (`limit-exceeded` at `/digest`) and never truncates.
 */
export function generateDigest(catalog: Catalog, options: DigestOptions = {}): string {
  const { capabilities, local, budget } = options;
  const text = [
    `# ${catalog.catalogId}`,
    "",
    "Generated by `liveframe gen --digest`. Do not edit.",
    "",
    catalog.description,
    "",
    "Element JSON describes one surface as a tree of this catalog's kinds. The host validates every document before",
    "drawing it, so anything this file does not describe is rejected.",
    "",
    ...digestWriting(catalog, local),
    ...(local ? digestExpressions(local) : []),
    ...digestStyle(catalog),
    "## Kinds",
    "",
    ...catalog.definitions.flatMap(digestKind),
    ...(capabilities ? digestCapabilities(capabilities) : []),
  ]
    .join("\n")
    .replace(/\n+$/, "\n");
  if (budget !== undefined && text.length > budget)
    throw new LiveframeFailure([
      {
        kind: "limit-exceeded",
        pointer: "/digest",
        message: "The digest is longer than its budget",
        expected: `at most ${budget} characters, got ${text.length}`,
      },
    ]);
  return text;
}
