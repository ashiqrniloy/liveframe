import type { LiveframeError, Result } from "../errors.ts";
import {
  arr,
  bool,
  checkValue,
  type Infer,
  int,
  isLanguageSchema,
  type LanguageSchema,
  literal,
  obj,
  record,
  str,
} from "../schema.ts";
import { at, documentChecks, isRecord, shell } from "./capabilities.ts";
import { styleProps } from "./fixed.ts";
import { type Vocabulary, validateVocabulary, vocabularySchema } from "./vocabulary.ts";

const token = str({ maxLength: 64, pattern: "^[a-z][A-Za-z0-9-]*$" });
const description = str({ maxLength: 500 });
const eventName = str({ maxLength: 64, pattern: "^on[A-Z][A-Za-z]*$" });
const event = obj({ carries: str({ maxLength: 7, enum: ["none", "string", "boolean"] }), description });
const child = obj({ kind: token, min: int({ minimum: 0 }), max: int({ minimum: 0 }) });
const childRules = arr(child, { maxItems: 256 });
const definitionFields = obj(
  {
    kind: token,
    description,
    variants: arr(token, { maxItems: 256 }),
    defaultVariant: token,
    slots: arr(token, { maxItems: 256 }),
    styleProps: arr(str({ maxLength: 64, enum: styleProps }), { maxItems: styleProps.length }),
    a11y: obj({ role: str({ maxLength: 32, pattern: "^[a-z]+$" }) }, { name: str({ maxLength: 64 }) }),
    props: bool(),
    children: bool(),
    events: bool(),
  },
  { deprecated: description },
);
const catalogFields = obj({
  format: str({ maxLength: 20, enum: ["liveframe-catalog/1"] }),
  catalogId: str({ maxLength: 128, pattern: "^[a-z][a-z0-9.-]*@[1-9][0-9]*$" }),
  description,
  vocabulary: bool(),
  definitions: arr(bool(), { maxItems: 256 }),
});

export type Definition = Omit<Infer<typeof definitionFields>, "props" | "children" | "events"> & {
  readonly props: Extract<LanguageSchema, { readonly type: "object" }>;
  readonly children: "none" | "any" | Infer<typeof childRules>;
  readonly events: Readonly<Record<string, Infer<typeof event>>>;
};
export type Catalog = Omit<Infer<typeof catalogFields>, "vocabulary" | "definitions"> & {
  readonly vocabulary: Vocabulary;
  readonly definitions: readonly Definition[];
};

/** Keeps the literal contract for SDK generation; validateCatalog checks installed data. */
export function defineComponent<const D extends Definition>(definition: D): D {
  return definition;
}

function unique<S>(schema: S) {
  return { ...schema, uniqueItems: true };
}
export const definitionSchema = {
  ...definitionFields,
  properties: {
    ...definitionFields.properties,
    props: { $ref: "#/$defs/objectSchema" },
    children: { oneOf: [str({ maxLength: 4, enum: ["none", "any"] }), childRules] },
    events: { ...record(eventName.pattern, event, 256), propertyNames: eventName },
    variants: unique(definitionFields.properties.variants),
    slots: { ...unique(definitionFields.properties.slots), contains: literal("root") },
    styleProps: unique(definitionFields.properties.styleProps),
  },
} as const;
export const catalogSchema = {
  ...catalogFields,
  properties: {
    ...catalogFields.properties,
    vocabulary: { $ref: "#/$defs/vocabulary" },
    definitions: { type: "array", items: definitionSchema, maxItems: 256 },
  },
  $defs: { vocabulary: vocabularySchema },
} as const;

type Checks = ReturnType<typeof documentChecks>;
type Change = (major: boolean, reason: string) => void;

