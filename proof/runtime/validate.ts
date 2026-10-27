import type { PropSchema } from "../catalog/define.ts";
import { colourRoles, fillableRoles, typographyRoles, valueNames } from "../styles/types.ts";
import { assertJson, freeze, isRecord } from "./data.ts";
import { failure, WidgetError } from "./errors.ts";
import type { RenderOptions, UiTree } from "./types.ts";

function reject(message: string, path: string): never {
  throw new WidgetError("invalid-prop", message, path);
}

function closed(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) reject(`Unknown field ${key}`, `${path}/${key}`);
}

export function checkSchema(schema: PropSchema, value: unknown, path: string): void {
  switch (schema.type) {
    case "string":
      if (
        typeof value !== "string" ||
        (schema.maxLength !== undefined && [...value].length > schema.maxLength) ||
        (schema.enum && !schema.enum.includes(value)) ||
        (schema.pattern && !new RegExp(schema.pattern).test(value))
      )
        reject("String does not match its schema", path);
      return;
    case "number":
    case "integer":
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        (schema.type === "integer" && !Number.isInteger(value)) ||
        (schema.minimum !== undefined && value < schema.minimum) ||
        (schema.maximum !== undefined && value > schema.maximum)
      )
        reject("Number is outside its schema", path);
      return;
    case "boolean":
      if (typeof value !== "boolean") reject("Expected boolean", path);
      return;
    case "array":
      if (!Array.isArray(value) || value.length > schema.maxItems) reject("Expected bounded array", path);
      for (const [i, entry] of value.entries()) checkSchema(schema.items, entry, `${path}/${i}`);
      return;
    case "object":
      if (!isRecord(value)) reject("Expected object", path);
      for (const key of schema.required) if (!Object.hasOwn(value, key)) reject(`Missing ${key}`, path);
      for (const [key, entry] of Object.entries(value)) {
        const property = Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
        if (!property) reject(`Unknown property ${key}`, `${path}/${key}`);
        checkSchema(property, entry, `${path}/${key}`);
      }
  }
}

const enums: Readonly<Record<string, readonly string[]>> = {
  direction: ["horizontal", "vertical"],
  align: ["start", "center", "end", "stretch", "baseline"],
  justify: ["start", "center", "end", "between", "around", "evenly"],
  wrap: ["nowrap", "wrap"],
  position: ["static", "sticky"],
  semantics: [
    "section",
    "article",
    "aside",
    "header",
    "footer",
    "nav",
    "list",
    "listItem",
    "terms",
    "term",
    "detail",
    "form",
    "group",
    "figure",
    "status",
    "alert",
  ],
  textAlign: ["start", "center", "end"],
  tone: ["default", "muted", "meta", "accent", "success", "warning", "danger", "info", "foil"],
  textStyle: typographyRoles,
  surface: colourRoles.filter((role) => role.startsWith("surface.")),
};
const declared = (names: readonly string[], value: unknown): boolean =>
  typeof value === "string" && names.includes(value);
function dimension(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (declared(valueNames.space, value) || declared(valueNames.size, value)) return true;
  if (value === "fill" || value === "fit") return true;
  const match = /^(\d+(?:\.\d+)?)(fr|ch|%)$/.exec(value);
  return !!match && Number(match[1]) <= (match[2] === "fr" ? 12 : 100);
}
function checkStyle(key: string, value: unknown, path: string): void {
  if (isRecord(value)) {
    // A responsive value is closed data: `base` plus declared breakpoints, each holding one scalar value.
    if (!Object.hasOwn(value, "base")) reject(`Responsive ${key} needs a base value`, path);
    for (const [breakpoint, entry] of Object.entries(value)) {
      if (breakpoint !== "base" && !declared(valueNames.breakpoint, breakpoint))
        reject(`Unknown breakpoint ${breakpoint}`, `${path}/${breakpoint}`);
      if (isRecord(entry)) reject("Responsive value must not nest", `${path}/${breakpoint}`);
      checkStyle(key, entry, `${path}/${breakpoint}`);
    }
    return;
  }
  let valid = false;
  if (/^(padding|margin|gap|insetTop|insetBottom)/.test(key)) valid = declared(valueNames.space, value);
  else if (Object.hasOwn(enums, key)) valid = declared(enums[key] ?? [], value);
  else if (["width", "height", "minWidth", "maxWidth"].includes(key)) valid = dimension(value);
  else if (["grow", "shrink", "basis"].includes(key))
    valid = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  else if (key === "fill") valid = declared(fillableRoles, value);
  else if (key === "radius") valid = value === "full" || declared(valueNames.radius, value);
  else if (key === "columns" || key === "rows")
    valid = Array.isArray(value) && value.length > 0 && value.length <= 12 && value.every(dimension);
  else if (key === "area")
    valid =
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 12 &&
      value.every(
        (row) =>
          typeof row === "string" &&
          /^(?:[a-zA-Z][a-zA-Z0-9_-]*|\.)(?: (?:[a-zA-Z][a-zA-Z0-9_-]*|\.)){0,11}$/.test(row) &&
          row.length <= 256,
      );
  if (!valid) reject(`Invalid style value for ${key}`, path);
}

export function limits(options: RenderOptions): { nodes: number; depth: number; bytes: number } {
  const result = { nodes: 5000, depth: 64, bytes: 1024 * 1024, ...options.limits };
  for (const [key, value] of Object.entries(result))
    if (!Number.isSafeInteger(value) || value < 1) reject("Limit must be a positive integer", `limits/${key}`);
  return result;
}

