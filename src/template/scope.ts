// Scope, expression types and compatibility for template expressions (plan 028, design T9, T12, T13).
// Types are the schema language plus three markers, so no second type system exists:
// "dynamic" (checked when evaluated), "null" (the null literal) and "absent" (`$omit`).
import { sameJson } from "../formats/json.ts";
import type { Json } from "../formats/tree.ts";
import { checkValue, isRecord, type LanguageSchema } from "../schema.ts";

export type ObjectSchema = Extract<LanguageSchema, { readonly type: "object" }>;
type UnionSchema = Extract<LanguageSchema, { readonly discriminator: string }>;

export type ExprSchema = LanguageSchema | "dynamic" | "null" | "absent";

/** What an expression yields: a schema, whether it may be absent, and its value when it is a constant. */
export type ExprType = { readonly schema: ExprSchema; readonly optional: boolean; readonly literal?: Json };

export const MAX_STRING = 1_048_576;
export const MAX_ITEMS = 65_536;

/** Counters shared by every scope of one template: expression nodes checked, slots needed, and the `$ref`s seen. */
export type Budget = { nodes: number; slots: number; refs: { readonly anchor: string; readonly pointer: string }[] };
export const newBudget = (): Budget => ({ nodes: 0, slots: 0, refs: [] });

export type Binding = { readonly slot: number; readonly type: ExprType };

/** A narrower language for expressions the browser evaluates (plan 029 B3–B4): which operators, and how big. */
export type Restriction = {
  readonly operators: ReadonlySet<string>;
  readonly depth: number;
  readonly nodes: number;
};

/** Names visible to an expression. Immutable: binding a name returns a new scope. */
export type Scope = {
  readonly names: ReadonlyMap<string, Binding>;
  /** Paths known to be present here, from `$has` guards. */
  readonly present: ReadonlySet<string>;
  readonly budget: Budget;
  readonly restrict?: Restriction;
};

export const DYNAMIC: ExprType = { schema: "dynamic", optional: false };

/** A type; a dynamic one is never optional, because it is checked when evaluated. */
export function typeOf(schema: ExprSchema, optional = false, literal?: Json): ExprType {
  if (schema === "dynamic") return DYNAMIC;
  return literal === undefined ? { schema, optional } : { schema, optional, literal };
}

function withBindings(scope: Scope, entries: readonly (readonly [string, ExprType])[]): Scope {
  const names = new Map(scope.names);
  for (const [name, type] of entries) names.set(name, { slot: names.size, type });
  scope.budget.slots = Math.max(scope.budget.slots, names.size);
  return {
    names,
    present: scope.present,
    budget: scope.budget,
    ...(scope.restrict ? { restrict: scope.restrict } : {}),
  };
}

/** The widget body's scope: each root (`params`, `state`, `data`, `context`, `actions`) is a present value of its schema. */
export function rootScope(roots: Readonly<Record<string, LanguageSchema | "dynamic">>, budget = newBudget()): Scope {
  return withBindings(
    { names: new Map(), present: new Set(), budget },
    Object.entries(roots).map(([name, schema]) => [name, typeOf(schema)]),
  );
}

/** A component body's scope: its declared params as bare names, and nothing else (design T9). */
export function componentScope(params: ObjectSchema, budget = newBudget()): Scope {
  return withBindings(
    { names: new Map(), present: new Set(), budget },
    Object.entries(params.properties).map(([name, schema]) => [name, typeOf(schema, !params.required.includes(name))]),
  );
}

/** Every name dynamic: how `evaluate` runs an expression without a manifest. */
export function dynamicScope(names: readonly string[]): Scope {
  return withBindings(
    { names: new Map(), present: new Set(), budget: newBudget() },
    names.map((name) => [name, DYNAMIC]),
  );
}

export function bindName(scope: Scope, name: string, type: ExprType): Scope {
  return withBindings(scope, [[name, type]]);
}

/** A scope in which `paths` (and their parents) are known to be present. */
export function assume(scope: Scope, paths: readonly string[]): Scope {
  if (!paths.length) return scope;
  return { ...scope, present: new Set([...scope.present, ...paths]) };
}

/** The paths a true `test` proves present: a `$has` on a path, alone or under `$and`. */
export function narrowedBy(test: unknown): string[] {
  if (!isRecord(test)) return [];
  const keys = Object.keys(test);
  if (keys.length !== 1) return [];
  const operand = test[keys[0] as string];
  if (keys[0] === "$and") return Array.isArray(operand) ? operand.flatMap(narrowedBy) : [];
  if (keys[0] !== "$has" || !isRecord(operand)) return [];
  const path = Object.keys(operand).length === 1 ? operand.$path : undefined;
  if (typeof path !== "string") return [];
  const segments = path.split(".");
  return segments.map((_, i) => segments.slice(0, i + 1).join("."));
}