function checkUniqueNames(list: unknown, pointer: string, c: Checks): void {
  if (!Array.isArray(list)) return;
  const seen = new Set<unknown>();
  for (const [j, name] of list.entries()) {
    if (c.errors.length >= 20) break;
    if (seen.has(name)) c.reject(`${pointer}/${j}`, "Names must be unique");
    seen.add(name);
  }
}

function checkEvents(events: unknown, pointer: string, c: Checks): void {
  if (!isRecord(events)) {
    c.reject(`${pointer}/events`, "Expected an event map");
    return;
  }
  if (Object.keys(events).length > 256) c.reject(`${pointer}/events`, "Expected at most 256 events");
  for (const [key, value] of Object.entries(events)) {
    if (c.errors.length >= 20) break;
    const eventPointer = at(`${pointer}/events`, key);
    if (!checkValue(eventName, key).ok) c.reject(eventPointer, "Expected an onCapitalised event name");
    c.collect(checkValue(event, value), eventPointer);
  }
}

/** One definition's structure, before any cross-reference is checked. */
function checkDefinition(definition: unknown, pointer: string, c: Checks): void {
  if (!isRecord(definition)) {
    c.reject(pointer, "Expected a definition object");
    return;
  }
  c.collect(checkValue(definitionFields, shell(definition, ["props", "events", "children"])), pointer);
  if (!isLanguageSchema(definition.props) || definition.props.type !== "object")
    c.reject(`${pointer}/props`, "Expected a closed object schema in the language");
  if (definition.children !== "none" && definition.children !== "any")
    c.collect(checkValue(childRules, definition.children), `${pointer}/children`);
  checkEvents(definition.events, pointer, c);
  for (const key of ["variants", "slots", "styleProps"] as const)
    checkUniqueNames(definition[key], `${pointer}/${key}`, c);
  if (Array.isArray(definition.slots) && !definition.slots.includes("root"))
    c.reject(`${pointer}/slots`, "Slots must include root");
}

function checkChildren(
  children: readonly Infer<typeof childRules>[number][],
  pointer: string,
  kinds: Set<string>,
  c: Checks,
): void {
  const childKinds = new Set<string>();
  for (const [j, rule] of children.entries()) {
    if (!kinds.has(rule.kind))
      c.reject(`${pointer}/children/${j}/kind`, `Undeclared kind: ${rule.kind}`, "unknown-name");
    if (childKinds.has(rule.kind)) c.reject(`${pointer}/children/${j}/kind`, "Duplicate child kind");
    childKinds.add(rule.kind);
    if (rule.min > rule.max) c.reject(`${pointer}/children/${j}/max`, "Maximum must be at least minimum");
  }
}

/** References between definitions: unique kinds, declared variants, a11y props and child rules. */
function checkDefinitionReferences(value: Catalog, c: Checks): void {
  const kinds = new Set(value.definitions.map((d) => d.kind));
  const seen = new Set<string>();
  for (const [i, d] of value.definitions.entries()) {
    const pointer = `/definitions/${i}`;
    if (seen.has(d.kind)) c.reject(`${pointer}/kind`, `Duplicate kind: ${d.kind}`);
    seen.add(d.kind);
    if (!d.variants.includes(d.defaultVariant))
      c.reject(`${pointer}/defaultVariant`, "Undeclared variant", "unknown-name");
    if (
      d.a11y.name !== undefined &&
      (!Object.hasOwn(d.props.properties, d.a11y.name) || d.props.properties[d.a11y.name]?.type !== "string")
    )
      c.reject(`${pointer}/a11y/name`, "Accessible name must name a string prop", "unknown-name");
    if (Array.isArray(d.children)) checkChildren(d.children, pointer, kinds, c);
  }
}

