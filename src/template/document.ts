// The template widget format and its install-time validation (plan 028, design T1–T4, T9, T10, T14–T16).
// A template is element JSON whose values may be expressions, plus the directives `$let`, `$if`,
// `$each` and `$use`. `validateTemplate` is the only place that reads a template document: it checks
// structure, bounds, the component graph and every expression against the manifest's schemas, so
// `renderTemplate` (Task 4) can rely on a template that passed.
import type { LiveframeError, Result } from "../errors.ts";
import { at, type Capabilities, documentChecks, isRecord, type ObjectSchema } from "../formats/capabilities.ts";
import type { Catalog, Definition } from "../formats/catalog.ts";
import { checkFormat } from "../formats/check.ts";
import { validateJson } from "../formats/json.ts";
import { type Manifest, NO_LOCAL } from "../formats/manifest.ts";
import type { Json } from "../formats/tree.ts";
import { utf8Length } from "../internal.ts";
import type { LanguageSchema } from "../schema.ts";
import { type ElementReject, mergeSections, rejectFragmentFields } from "../sdk/element-node.ts";
import { actionsSchema } from "../validate/actions.ts";
import { type BindingCheck, compileBindings, EMBED } from "../validate/bindings.ts";
import { dataSchema, type KindFacts, kindFacts, propTarget } from "../validate/compile.ts";
import { type Carries, carriesFits, objectFits } from "../validate/intent.ts";
import { type CompiledStructure, compileStructure } from "../validate/structure.ts";
import { compileStyles } from "../validate/style.ts";
import { analyzeExpression, analyzeOperand, EXPR_LIMITS, itemsOf } from "./expr.ts";
import { TEMPLATE_BYTES, templateSchema } from "./schema.ts";
import {
  assume,
  bindName,
  binds,
  componentScope,
  DYNAMIC,
  type ExprType,
  nameProblem,
  narrowedBy,
  newBudget,
  rootScope,
  type Scope,
  typeOf,
} from "./scope.ts";

/** Any JSON value, read as an expression (design T5): scalars are literals, `$`-objects are operators. */
export type Expr = Json;

/** An intent whose `value` and `args` members are expressions (design T14). */
export type TemplateIntent =
  | { readonly type: "setState"; readonly key: string; readonly value?: Expr }
  | {
      readonly type: "action";
      readonly name: string;
      readonly args: Readonly<Record<string, Expr>>;
      readonly bind?: string;
      readonly bindAll?: true;
      /** The key the host reports this action's status under (plan 029 A5); may be an expression. */
      readonly resultKey?: Expr;
    };

/** An element-JSON node whose values may be expressions, plus the directives (design T2, T3). */
export type TemplateNode = {
  readonly kind?: string;
  readonly key?: Expr;
  readonly variant?: string;
  readonly $anchor?: string;
  readonly props?: Readonly<Record<string, Expr>>;
  readonly style?: Readonly<Record<string, Expr>>;
  readonly events?: Readonly<Record<string, TemplateIntent>>;
  readonly children?: readonly TemplateNode[];
  readonly $let?: readonly { readonly as: string; readonly value: Expr }[];
  readonly $if?: Expr;
  readonly $each?: { readonly in: Expr; readonly as: string; readonly index?: string; readonly key?: Expr };
  readonly $use?: string;
  readonly with?: Readonly<Record<string, Expr>>;
};

export type TemplateComponent = { readonly params: ObjectSchema; readonly root: TemplateNode };

export type Template = {
  readonly format: "liveframe-template/1";
  readonly components?: Readonly<Record<string, TemplateComponent>>;
  readonly root: TemplateNode;
};

/** Install bounds that are not expression bounds (design T10); expression bounds live in `EXPR_LIMITS`. */
export const TEMPLATE_LIMITS = {
  bytes: TEMPLATE_BYTES,
  nodes: 10_000,
  components: 64,
  useDepth: 16,
  nesting: 128,
} as const;