const names = /^[a-z][A-Za-z0-9]{0,31}$/;
const forbiddenNames: ReadonlySet<string> = new Set(["constructor", "prototype"]);
const forbiddenSegments: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/** Why `name` cannot be bound in `scope`, or undefined when it can. */
export function nameProblem(name: unknown, scope: Scope): string | undefined {
  if (typeof name !== "string" || !names.test(name) || forbiddenNames.has(name))
    return "a name of 1–32 letters and digits starting with a lowercase letter";
  if (scope.names.has(name)) return "a name that is not already in scope (names may not shadow)";
}

export type PathResult =
  | {
      readonly ok: true;
      readonly slot: number;
      readonly segments: readonly (string | number)[];
      readonly type: ExprType;
    }
  | {
      readonly ok: false;
      readonly kind: "invalid-document" | "unknown-name";
      readonly message: string;
      readonly expected: string;
    };

const index = /^(0|[1-9][0-9]{0,8})$/;

function pathFailure(
  kind: "invalid-document" | "unknown-name",
  message: string,
  expected: string,
): Extract<PathResult, { ok: false }> {
  return { ok: false, kind, message, expected };
}

/** A path into a discriminated union: the tag as its enum, or a property of the variants that have it. */
function unionProperty(
  schema: UnionSchema,
  segment: string,
): { schema: LanguageSchema; optional: boolean } | undefined {
  if (segment === schema.discriminator) {
    const tags = Object.keys(schema.mapping);
    return { schema: { type: "string", maxLength: 128, enum: tags }, optional: false };
  }
  const holders = Object.values(schema.mapping).filter((variant) => Object.hasOwn(variant.properties, segment));
  const first = holders[0]?.properties[segment];
  if (!first) return undefined;
  const same = holders.every((variant) => sameJson(variant.properties[segment], first));
  return same
    ? {
        schema: first,
        optional:
          holders.length < Object.keys(schema.mapping).length || holders.some((v) => !v.required.includes(segment)),
      }
    : undefined;
}

type Step = { readonly schema: ExprSchema; readonly optional: boolean } | Extract<PathResult, { ok: false }>;

/** One path segment into a schema: the member's schema, and whether reading it may find nothing. */
function stepInto(schema: ExprSchema, part: string, parent: string): Step {
  if (schema === "dynamic") return { schema, optional: false };
  if (schema === "null" || schema === "absent") return { schema: "absent", optional: true };
  let step: Step;
  if ("discriminator" in schema) {
    step =
      unionProperty(schema, part) ??
      pathFailure("unknown-name", `No property "${part}" on "${parent}"`, "a property every variant agrees on");
  } else if (schema.type === "object") {
    step = Object.hasOwn(schema.properties, part)
      ? { schema: schema.properties[part] as LanguageSchema, optional: !schema.required.includes(part) }
      : pathFailure(
          "unknown-name",
          `No property "${part}" on "${parent}"`,
          `one of: ${Object.keys(schema.properties).join(", ")}`,
        );
  } else if (schema.type === "array") {
    step = index.test(part)
      ? { schema: schema.items, optional: true }
      : pathFailure("unknown-name", `"${part}" is not an array index`, "a non-negative integer");
  } else step = pathFailure("unknown-name", `"${parent}" has no properties`, "an object or array");
  return "ok" in step ? step : { ...step, optional: step.optional || schema.nullable === true };
}

/** Resolves a dotted path against the scope: its slot, its segments and its type. */
export function resolvePath(scope: Scope, path: string): PathResult {
  const parts = path.split(".");
  for (const part of parts)
    if (part === "" || part.startsWith("$") || forbiddenSegments.has(part))
      return pathFailure(
        "invalid-document",
        `Path "${path}" has an unusable segment "${part}"`,
        'a dotted path of names and non-negative integers, like "data.queue.rows"',
      );
  const rootName = parts[0] as string;
  const root = scope.names.get(rootName);
  if (!root)
    return pathFailure(
      "unknown-name",
      `Unknown name "${rootName}"`,
      scope.names.size
        ? `one of: ${[...scope.names.keys()].join(", ")}`
        : "a name in scope; a component sees only its params",
    );
  const segments: (string | number)[] = [];
  let schema = root.type.schema;
  let optional = root.type.optional && !scope.present.has(rootName);
  let prefix = rootName;
  for (const part of parts.slice(1)) {
    const step = stepInto(schema, part, prefix);
    if ("ok" in step) return step;
    segments.push(index.test(part) ? Number(part) : part);
    prefix += `.${part}`;
    schema = step.schema;
    optional = (optional || step.optional) && !scope.present.has(prefix);
  }
  return { ok: true, slot: root.slot, segments, type: typeOf(schema, optional) };
}

