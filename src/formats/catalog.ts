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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function at(pointer: string, key: string | number) {
  return `${pointer}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
}
// Replace only present complex fields so the language interpreter still checks required/unknown fields.
function shell(input: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, fields.includes(key) ? true : value]));
}

/** Validates structure first, then references; returns at most 20 pointed errors. */
export function validateCatalog(doc: unknown): Result<Catalog> {
  const errors: LiveframeError[] = [];
  function reject(pointer: string, message: string, kind: "invalid-document" | "unknown-name" = "invalid-document") {
    if (errors.length < 20) errors.push({ kind, pointer, message });
  }
  function collect(result: Result<unknown>, pointer: string) {
    if (!result.ok)
      for (const error of result.errors)
        if (errors.length < 20) errors.push({ ...error, pointer: pointer + error.pointer });
  }
  if (!isRecord(doc))
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: "Expected a catalog object" }] };
  const input = shell(doc, ["vocabulary"]);
  if (Array.isArray(doc.definitions)) input.definitions = doc.definitions.map(() => true);
  collect(checkValue(catalogFields, input), "");
  collect(validateVocabulary(doc.vocabulary), "/vocabulary");
  if (!Array.isArray(doc.definitions) || doc.definitions.length > 256) {
    reject("/definitions", "Expected at most 256 definitions");
    return { ok: false, errors };
  }
  for (const [i, definition] of doc.definitions.entries()) {
    if (errors.length >= 20) break;
    const pointer = `/definitions/${i}`;
    if (!isRecord(definition)) {
      reject(pointer, "Expected a definition object");
      continue;
    }
    collect(checkValue(definitionFields, shell(definition, ["props", "events", "children"])), pointer);
    if (!isLanguageSchema(definition.props) || definition.props.type !== "object")
      reject(`${pointer}/props`, "Expected a closed object schema in the language");
    if (definition.children !== "none" && definition.children !== "any")
      collect(checkValue(childRules, definition.children), `${pointer}/children`);
    if (!isRecord(definition.events)) reject(`${pointer}/events`, "Expected an event map");
    else {
      if (Object.keys(definition.events).length > 256) reject(`${pointer}/events`, "Expected at most 256 events");
      for (const [key, value] of Object.entries(definition.events)) {
        if (errors.length >= 20) break;
        const eventPointer = at(`${pointer}/events`, key);
        if (!checkValue(eventName, key).ok) reject(eventPointer, "Expected an onCapitalised event name");
        collect(checkValue(event, value), eventPointer);
      }
    }
    for (const key of ["variants", "slots", "styleProps"] as const) {
      const list = definition[key];
      if (Array.isArray(list)) {
        const seen = new Set<unknown>();
        for (const [j, name] of list.entries()) {
          if (errors.length >= 20) break;
          if (seen.has(name)) reject(`${pointer}/${key}/${j}`, "Names must be unique");
          seen.add(name);
        }
      }
    }
    if (Array.isArray(definition.slots) && !definition.slots.includes("root"))
      reject(`${pointer}/slots`, "Slots must include root");
  }
  if (errors.length) return { ok: false, errors };
  const value = doc as Catalog;
  const kinds = new Set(value.definitions.map((d) => d.kind));
  const seen = new Set<string>();
  for (const [i, d] of value.definitions.entries()) {
    const pointer = `/definitions/${i}`;
    if (seen.has(d.kind)) reject(`${pointer}/kind`, `Duplicate kind: ${d.kind}`);
    seen.add(d.kind);
    if (!d.variants.includes(d.defaultVariant))
      reject(`${pointer}/defaultVariant`, "Undeclared variant", "unknown-name");
    if (
      d.a11y.name !== undefined &&
      (!Object.hasOwn(d.props.properties, d.a11y.name) || d.props.properties[d.a11y.name]?.type !== "string")
    )
      reject(`${pointer}/a11y/name`, "Accessible name must name a string prop", "unknown-name");
    if (Array.isArray(d.children)) {
      const childKinds = new Set<string>();
      for (const [j, rule] of d.children.entries()) {
        if (!kinds.has(rule.kind))
          reject(`${pointer}/children/${j}/kind`, `Undeclared kind: ${rule.kind}`, "unknown-name");
        if (childKinds.has(rule.kind)) reject(`${pointer}/children/${j}/kind`, "Duplicate child kind");
        childKinds.add(rule.kind);
        if (rule.min > rule.max) reject(`${pointer}/children/${j}/max`, "Maximum must be at least minimum");
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Inputs must be validated catalogs. A major result requires a new catalogId major. */
export function classifyCatalogChange(
  prev: Catalog,
  next: Catalog,
): { level: "major" | "minor" | "none"; reasons: string[] } {
  let level: "major" | "minor" | "none" = "none";
  const reasons: string[] = [];
  function change(major: boolean, reason: string) {
    if (major) level = "major";
    else if (level === "none") level = "minor";
    reasons.push(reason);
  }
  function names(before: readonly string[], after: readonly string[], path: string) {
    for (const name of before) if (!after.includes(name)) change(true, `${path} ${name} removed`);
    for (const name of after) if (!before.includes(name)) change(false, `${path} ${name} added`);
  }
  function schema(before: LanguageSchema, after: LanguageSchema, path: string) {
    if (before.type !== after.type) {
      change(!(before.type === "integer" && after.type === "number"), `${path} type changed`);
      if (!(["integer", "number"].includes(before.type) && ["integer", "number"].includes(after.type))) return;
    }
    if (before.type === "object" && after.type === "object") {
      names(Object.keys(before.properties), Object.keys(after.properties), `${path} prop`);
      for (const key of after.required)
        if (!before.required.includes(key)) change(true, `${path}.${key} made required`);
      for (const key of before.required)
        if (!after.required.includes(key)) change(false, `${path}.${key} made optional`);
      for (const [key, property] of Object.entries(before.properties))
        if (Object.hasOwn(after.properties, key))
          schema(property, after.properties[key] as LanguageSchema, `${path}.${key}`);
    } else if (before.type === "string" && after.type === "string") {
      if (before.maxLength !== after.maxLength) change(after.maxLength < before.maxLength, `${path} maxLength changed`);
      if (before.pattern !== after.pattern) change(after.pattern !== undefined, `${path} pattern changed`);
      if (before.enum && after.enum) names(before.enum, after.enum, `${path} enum value`);
      else if (before.enum || after.enum) change(after.enum !== undefined, `${path} enum changed`);
    } else if (before.type === "array" && after.type === "array") {
      if (before.maxItems !== after.maxItems) change(after.maxItems < before.maxItems, `${path} maxItems changed`);
      schema(before.items, after.items, `${path} items`);
    } else if (
      (before.type === "number" || before.type === "integer") &&
      (after.type === "number" || after.type === "integer")
    ) {
      for (const key of ["minimum", "maximum"] as const)
        if (before[key] !== after[key])
          change(
            key === "minimum"
              ? (after[key] ?? -Infinity) > (before[key] ?? -Infinity)
              : (after[key] ?? Infinity) < (before[key] ?? Infinity),
            `${path} ${key} changed`,
          );
    }
  }
  const nextKinds = new Map(next.definitions.map((d) => [d.kind, d]));
  names(
    prev.definitions.map((d) => d.kind),
    next.definitions.map((d) => d.kind),
    "kind",
  );
  for (const before of prev.definitions) {
    const after = nextKinds.get(before.kind);
    if (!after) continue;
    const path = `kind ${before.kind}`;
    schema(before.props, after.props, path);
    for (const key of ["variants", "slots", "styleProps"] as const) names(before[key], after[key], `${path} ${key}`);
    names(Object.keys(before.events), Object.keys(after.events), `${path} event`);
    for (const [key, event] of Object.entries(before.events))
      if (Object.hasOwn(after.events, key) && event.carries !== after.events[key]?.carries)
        change(true, `${path} event ${key} carries changed`);
    if (before.defaultVariant !== after.defaultVariant) change(true, `${path} defaultVariant changed`);
    if (before.a11y.role !== after.a11y.role || before.a11y.name !== after.a11y.name)
      change(true, `${path} a11y changed`);
    if (typeof before.children === "string" || typeof after.children === "string") {
      if (before.children !== after.children) {
        const major =
          before.children === "any" ||
          (after.children === "none" &&
            Array.isArray(before.children) &&
            before.children.some((rule) => rule.max > 0)) ||
          (before.children === "none" && Array.isArray(after.children) && after.children.some((rule) => rule.min > 0));
        change(major, `${path} children changed`);
      }
    } else {
      const rules = new Map(after.children.map((rule) => [rule.kind, rule]));
      for (const rule of before.children) {
        const updated = rules.get(rule.kind);
        if (!updated) change(true, `${path} child ${rule.kind} removed`);
        else if (rule.min !== updated.min || rule.max !== updated.max)
          change(updated.min > rule.min || updated.max < rule.max, `${path} child ${rule.kind} bounds changed`);
      }
      for (const rule of after.children)
        if (!before.children.some((old) => old.kind === rule.kind))
          change(rule.min > 0, `${path} child ${rule.kind} added`);
    }
  }
  for (const key of Object.keys(prev.vocabulary) as (keyof Vocabulary)[]) {
    if (key === "tones") {
      names(Object.keys(prev.vocabulary.tones), Object.keys(next.vocabulary.tones), "vocabulary tone");
      for (const [tone, role] of Object.entries(prev.vocabulary.tones))
        if (Object.hasOwn(next.vocabulary.tones, tone) && role !== next.vocabulary.tones[tone])
          change(true, `vocabulary tone ${tone} mapping changed`);
    } else if (key === "surfaceTypography") {
      if (prev.vocabulary[key] !== next.vocabulary[key]) change(true, `vocabulary ${key} mapping changed`);
    } else names(prev.vocabulary[key], next.vocabulary[key], `vocabulary ${key}`);
  }
  return { level, reasons };
}