type Context = {
  readonly catalog: Catalog;
  readonly capabilities: Capabilities;
  readonly manifest: Manifest;
};

type Kind = { readonly definition: Definition; readonly facts: KindFacts };
type CatalogFacts = {
  readonly kinds: ReadonlyMap<string, Kind>;
  readonly structure: CompiledStructure;
  readonly styles: ReturnType<typeof compileStyles>;
};
const catalogFacts = new WeakMap<Catalog, CatalogFacts>();

/** Per-catalog tables, built once for each catalog object a host validates against. */
function factsFor(catalog: Catalog): CatalogFacts {
  let facts = catalogFacts.get(catalog);
  if (!facts) {
    const structure = compileStructure(catalog);
    facts = {
      structure,
      styles: compileStyles(catalog.vocabulary),
      kinds: new Map(
        catalog.definitions
          .map((definition) => [definition, kindFacts(definition, structure)] as const)
          .map(([definition, facts]) => [definition.kind, { definition, facts }] as const),
      ),
    };
    catalogFacts.set(catalog, facts);
  }
  return facts;
}

const FRAGMENT = "fragment";
/** Deepest nesting `embeds` follows; tree expressions are shallower (16). */
const EMBED_DEPTH = 17;
const VISITING = -1;

/** Where in a template a node sits: what its children are placed under, and how deep. */
type Place = {
  /** The kind of the nearest element above (fragments and components are transparent); undefined when unknown. */
  readonly parentKind?: string | undefined;
  readonly depth: number;
  /** The component whose body this is, or "" for the widget root. */
  readonly owner: string;
  readonly role: "root" | "component" | "child";
};

const expected = (list: Iterable<string>) => [...list].join(", ") || "none";

/** One validation of one template: the sink, the shared expression budget and everything seen so far. */
class Walk {
  readonly c = documentChecks();
  readonly budget = newBudget();
  readonly components: Readonly<Record<string, TemplateComponent>>;
  readonly anchors = new Map<string, string>();
  /** For each component (and "" for the widget), the components it uses and where. */
  readonly uses = new Map<string, Map<string, string>>();
  readonly rejector: ElementReject;
  readonly facts: CatalogFacts;
  readonly capabilities: Capabilities;
  readonly manifest: Manifest;
  nodes = 0;
  readonly bindingChecks = new Map<string, BindingCheck>();

  constructor(
    readonly template: Template,
    context: Context,
  ) {
    this.components = Object.hasOwn(template, "components") ? (template.components ?? {}) : {};
    this.facts = factsFor(context.catalog);
    this.capabilities = context.capabilities;
    this.manifest = context.manifest;
    const c = this.c;
    this.rejector = {
      at: (pointer, wanted) => this.reject(pointer, wanted),
      get stopped() {
        return c.errors.length >= 20;
      },
    };
  }

  run(): Result<Template> {
    this.checkComponents();
    this.checkWidget();
    this.checkGraph();
    for (const ref of this.budget.refs)
      if (!this.anchors.has(ref.anchor))
        this.reject(ref.pointer, "an $anchor declared in this template", "unknown-name");
    const errors = this.c.errors;
    return errors.length ? { ok: false, errors } : { ok: true, value: this.template };
  }

  reject(pointer: string, wanted: string, kind: LiveframeError["kind"] = "invalid-prop"): void {
    this.c.reject(pointer, `Expected ${wanted}`, kind, wanted);
  }

  /** A binding of `type` into `target`, or the reason it cannot be. */
  bindTo(type: ExprType, target: LanguageSchema, required: boolean, pointer: string): void {
    const problem = binds(type, target, required);
    if (problem) this.reject(pointer, problem);
  }

  expression(value: unknown, scope: Scope, pointer: string): ExprType {
    return analyzeExpression(value, scope, pointer, this.c).type;
  }