function nullable(schema: LanguageSchema): LanguageSchema {
  return schema.nullable === true ? schema : ({ ...schema, nullable: true } as LanguageSchema);
}

/** The schema that fits both: an enum widens, integer widens to number, anything else disagreeing is dynamic. */
export function joinSchemas(a: ExprSchema, b: ExprSchema): ExprSchema {
  if (a === "absent") return b;
  if (b === "absent") return a;
  if (a === "dynamic" || b === "dynamic") return "dynamic";
  if (a === "null") return b === "null" ? "null" : nullable(b);
  if (b === "null") return nullable(a);
  return sameJson(a, b) ? a : joinLanguage(a, b);
}

function joinLanguage(a: LanguageSchema, b: LanguageSchema): ExprSchema {
  const either = a.nullable === true || b.nullable === true;
  const wrap = (schema: LanguageSchema) => (either ? nullable(schema) : schema);
  if ("discriminator" in a || "discriminator" in b) return "dynamic";
  if (a.type === "string" && b.type === "string") {
    const maxLength = Math.max(a.maxLength, b.maxLength);
    return wrap(
      a.enum && b.enum
        ? { type: "string", maxLength, enum: [...new Set([...a.enum, ...b.enum])] }
        : { type: "string", maxLength },
    );
  }
  if ((a.type === "number" || a.type === "integer") && (b.type === "number" || b.type === "integer"))
    return wrap({ type: a.type === "integer" && b.type === "integer" ? "integer" : "number" });
  if (a.type === "array" && b.type === "array") {
    if (a.maxItems === 0) return b;
    if (b.maxItems === 0) return a;
    const items = joinSchemas(a.items, b.items);
    if (typeof items === "string") return "dynamic";
    return wrap({ type: "array", items, maxItems: Math.max(a.maxItems, b.maxItems) });
  }
  return "dynamic";
}

export function joinTypes(a: ExprType, b: ExprType): ExprType {
  return typeOf(
    joinSchemas(a.schema, b.schema),
    a.optional || b.optional || a.schema === "absent" || b.schema === "absent",
  );
}

/** An array of `members`; an absent member is omitted at evaluation, so it only widens the length bound. */
export function arrayType(members: readonly ExprType[]): ExprType {
  const present = members.filter((member) => member.schema !== "absent");
  let items: ExprSchema = "absent";
  for (const member of present) items = joinSchemas(items, member.schema);
  const literal = members.every((m) => m.literal !== undefined && !m.optional)
    ? members.map((m) => m.literal as Json)
    : undefined;
  if (typeof items === "string" && items !== "absent") return typeOf("dynamic");
  return typeOf(
    { type: "array", items: items === "absent" ? { type: "boolean" } : items, maxItems: present.length },
    false,
    literal,
  );
}

/** An object of `entries`; an absent member is omitted, an optional one is an optional property. */
export function objectType(entries: readonly (readonly [string, ExprType])[]): ExprType {
  const present = entries.filter(([, member]) => member.schema !== "absent");
  if (present.some(([, member]) => typeof member.schema === "string")) return typeOf("dynamic");
  const literal = entries.every(([, m]) => m.literal !== undefined && !m.optional)
    ? Object.fromEntries(entries.map(([key, m]) => [key, m.literal as Json]))
    : undefined;
  return typeOf(
    {
      type: "object",
      properties: Object.fromEntries(present.map(([key, member]) => [key, member.schema as LanguageSchema])),
      required: present.filter(([, member]) => !member.optional).map(([key]) => key),
      additionalProperties: false,
    },
    false,
    literal,
  );
}

/** The type of one JSON constant. */
export function constantType(value: Json): ExprType {
  if (value === null) return typeOf("null", false, null);
  if (typeof value === "string")
    return typeOf({ type: "string", maxLength: [...value].length, enum: [value] }, false, value);
  if (typeof value === "number") return typeOf({ type: Number.isInteger(value) ? "integer" : "number" }, false, value);
  if (typeof value === "boolean") return typeOf({ type: "boolean" }, false, value);
  if (Array.isArray(value)) return arrayType(value.map(constantType));
  return objectType(Object.entries(value).map(([key, member]) => [key, constantType(member)]));
}