/** Validates structure first, then references; returns at most 20 pointed errors. */
export function validateCatalog(doc: unknown): Result<Catalog> {
  const c = documentChecks();
  if (!isRecord(doc))
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: "Expected a catalog object" }] };
  const input = shell(doc, ["vocabulary"]);
  if (Array.isArray(doc.definitions)) input.definitions = doc.definitions.map(() => true);
  c.collect(checkValue(catalogFields, input), "");
  c.collect(validateVocabulary(doc.vocabulary), "/vocabulary");
  if (!Array.isArray(doc.definitions) || doc.definitions.length > 256) {
    c.reject("/definitions", "Expected at most 256 definitions");
    return { ok: false, errors: c.errors };
  }
  for (const [i, definition] of doc.definitions.entries()) {
    if (c.errors.length >= 20) break;
    checkDefinition(definition, `/definitions/${i}`, c);
  }
  if (c.errors.length) return { ok: false, errors: c.errors };
  const value = doc as Catalog;
  checkDefinitionReferences(value, c);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value };
}

function compareNames(before: readonly string[], after: readonly string[], path: string, change: Change): void {
  for (const name of before) if (!after.includes(name)) change(true, `${path} ${name} removed`);
  for (const name of after) if (!before.includes(name)) change(false, `${path} ${name} added`);
}

function compareObjectSchema(
  before: Extract<LanguageSchema, { readonly type: "object" }>,
  after: Extract<LanguageSchema, { readonly type: "object" }>,
  path: string,
  change: Change,
): void {
  compareNames(Object.keys(before.properties), Object.keys(after.properties), `${path} prop`, change);
  for (const key of after.required) if (!before.required.includes(key)) change(true, `${path}.${key} made required`);
  for (const key of before.required) if (!after.required.includes(key)) change(false, `${path}.${key} made optional`);
  for (const [key, property] of Object.entries(before.properties))
    if (Object.hasOwn(after.properties, key))
      compareSchemas(property, after.properties[key] as LanguageSchema, `${path}.${key}`, change);
}

function compareStringSchema(
  before: Extract<LanguageSchema, { readonly type: "string" }>,
  after: Extract<LanguageSchema, { readonly type: "string" }>,
  path: string,
  change: Change,
): void {
  if (before.maxLength !== after.maxLength) change(after.maxLength < before.maxLength, `${path} maxLength changed`);
  if (before.pattern !== after.pattern) change(after.pattern !== undefined, `${path} pattern changed`);
  if (before.enum && after.enum) compareNames(before.enum, after.enum, `${path} enum value`, change);
  else if (before.enum || after.enum) change(after.enum !== undefined, `${path} enum changed`);
}

function compareArraySchema(
  before: Extract<LanguageSchema, { readonly type: "array" }>,
  after: Extract<LanguageSchema, { readonly type: "array" }>,
  path: string,
  change: Change,
): void {
  if (before.maxItems !== after.maxItems) change(after.maxItems < before.maxItems, `${path} maxItems changed`);
  compareSchemas(before.items, after.items, `${path} items`, change);
}

type NumericSchema = Extract<LanguageSchema, { readonly type: "number" | "integer" }>;

function compareNumericSchema(before: NumericSchema, after: NumericSchema, path: string, change: Change): void {
  for (const key of ["minimum", "maximum"] as const)
    if (before[key] !== after[key])
      change(
        key === "minimum"
          ? (after[key] ?? -Infinity) > (before[key] ?? -Infinity)
          : (after[key] ?? Infinity) < (before[key] ?? Infinity),
        `${path} ${key} changed`,
      );
}

/** One language schema against another: a narrowing is major, a widening is minor. */
function compareSchemas(before: LanguageSchema, after: LanguageSchema, path: string, change: Change): void {
  const numeric = (type: string) => type === "number" || type === "integer";
  if (before.type !== after.type) {
    change(!(before.type === "integer" && after.type === "number"), `${path} type changed`);
    if (!(numeric(before.type) && numeric(after.type))) return;
  }
  if (before.type === "object" && after.type === "object") compareObjectSchema(before, after, path, change);
  else if (before.type === "string" && after.type === "string") compareStringSchema(before, after, path, change);
  else if (before.type === "array" && after.type === "array") compareArraySchema(before, after, path, change);
  else if (numeric(before.type) && numeric(after.type))
    compareNumericSchema(before as NumericSchema, after as NumericSchema, path, change);
}