  // Components are checked first, each against its own params only (design T9).
  checkComponents(): void {
    const empty = rootScope({});
    const entries = Object.entries(this.components);
    if (entries.length > TEMPLATE_LIMITS.components)
      this.reject("/components", `at most ${TEMPLATE_LIMITS.components} components`, "limit-exceeded");
    for (const [name, component] of entries) {
      const pointer = at("/components", name);
      this.c.schemaRelationships(component.params, at(pointer, "params"));
      for (const param of Object.keys(component.params.properties)) {
        const problem = nameProblem(param, empty);
        if (problem)
          this.c.reject(
            at(at(at(pointer, "params"), "properties"), param),
            `Cannot name a param "${param}"`,
            "invalid-document",
            problem,
          );
      }
      if (this.c.errors.length) continue;
      const scope = componentScope(component.params, this.budget);
      this.walk(component.root as Raw, at(pointer, "root"), scope, { depth: 1, owner: name, role: "component" });
    }
  }

  checkWidget(): void {
    const { manifest, capabilities } = this;
    const scope = rootScope(
      {
        params: manifest.params,
        state: manifest.state,
        data: dataSchema(manifest, capabilities),
        context: manifest.context,
        actions: actionsSchema(manifest, capabilities),
      },
      this.budget,
    );
    this.walk(this.template.root as Raw, "/root", scope, { depth: 1, owner: "", role: "root" });
  }

  // The component graph is acyclic and shallow enough (design T10).
  checkGraph(): void {
    const heights = new Map<string, number>();
    const height = (owner: string): number => {
      heights.set(owner, VISITING);
      let tallest = 0;
      for (const [callee, pointer] of this.uses.get(owner) ?? []) {
        const known = heights.get(callee);
        if (known === VISITING) {
          this.c.reject(
            pointer,
            "A component cannot use itself, directly or through others",
            "invalid-document",
            "an acyclic component graph",
          );
          continue;
        }
        const below = known ?? height(callee);
        if (below + 1 > TEMPLATE_LIMITS.useDepth)
          this.reject(pointer, `components used at most ${TEMPLATE_LIMITS.useDepth} deep`, "limit-exceeded");
        tallest = Math.max(tallest, below + 1);
      }
      heights.set(owner, tallest);
      return tallest;
    };
    for (const owner of ["", ...Object.keys(this.components)]) if (!heights.has(owner)) height(owner);
  }

  /** The kind a component's root produces, following a root that is itself a `$use`; undefined when not one element. */
  rootKind(name: string, seen = 0): string | undefined {
    const root = Object.hasOwn(this.components, name) ? this.components[name]?.root : undefined;
    if (!root || seen > TEMPLATE_LIMITS.useDepth) return undefined;
    if (typeof root.kind === "string") return root.kind === FRAGMENT ? undefined : root.kind;
    return typeof root.$use === "string" ? this.rootKind(root.$use, seen + 1) : undefined;
  }

  walk(node: Raw, pointer: string, outer: Scope, here: Place): void {
    if (++this.nodes > TEMPLATE_LIMITS.nodes) {
      if (this.nodes === TEMPLATE_LIMITS.nodes + 1)
        this.reject(pointer, `at most ${TEMPLATE_LIMITS.nodes} template nodes`, "limit-exceeded");
      return;
    }
    if (here.depth > TEMPLATE_LIMITS.nesting) {
      this.reject(pointer, `nodes nested at most ${TEMPLATE_LIMITS.nesting} deep`, "limit-exceeded");
      return;
    }
    const scope = this.directives(node, pointer, outer, here.role);
    if (Object.hasOwn(node, "key")) this.keyValue(node.key, scope, at(pointer, "key"));
    if (Object.hasOwn(node, "$use")) this.componentNode(node, pointer, scope, here);
    else this.bodyNode(node, pointer, scope, here);
  }