export function describe(schema: LanguageSchema): string {
  if ("discriminator" in schema)
    return `an object whose ${schema.discriminator} is one of: ${Object.keys(schema.mapping).join(", ")}`;
  switch (schema.type) {
    case "string":
      return schema.enum ? `one of: ${schema.enum.join(", ")}` : "a string";
    case "number":
      return "a number";
    case "integer":
      return "an integer";
    case "boolean":
      return "a boolean";
    case "array":
      return "an array";
    case "object":
      return "an object";
  }
}

export const PRESENT = "a value that is always present; guard it with $has or give it a default with $coalesce";

function objectShape(from: ObjectSchema, to: ObjectSchema, where: string, ignore?: string): string | undefined {
  const at = (key: string) => (where ? `${where}.${key}` : key);
  for (const key of to.required)
    if (!Object.hasOwn(from.properties, key)) return `property ${at(key)} is required`;
    else if (!from.required.includes(key)) return `property ${at(key)}: ${PRESENT}`;
  for (const [key, schema] of Object.entries(from.properties)) {
    if (key === ignore) continue;
    if (!Object.hasOwn(to.properties, key)) return `property ${at(key)} is not declared`;
    const problem = shape(schema, to.properties[key] as LanguageSchema, at(key));
    if (problem) return problem;
  }
}

function unionShape(from: LanguageSchema, to: UnionSchema, where: string): string | undefined {
  const target = (tag: string) => to.mapping[tag] as ObjectSchema;
  const bad = (what: string) => (where ? `${where}: ${what}` : what);
  if ("discriminator" in from) {
    if (from.discriminator !== to.discriminator) return bad(describe(to));
    for (const [tag, variant] of Object.entries(from.mapping))
      if (!Object.hasOwn(to.mapping, tag)) return bad(describe(to));
      else {
        const problem = objectShape(variant, target(tag), where);
        if (problem) return problem;
      }
    return;
  }
  if (from.type !== "object") return bad(describe(to));
  const tagSchema = Object.hasOwn(from.properties, to.discriminator) ? from.properties[to.discriminator] : undefined;
  if (
    !tagSchema ||
    "discriminator" in tagSchema ||
    tagSchema.type !== "string" ||
    !tagSchema.enum ||
    !from.required.includes(to.discriminator)
  )
    return bad(describe(to));
  for (const tag of tagSchema.enum)
    if (!Object.hasOwn(to.mapping, tag)) return bad(describe(to));
    else {
      const problem = objectShape(from, target(tag), where, to.discriminator);
      if (problem) return problem;
    }
}

/** Shape compatibility of a present, non-literal value (design T13 rules 3–5). */
function shape(from: LanguageSchema, to: LanguageSchema, where: string): string | undefined {
  const bad = (what: string) => (where ? `${where}: ${what}` : what);
  if (from.nullable === true && to.nullable !== true) return bad(`${describe(to)}, which cannot be null`);
  if ("discriminator" in to) return unionShape(from, to, where);
  if ("discriminator" in from) return bad(describe(to));
  switch (to.type) {
    case "string":
      if (from.type !== "string") return bad(describe(to));
      if (to.enum && (!from.enum || from.enum.some((value) => !to.enum?.includes(value)))) return bad(describe(to));
      return;
    case "number":
      return from.type === "number" || from.type === "integer" ? undefined : bad(describe(to));
    case "integer":
      return from.type === "integer" ? undefined : bad(describe(to));
    case "boolean":
      return from.type === "boolean" ? undefined : bad(describe(to));
    case "array":
      return from.type === "array" ? shape(from.items, to.items, `${where}[]`) : bad(describe(to));
    case "object":
      return from.type === "object" ? objectShape(from, to, where) : bad(describe(to));
  }
}

/**
 * Why a value of `type` cannot bind to `target`, or undefined when it can (design T13). A constant is
 * checked with the real schema check; a dynamic value always binds and is checked when evaluated.
 */
export function binds(type: ExprType, target: LanguageSchema, required = true): string | undefined {
  if (type.literal !== undefined) {
    const result = checkValue(target, type.literal);
    return result.ok ? undefined : (result.errors[0]?.expected ?? describe(target));
  }
  const schema = type.schema;
  if (schema === "dynamic") return;
  if (schema === "absent") return required ? PRESENT : undefined;
  if (type.optional && required) return PRESENT;
  if (schema === "null") return target.nullable === true ? undefined : `${describe(target)}, which cannot be null`;
  return shape(schema, target, "");
}