function checkIntent(
  value: unknown,
  carries: "none" | "string" | "boolean",
  options: RenderOptions,
  path: string,
): void {
  if (!isRecord(value)) reject("Expected one intent", path);
  if (value.type === "action") {
    closed(value, ["type", "name", "args"], path);
    if (typeof value.name !== "string" || !options.actions.includes(value.name))
      throw new WidgetError("undeclared-action", "Action is not in the manifest", path);
    if (!isRecord(value.args)) reject("Action args must be an object", path);
  } else if (value.type === "setState") {
    closed(value, ["type", "key", "value"], path);
    const schema =
      typeof value.key === "string" && Object.hasOwn(options.state.properties, value.key)
        ? options.state.properties[value.key]
        : undefined;
    if (!schema) reject("State key is not declared", path);
    if (Object.hasOwn(value, "value")) checkSchema(schema, value.value, `${path}/value`);
    else if (carries === "none" || schema.type !== carries) reject("Event value does not match the state schema", path);
  } else reject("Unknown intent type", path);
}

function checkTree(value: unknown, options: RenderOptions): UiTree {
  const budget = limits(options);
  assertJson(value, "tree", new Set(), budget.depth * 2 + 128);
  const json = JSON.stringify(value);
  let bytes = json.length;
  for (const character of json.match(/[\u0080-\u{10ffff}]/gu) ?? []) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7ff ? 1 : 2;
  }
  if (bytes > budget.bytes) throw new WidgetError("limit-exceeded", `Tree exceeds ${budget.bytes} bytes`, "tree");
  if (!isRecord(value)) reject("Expected tree", "tree");
  closed(value, ["format", "catalogId", "surfaceId", "revision", "root"], "tree");
  if (
    value.format !== "liveframe/1" ||
    value.catalogId !== options.catalog.catalogId ||
    typeof value.surfaceId !== "string" ||
    !value.surfaceId.length ||
    value.surfaceId.length > 128 ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    reject("Invalid tree metadata", "tree");
  const catalog = new Map(options.catalog.definitions.map((definition) => [definition.kind, definition]));
  const ids = new Set<string>();
  let count = 0;
  function walk(node: unknown, parent: string | null, depth: number, parentSemantics?: string): void {
    if (++count > budget.nodes || depth > budget.depth)
      throw new WidgetError("limit-exceeded", "Tree node or depth limit exceeded", parent ?? "root");
    if (!isRecord(node)) reject("Expected node", parent ?? "root");
    const path = typeof node.id === "string" ? node.id : (parent ?? "root");
    closed(node, ["id", "kind", "variant", "props", "style", "events", "children"], path);
    if (
      typeof node.id !== "string" ||
      !/^root(?:\/(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+)*$/.test(node.id) ||
      (parent === null ? node.id !== "root" : !node.id.startsWith(`${parent}/`))
    )
      reject("Expected a key path under its parent", path);
    if (ids.has(node.id)) throw new WidgetError("duplicate-key", "Duplicate node id", path);
    ids.add(node.id);
    const definition = typeof node.kind === "string" ? catalog.get(node.kind) : undefined;
    if (!definition) throw new WidgetError("unknown-component", "Kind is not in the catalog", path);
    if (node.variant !== undefined && (typeof node.variant !== "string" || !definition.variants.includes(node.variant)))
      reject("Unknown variant", path);
    checkSchema(definition.props, node.props, `${path}/props`);
    if (node.style !== undefined) {
      if (!isRecord(node.style)) reject("Expected style object", path);
      for (const [key, entry] of Object.entries(node.style)) {
        if (!(definition.styleProps as readonly string[]).includes(key)) reject(`Style ${key} is not declared`, path);
        checkStyle(key, entry, `${path}/style/${key}`);
      }
    }
    if (node.events !== undefined) {
      if (!isRecord(node.events)) reject("Expected events object", path);
      for (const [key, entry] of Object.entries(node.events)) {
        const event = Object.hasOwn(definition.events, key) ? definition.events[key] : undefined;
        if (!event) throw new WidgetError("undeclared-event", `Event ${key} is not declared`, `${path}/events/${key}`);
        checkIntent(entry, event.carries, options, `${path}/events/${key}`);
      }
    }
    const children = node.children === undefined ? [] : node.children;
    if (!Array.isArray(children)) throw new WidgetError("invalid-children", "Expected children array", path);
    const role = isRecord(node.props) && typeof node.props.semantics === "string" ? node.props.semantics : undefined;
    if ((role === "term" || role === "detail") && parentSemantics !== "terms")
      throw new WidgetError("invalid-children", "A term or detail belongs inside terms", path);
    if (role === "terms")
      for (const child of children) {
        const childRole =
          isRecord(child) && isRecord(child.props) && typeof child.props.semantics === "string"
            ? child.props.semantics
            : undefined;
        if (!isRecord(child) || (childRole !== "term" && childRole !== "detail"))
          throw new WidgetError("invalid-children", "Terms holds only term and detail children", path);
      }
    if (definition.children === "none" && children.length)
      throw new WidgetError("invalid-children", "This primitive takes no children", path);
    if (typeof definition.children !== "string") {
      for (const child of children)
        if (!isRecord(child) || !definition.children.some((rule) => rule.kind === child.kind))
          throw new WidgetError("invalid-children", "Child kind is not allowed", path);
      for (const rule of definition.children) {
        const total = children.filter((child) => isRecord(child) && child.kind === rule.kind).length;
        if (total < rule.min || total > rule.max)
          throw new WidgetError("invalid-children", `Expected ${rule.min}–${rule.max} ${rule.kind} children`, path);
      }
    }
    for (const child of children) walk(child, node.id, depth + 1, role);
  }
  walk(value.root, null, 1);
  return freeze(value) as unknown as UiTree;
}

export function validate(value: unknown, options: RenderOptions): UiTree | WidgetError {
  try {
    return checkTree(value, options);
  } catch (error) {
    return failure(error);
  }
}