  bodyNode(node: Raw, pointer: string, scope: Scope, here: Place): void {
    const kind = node.kind;
    if (Object.hasOwn(node, "with")) this.reject(at(pointer, "with"), "with only on a $use node", "invalid-document");
    if (typeof kind !== "string") {
      this.reject(pointer, "a kind or a $use", "invalid-document");
      return;
    }
    if (kind === FRAGMENT) {
      rejectFragmentFields(node, pointer, this.rejector);
      if (here.role === "root") this.reject(pointer, "an element as the widget root", "invalid-document");
      this.children(node, pointer, scope, here, here.parentKind);
      return;
    }
    const entry = this.facts.kinds.get(kind);
    if (entry) this.element(node, pointer, scope, here, kind, entry);
    else this.reject(at(pointer, "kind"), `a catalog kind: ${expected(this.facts.kinds.keys())}`, "unknown-component");
  }

  // ---- directives (design T3) ----

  /** `$let`, then `$if`, then `$each`. Returns the scope the body sees. */
  directives(node: Raw, pointer: string, outer: Scope, role: Place["role"]): Scope {
    let scope = outer;
    if (Object.hasOwn(node, "$let")) scope = this.letDirective(node.$let as LetEntry[], at(pointer, "$let"), scope);
    if (Object.hasOwn(node, "$if")) {
      if (role === "root")
        this.reject(at(pointer, "$if"), "no $if on the widget root, which must render", "invalid-document");
      analyzeOperand(node.$if, "bool", scope, at(pointer, "$if"), this.c);
      scope = assume(scope, narrowedBy(node.$if));
    }
    if (Object.hasOwn(node, "$each")) scope = this.eachDirective(node, pointer, scope, role);
    return scope;
  }

  /** Binds `name` unless it is already taken; a malformed name is bound anyway so one mistake reports once. */
  bind(scope: Scope, name: unknown, type: ExprType, pointer: string): Scope {
    const problem = nameProblem(name, scope);
    if (problem) this.c.reject(pointer, `Cannot bind "${String(name)}"`, "invalid-document", problem);
    return scope.names.has(name as string) ? scope : bindName(scope, name as string, type);
  }

  letDirective(list: LetEntry[], pointer: string, outer: Scope): Scope {
    let scope = outer;
    if (list.length > EXPR_LIMITS.bindings)
      this.reject(pointer, `at most ${EXPR_LIMITS.bindings} bindings`, "limit-exceeded");
    for (const [i, entry] of list.entries()) {
      const slot = at(pointer, i);
      const type = this.expression(entry.value, scope, at(slot, "value"));
      scope = this.bind(scope, entry.as, type, at(slot, "as"));
    }
    return scope;
  }

  eachDirective(node: Raw, pointer: string, outer: Scope, role: Place["role"]): Scope {
    const spec = node.$each as Raw;
    const where = at(pointer, "$each");
    if (role !== "child")
      this.reject(where, "no $each on a root: a root emits one node (use a fragment)", "invalid-document");
    const source = analyzeOperand(spec.in, "arr", outer, at(where, "in"), this.c);
    const items = itemsOf(source.type);
    let scope = this.bind(outer, spec.as, items ? typeOf(items) : DYNAMIC, at(where, "as"));
    if (Object.hasOwn(spec, "index"))
      scope = this.bind(scope, spec.index, typeOf({ type: "integer", minimum: 0 }), at(where, "index"));
    if (Object.hasOwn(spec, "key")) this.keyValue(spec.key, scope, at(where, "key"));
    else this.reject(at(where, "key"), "a key expression for each emitted node", "missing-key");
    if (Object.hasOwn(node, "key"))
      this.reject(at(pointer, "key"), "no key on a node with $each (set $each.key)", "invalid-document");
    if (Object.hasOwn(node, "$anchor"))
      this.reject(at(pointer, "$anchor"), "no $anchor on a node with $each", "invalid-document");
    return scope;
  }

