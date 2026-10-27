import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import {
  arr,
  bool,
  classifyCatalogChange,
  compileValidator,
  int,
  type Intent,
  type LanguageSchema,
  num,
  obj,
  str,
  validateCatalog,
} from "../index.ts";
import { createRenderer, type ImplementationProps, implement } from "../react/index.ts";
import { action } from "../sdk/index.ts";
import * as form from "./fixtures/object-events.ts";
import { surfaceProps } from "./fixtures/react-surface.tsx";

test("object_carries_must_be_closed_and_bounded", () => {
  expect(validateCatalog(form.catalog).ok).toBe(true);
  for (const schema of [
    { ...form.fields, additionalProperties: true },
    { ...form.fields, nullable: true },
    obj({ nested: obj({}) }),
    obj({ list: arr(bool(), { maxItems: 2 }) }),
    obj(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`p${i}`, bool()]))),
    { ...form.fields, properties: { reason: { type: "string" } } },
  ]) {
    const catalog = structuredClone(form.catalog);
    const definition = catalog.definitions.find((d) => d.kind === "stack");
    if (!definition) throw new Error("Missing stack");
    Object.assign(definition, { events: { onSubmit: { carries: { object: schema }, description: "Submit." } } });
    expect(validateCatalog(catalog).ok).toBe(false);
  }
  expect(classifyCatalogChange(form.catalog, structuredClone(form.catalog)).level).toBe("none");
  const changed = structuredClone(form.catalog);
  const definition = changed.definitions.find((d) => d.kind === "stack");
  Object.assign(definition ?? {}, {
    events: {
      onSubmit: {
        carries: { object: obj({ reason: str({ maxLength: 501 }), confirm: bool() }) },
        description: "Submit.",
      },
    },
  });
  expect(classifyCatalogChange(form.catalog, changed).level).toBe("major");
});

test("bind_all_schema_mismatch_fails_with_pointer", () => {
  const good: Intent = action("form.submit", { id: "row" }, { bindAll: true });
  expect(form.validator.validateTree(form.formTree(good)).ok).toBe(true);
  for (const intent of [
    { ...good, args: { id: "row", reason: "overlap" } },
    { ...good, args: {} },
    { ...good, bindAll: false },
    { ...good, bind: "reason" },
  ]) {
    const result = form.validator.validateTree(form.formTree(intent as Intent));
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0]).toMatchObject({
        kind: "invalid-prop",
        pointer: expect.stringContaining("/events/onSubmit/"),
      });
  }
  for (const schema of [
    obj({ reason: num(), confirm: bool() }),
    obj({ reason: str({ maxLength: 500 }) }, { confirm: bool() }),
    obj({ reason: str({ maxLength: 500 }), confirm: bool(), extra: bool() }),
  ]) {
    const catalog = structuredClone(form.catalog);
    const definition = catalog.definitions.find((d) => d.kind === "stack");
    Object.assign(definition ?? {}, { events: { onSubmit: { carries: { object: schema }, description: "Submit." } } });
    const validator = compileValidator({ ...form, catalog });
    expect(validator.validateTree(form.formTree(good)).ok).toBe(false);
  }
  // Structural fit leaves bounds to completed-value checks.
  const capabilities = {
    ...form.capabilities,
    actions: {
      ...form.capabilities.actions,
      "form.submit": {
        description: "Submit.",
        args: obj({ id: str({ maxLength: 80 }), reason: str({ maxLength: 1 }), confirm: bool() }),
      },
    },
  };
  expect(compileValidator({ ...form, capabilities }).validateTree(form.formTree(good)).ok).toBe(true);
});

test("bind_and_bind_all_exclusive", () => {
  expect(() => action("form.submit", {}, { bind: "reason", bindAll: true })).toThrow();
});

test("object_set_state_requires_structural_fit", () => {
  expect(form.validator.validateTree(form.formTree({ type: "setState", key: "form" })).ok).toBe(true);
  expect(form.validator.validateTree(form.formTree({ type: "setState", key: "reason" })).ok).toBe(false);
  expect(form.validator.validateTree(form.formTree({ type: "setState", key: "cursors" })).ok).toBe(false);
  expect(
    form.validator.validateTree(
      form.formTree({ type: "action", name: "form.submit", args: { id: "row", confirm: true }, bind: "reason" }),
    ).ok,
  ).toBe(false);
});

test("object_fit_checks_numeric_widening_nullability_and_optional_fields", () => {
  const cases: readonly [LanguageSchema, LanguageSchema, boolean][] = [
    [int(), num(), true],
    [num(), int(), false],
    [{ ...bool(), nullable: true }, bool(), false],
    [bool(), { ...bool(), nullable: true }, true],
    [{ ...bool(), nullable: true }, { ...bool(), nullable: true }, true],
  ];
  for (const [event, target, expected] of cases) {
    const catalog = {
      ...form.catalog,
      definitions: form.catalog.definitions.map((definition) =>
        definition.kind === "stack"
          ? {
              ...definition,
              events: { onSubmit: { carries: { object: obj({ value: event }) }, description: "Submit." } },
            }
          : definition,
      ),
    };
    const capabilities = {
      ...form.capabilities,
      actions: {
        ...form.capabilities.actions,
        "form.submit": { description: "Submit.", args: obj({ value: target }) },
      },
    };
    const validator = compileValidator({ ...form, catalog, capabilities });
    expect(validator.validateTree(form.formTree(action("form.submit", {}, { bindAll: true }))).ok).toBe(expected);
  }
  const capabilities = {
    ...form.capabilities,
    actions: {
      ...form.capabilities.actions,
      "form.submit": {
        description: "Submit.",
        args: obj(
          { id: str({ maxLength: 80 }), reason: str({ maxLength: 500 }) },
          { confirm: bool(), optional: bool() },
        ),
      },
    },
  };
  expect(compileValidator({ ...form, capabilities }).validateTree(form.formTree()).ok).toBe(true);
});

test("emit_rejects_invalid_object_and_completes_fresh_intents", () => {
  for (const intent of [
    action("form.submit", { id: "row" }, { bindAll: true }),
    { type: "setState", key: "form" } as const,
  ]) {
    let context: ImplementationProps | undefined;
    const intents: Intent[] = [];
    const { Surface } = createRenderer({
      catalog: form.catalog,
      implementations: form.catalog.definitions.map((definition) =>
        implement(definition, (input) => {
          context = input;
          return null;
        }),
      ),
    });
    renderToString(
      <Surface
        {...surfaceProps}
        validator={form.validator}
        tree={form.formTree(intent)}
        onIntent={(i) => intents.push(i)}
      />,
    );
    if (!context) throw new Error("Missing form context");
    for (const invalid of [
      undefined,
      null,
      [],
      {},
      { reason: "yes" },
      { reason: "yes", confirm: "true" },
      { reason: "x".repeat(501), confirm: true },
      { reason: "yes", confirm: true, extra: 1 },
    ]) {
      expect(() => context?.emit("onSubmit", invalid)).toThrow("Invalid event value");
      expect(intents).toEqual([]);
    }
    const payload = { reason: "current", confirm: true };
    context.emit("onSubmit", payload);
    expect(intents).toEqual([
      intent.type === "action"
        ? { type: "action", name: "form.submit", args: { id: "row", ...payload } }
        : { ...intent, value: payload },
    ]);
    expect(Object.isFrozen(payload)).toBe(false);
    payload.reason = "changed";
    expect(JSON.stringify(intents[0])).toContain("current");
  }
});