type ChildRule = Infer<typeof childRules>[number];

function compareChildren(
  before: Definition["children"],
  after: Definition["children"],
  path: string,
  change: Change,
): void {
  if (typeof before === "string" || typeof after === "string") {
    if (before === after) return;
    const major =
      before === "any" ||
      (after === "none" && Array.isArray(before) && before.some((rule) => rule.max > 0)) ||
      (before === "none" && Array.isArray(after) && after.some((rule) => rule.min > 0));
    change(major, `${path} children changed`);
    return;
  }
  const rules = new Map(after.map((rule) => [rule.kind, rule]));
  for (const rule of before) {
    const updated = rules.get(rule.kind);
    if (!updated) change(true, `${path} child ${rule.kind} removed`);
    else if (rule.min !== updated.min || rule.max !== updated.max)
      change(updated.min > rule.min || updated.max < rule.max, `${path} child ${rule.kind} bounds changed`);
  }
  for (const rule of after)
    if (!before.some((old: ChildRule) => old.kind === rule.kind))
      change(rule.min > 0, `${path} child ${rule.kind} added`);
}

/** One definition present in both catalogs. */
function compareDefinition(before: Definition, after: Definition, change: Change): void {
  const path = `kind ${before.kind}`;
  compareSchemas(before.props, after.props, path, change);
  for (const key of ["variants", "slots", "styleProps"] as const)
    compareNames(before[key], after[key], `${path} ${key}`, change);
  compareNames(Object.keys(before.events), Object.keys(after.events), `${path} event`, change);
  for (const [key, event] of Object.entries(before.events))
    if (Object.hasOwn(after.events, key) && event.carries !== after.events[key]?.carries)
      change(true, `${path} event ${key} carries changed`);
  if (before.defaultVariant !== after.defaultVariant) change(true, `${path} defaultVariant changed`);
  if (before.a11y.role !== after.a11y.role || before.a11y.name !== after.a11y.name)
    change(true, `${path} a11y changed`);
  compareChildren(before.children, after.children, path, change);
}

function compareVocabulary(before: Vocabulary, after: Vocabulary, change: Change): void {
  for (const key of Object.keys(before) as (keyof Vocabulary)[]) {
    if (key === "tones") {
      compareNames(Object.keys(before.tones), Object.keys(after.tones), "vocabulary tone", change);
      for (const [tone, role] of Object.entries(before.tones))
        if (Object.hasOwn(after.tones, tone) && role !== after.tones[tone])
          change(true, `vocabulary tone ${tone} mapping changed`);
    } else if (key === "surfaceTypography") {
      if (before[key] !== after[key]) change(true, `vocabulary ${key} mapping changed`);
    } else compareNames(before[key], after[key], `vocabulary ${key}`, change);
  }
}

/** Inputs must be validated catalogs. A major result requires a new catalogId major. */
export function classifyCatalogChange(
  prev: Catalog,
  next: Catalog,
): { level: "major" | "minor" | "none"; reasons: string[] } {
  let level: "major" | "minor" | "none" = "none";
  const reasons: string[] = [];
  const change: Change = (major, reason) => {
    if (major) level = "major";
    else if (level === "none") level = "minor";
    reasons.push(reason);
  };
  const nextKinds = new Map(next.definitions.map((d) => [d.kind, d]));
  compareNames(
    prev.definitions.map((d) => d.kind),
    next.definitions.map((d) => d.kind),
    "kind",
    change,
  );
  for (const before of prev.definitions) {
    const after = nextKinds.get(before.kind);
    if (after) compareDefinition(before, after, change);
  }
  compareVocabulary(prev.vocabulary, next.vocabulary, change);
  return { level, reasons };
}