  /** A key is a string of 1–128 characters or a number, known now or checked when rendered. */
  keyValue(value: unknown, scope: Scope, pointer: string): void {
    const type = this.expression(value, scope, pointer);
    const { schema, literal } = type;
    if (literal !== undefined) {
      const text = typeof literal === "number" ? String(literal) : typeof literal === "string" ? literal : "";
      if (text.length === 0 || text.length > 128 || /[\ud800-\udfff]/u.test(text))
        this.reject(pointer, "a key of 1–128 characters");
      return;
    }
    if (schema === "dynamic") return;
    const keyed =
      typeof schema === "object" &&
      !("discriminator" in schema) &&
      (schema.type === "string" || schema.type === "number" || schema.type === "integer") &&
      schema.nullable !== true &&
      !type.optional;
    if (!keyed) this.reject(pointer, "a string or number key");
  }

  // ---- bodies ----

  /** A `$use` node: no element fields of its own, and `with` against the component's params. */
  componentNode(node: Raw, pointer: string, scope: Scope, here: Place): void {
    for (const field of ["props", "style", "events", "children", "variant", "$anchor", "when", "bind"])
      if (Object.hasOwn(node, field))
        this.reject(at(pointer, field), `no ${field} on a $use node (set it in the component)`, "invalid-document");
    const name = node.$use as string;
    const component = Object.hasOwn(this.components, name) ? this.components[name] : undefined;
    if (!component) {
      const known = expected(Object.keys(this.components));
      this.reject(at(pointer, "$use"), `a declared component: ${known}`, "unknown-name");
      return;
    }
    const edges = this.uses.get(here.owner) ?? new Map<string, string>();
    this.uses.set(here.owner, edges);
    if (!edges.has(name)) edges.set(name, at(pointer, "$use"));
    this.params(node, pointer, scope, name, component.params);
    const root = this.rootKind(name);
    if (root && here.parentKind) this.placement(here.parentKind, root, true, pointer, "$use");
  }

  params(node: Raw, pointer: string, scope: Scope, name: string, params: ObjectSchema): void {
    const given = isRecord(node.with) ? node.with : {};
    for (const key of Object.keys(given)) {
      const target = Object.hasOwn(params.properties, key) ? params.properties[key] : undefined;
      const where = at(at(pointer, "with"), key);
      if (target) this.bindTo(this.expression(given[key], scope, where), target, params.required.includes(key), where);
      else this.reject(where, `a param of ${name}: ${expected(Object.keys(params.properties))}`, "unknown-name");
    }
    for (const key of params.required)
      if (!Object.hasOwn(given, key)) this.reject(at(pointer, "with"), `the required param ${key} of ${name}`);
  }

  /** A node's place under its parent. The structure rules name `/kind`; a `$use` node has the `$use` field instead. */
  placement(parentKind: string, childKind: string, hasChildren: boolean, pointer: string, field = "kind"): void {
    this.facts.structure.node(parentKind, childKind, 2, hasChildren, {
      reject: (wanted, suffix = "") =>
        this.reject(pointer + (suffix === "/kind" ? `/${field}` : suffix), wanted, "invalid-children"),
    });
  }

  children(node: Raw, pointer: string, scope: Scope, here: Place, parentKind: string | undefined): void {
    const list = Array.isArray(node.children) ? node.children : [];
    const below: Place = { parentKind, depth: here.depth + 1, owner: here.owner, role: "child" };
    for (const [i, entry] of list.entries())
      if (isRecord(entry)) this.walk(entry, at(at(pointer, "children"), i), scope, below);
  }

  element(node: Raw, pointer: string, scope: Scope, here: Place, kind: string, entry: Kind): void {
    const { facts } = entry;
    const list = Array.isArray(node.children) ? node.children : [];
    if (Object.hasOwn(node, "variant") && (typeof node.variant !== "string" || !facts.variants.has(node.variant)))
      this.reject(at(pointer, "variant"), `one of: ${expected(facts.variants)}`);
    if (typeof node.$anchor === "string") this.anchor(node.$anchor, at(pointer, "$anchor"));
    if (here.parentKind) this.placement(here.parentKind, kind, list.length > 0, pointer);
    else if (list.length === 0) this.placement("", kind, false, pointer);
    if (facts.children === "none" && list.length > 0)
      this.reject(at(pointer, "children"), `no children in ${kind}`, "invalid-children");
    this.members(node, pointer, entry, scope);
    this.expressions(node, pointer, entry, scope);
    this.children(node, pointer, scope, here, kind);
  }

  // ---- when and bind (plan 029 B12) ----

  /**
   * A node's browser-evaluated `when` and `bind`. Each `$embed` operand is a template expression; the rest is
   * a tree expression, checked as the validator would once expanded, with every `$embed` an unknown value.
   */
  expressions(node: Raw, pointer: string, entry: Kind, scope: Scope): void {
    const present = ["when", "bind"].filter((field) => Object.hasOwn(node, field));
    if (!present.length) return;
    for (const field of present) this.embeds(node[field], at(pointer, field), scope, 0);
    const kind = entry.definition.kind;
    let check = this.bindingChecks.get(kind);
    if (!check) {
      check = compileBindings({
        local: this.manifest.local ?? NO_LOCAL,
        props: entry.definition.props,
        refProps: entry.facts.refProps,
        embed: true,
      });
      this.bindingChecks.set(kind, check);
    }
    const sink = { errors: [] as LiveframeError[], maxErrors: 20 };
    check(node, sink);
    for (const error of sink.errors) this.c.reject(pointer + error.pointer, error.message, error.kind, error.expected);
  }

  /** Checks the operand of every `$embed` in a tree expression as a template expression; it must be present. */
  embeds(value: unknown, pointer: string, scope: Scope, depth: number): void {
    // Past the tree-expression depth the checker reports the expression itself.
    if (depth > EMBED_DEPTH) return;
    if (Array.isArray(value)) {
      for (const [i, member] of value.entries()) this.embeds(member, at(pointer, i), scope, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === EMBED) {
      const where = at(pointer, EMBED);
      const type = this.expression(value[EMBED], scope, where);
      if (type.optional || type.schema === "absent") this.reject(where, "a value that is always present");
      return;
    }
    for (const key of keys) this.embeds(value[key], at(pointer, key), scope, depth + 1);
  }

  anchor(name: string, pointer: string): void {
    if (this.anchors.has(name)) this.reject(pointer, "a template-unique anchor", "duplicate-key");
    else this.anchors.set(name, pointer);
  }

  // ---- props, style and events ----

  /** A node's props, style props and events, each by the section the SDK would send it to. */
  members(node: Raw, pointer: string, entry: Kind, scope: Scope): void {
    const { definition, facts } = entry;
    const before = this.c.errors.length;
    const merged = mergeSections(node, pointer, this.rejector);
    if (!merged || this.c.errors.length > before) return;
    const present = new Set<string>();
    for (const name of Object.keys(merged)) {
      const origin = ["props", "style", "events"].find(
        (section) => isRecord(node[section]) && Object.hasOwn(node[section] as object, name),
      ) as string;
      const place = at(at(pointer, origin), name);
      const target = propTarget(facts, name);
      if (target === "events") this.event(name, merged[name], at(pointer, "events"), place, entry, scope);
      else if (target === "style") this.styleProp(name, merged[name], place, scope);
      else if (this.prop(name, merged[name], place, entry, scope)) present.add(name);
    }
    for (const name of definition.props.required)
      if (!present.has(name)) this.reject(at(at(pointer, "props"), name), `the required prop ${name}`);
  }

  /** True when `name` is a declared prop. */
  prop(name: string, value: unknown, pointer: string, entry: Kind, scope: Scope): boolean {
    const { definition } = entry;
    const schema = Object.hasOwn(definition.props.properties, name) ? definition.props.properties[name] : undefined;
    if (!schema) {
      const declared = expected(Object.keys(definition.props.properties));
      this.reject(pointer, `a declared prop of ${definition.kind}: ${declared}`);
      return false;
    }
    const type = this.expression(value, scope, pointer);
    // `{ $ref }` markers are how a prop in `refProps` names another node (plan 027).
    if (!(definition.refProps?.includes(name) && isReference(type)))
      this.bindTo(type, schema, definition.props.required.includes(name), pointer);
    return true;
  }

  styleProp(name: string, value: unknown, pointer: string, scope: Scope): void {
    const type = this.expression(value, scope, pointer);
    const check = this.facts.styles.get(name as never);
    if (type.literal === undefined || !check) return;
    const sink = { errors: [] as LiveframeError[], maxErrors: 20 };
    check(type.literal, "", sink);
    for (const error of sink.errors)
      this.c.reject(pointer + error.pointer, error.message, "invalid-prop", error.expected);
  }

  event(name: string, value: unknown, events: string, pointer: string, entry: Kind, scope: Scope): void {
    const { definition, facts } = entry;
    if (facts.events.has(name)) {
      this.intent(value, pointer, (definition.events[name] as Definition["events"][string]).carries, scope);
      return;
    }
    this.reject(at(events, name), `a declared event: ${expected(facts.events)}`, "undeclared-event");
  }

  // ---- intents (design T14) ----

  intent(value: unknown, pointer: string, carries: Carries, scope: Scope): void {
    if (!isRecord(value)) this.reject(pointer, "one setState or action intent");
    else if (value.type === "setState") this.write(value, pointer, carries, scope, this.manifest.state, "state");
    else if (value.type === "setLocal")
      this.write(value, pointer, carries, scope, this.manifest.local ?? NO_LOCAL, "local");
    else if (value.type === "action") this.action(value, pointer, carries, scope);
    else this.reject(at(pointer, "type"), "intent type setState or action");
  }

  /** A `setState` or `setLocal`: a key of the manifest's state or local schema, with an expression or an event's value. */
  write(value: Raw, pointer: string, carries: Carries, scope: Scope, schema: ObjectSchema, what: string): void {
    const key = value.key;
    const { properties } = schema;
    const state = typeof key === "string" && Object.hasOwn(properties, key) ? properties[key] : undefined;
    if (!state) {
      this.reject(at(pointer, "key"), `a declared ${what} key: ${expected(Object.keys(properties))}`);
      return;
    }
    if (Object.hasOwn(value, "value")) {
      const where = at(pointer, "value");
      this.bindTo(this.expression(value.value, scope, where), state, true, where);
      return;
    }
    const type = state.type ?? "object";
    const fits = typeof carries === "object" ? objectFits(carries.object, state) : carriesFits(carries, type);
    if (!fits) this.reject(at(pointer, "value"), `an explicit ${type} value, or an event carrying ${type}`);
  }

  action(value: Raw, pointer: string, carries: Carries, scope: Scope): void {
    const name = value.name;
    if (typeof name !== "string" || !this.manifest.actions.includes(name)) {
      const known = expected(this.manifest.actions);
      this.reject(at(pointer, "name"), `an action in the manifest: ${known}`, "undeclared-action");
      return;
    }
    const schema = (this.capabilities.actions[name] as Capabilities["actions"][string]).args;
    const args = value.args;
    if (!isRecord(args)) {
      this.reject(at(pointer, "args"), "an object of action arguments");
      return;
    }
    if (Object.hasOwn(value, "resultKey")) {
      const where = at(pointer, "resultKey");
      this.bindTo(
        this.expression(value.resultKey, scope, where),
        { type: "string", maxLength: 128, minLength: 1 },
        true,
        where,
      );
    }
    const completion = this.completion(value, args, pointer, carries, schema);
    for (const key of Object.keys(args)) {
      const target = Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
      const where = at(at(pointer, "args"), key);
      if (target) this.bindTo(this.expression(args[key], scope, where), target, schema.required.includes(key), where);
      else this.reject(where, `a declared argument of ${name}: ${expected(Object.keys(schema.properties))}`);
    }
    if (!completion) return;
    for (const key of schema.required)
      if (!Object.hasOwn(args, key) && key !== completion.bound && !completion.event.includes(key))
        this.reject(at(at(pointer, "args"), key), `the required argument ${key}`);
  }

  /**
   * What the event supplies to an action's arguments through `bind` or `bindAll`, or undefined when the
   * declaration is itself wrong (then missing arguments are not reported on top of it).
   */
  completion(
    value: Raw,
    args: Raw,
    pointer: string,
    carries: Carries,
    schema: ObjectSchema,
  ): { readonly bound?: string; readonly event: readonly string[] } | undefined {
    if (Object.hasOwn(value, "bindAll")) return this.bindAll(value, args, pointer, carries, schema);
    if (!Object.hasOwn(value, "bind")) return { event: [] };
    const bound = value.bind;
    const target =
      typeof bound === "string" && Object.hasOwn(schema.properties, bound) ? schema.properties[bound] : undefined;
    if (!target || typeof bound !== "string" || !carriesFits(carries, target.type ?? "object")) {
      this.reject(
        at(pointer, "bind"),
        `an action argument the event can carry (event carries ${JSON.stringify(carries)})`,
      );
      return undefined;
    }
    if (Object.hasOwn(args, bound)) this.reject(at(at(pointer, "args"), bound), "the bound argument omitted from args");
    return { bound, event: [] };
  }

  bindAll(
    value: Raw,
    args: Raw,
    pointer: string,
    carries: Carries,
    schema: ObjectSchema,
  ): { readonly event: readonly string[] } | undefined {
    if (value.bindAll !== true || Object.hasOwn(value, "bind") || typeof carries !== "object") {
      this.reject(at(pointer, "bindAll"), "bindAll: true on an object event, without bind");
      return undefined;
    }
    for (const key of Object.keys(carries.object.properties))
      if (Object.hasOwn(args, key))
        this.reject(at(at(pointer, "args"), key), "event properties omitted from literal args");
    if (objectFits(carries.object, schema, args)) return { event: carries.object.required };
    this.reject(at(pointer, "bindAll"), "an event schema fitting the action arguments minus literal args");
    return undefined;
  }
}

type Raw = Record<string, unknown>;
type LetEntry = { readonly as: unknown; readonly value: unknown };

/** `{ $ref }` markers: an object whose only property is `$ref`. */
function isReference(type: ExprType): boolean {
  const schema = type.schema;
  return (
    typeof schema === "object" &&
    !("discriminator" in schema) &&
    schema.type === "object" &&
    "$ref" in schema.properties
  );
}

/** Transport checks only: JSON, size and structure. Installation still requires `validateTemplate`. */
export function validateTemplateShape(doc: unknown): Result<Template> {
  const valid = validateJson(doc);
  if (!valid.ok) return valid;
  if (utf8Length(JSON.stringify(doc), TEMPLATE_LIMITS.bytes) > TEMPLATE_LIMITS.bytes)
    return {
      ok: false,
      errors: [
        {
          kind: "limit-exceeded",
          pointer: "",
          message: "Expected at most 1 MiB of UTF-8 JSON",
          expected: "at most 1 MiB of UTF-8 JSON",
        },
      ],
    };
  const shape = checkFormat(templateSchema, doc);
  return shape.ok ? { ok: true, value: doc as Template } : shape;
}

/**
 * Checks a template document against the installed catalog, capabilities and manifest: structure,
 * bounds, the component graph, and every expression and binding. Errors point into the template.
 * `catalog`, `capabilities` and `manifest` are validated documents, as for `validateManifest`.
 */
export function validateTemplate(doc: unknown, context: Context): Result<Template> {
  const shape = validateTemplateShape(doc);
  return shape.ok ? new Walk(shape.value, context).run() : shape;
}
