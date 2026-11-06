import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  type Capabilities,
  type Catalog,
  checkValue,
  classifyCatalogChange,
  isLanguageSchema,
  type LanguageSchema,
  obj,
  str,
  validateCatalog,
  validateManifest,
} from "../index.ts";
import { generate } from "../sdk/gen.ts";
import { checkUrl, urlPattern } from "../url.ts";
import { compileSchema, type SchemaSink } from "../validate/schema.ts";
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };

const https = str({ maxLength: 2048, url: { schemes: ["https"] } });
const loose = str({ maxLength: 2048, url: { schemes: ["https", "mailto"], relative: true } });

function compiled(schema: LanguageSchema, value: unknown) {
  const sink: SchemaSink = { errors: [], maxErrors: 20 };
  return { ok: compileSchema(schema)(value, "", sink), errors: sink.errors };
}

test("url_rejects_disallowed_scheme_case_insensitive", () => {
  for (const value of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,x",
    "vbscript:x",
    "http://a.example",
  ])
    expect(checkUrl(value, { schemes: ["https"] })).toBe(false);
  for (const value of ["https://a.example", "HTTPS://a.example", "HtTpS:x"])
    expect(checkUrl(value, { schemes: ["https"] })).toBe(true);
  // Compiled and interpreted checks agree, and the error is `invalid-prop` naming the schemes.
  const failed = compiled(https, "JaVaScRiPt:alert(1)");
  expect(failed.ok).toBe(false);
  expect(failed.errors[0]).toMatchObject({ kind: "invalid-prop" });
  expect(failed.errors[0]?.expected).toContain("https");
  expect(checkValue(https, "javascript:alert(1)").ok).toBe(false);
  expect(checkValue(https, "https://a.example").ok).toBe(true);
});

test("url_rejects_embedded_tab_and_newline", () => {
  for (const value of [
    "java\tscript:alert(1)",
    "java\nscript:x",
    "jav\rascript:x",
    "https://a\n.example",
    " https://a",
    "https://a b",
    "\u0000https://a",
    "https://a\u001f",
  ])
    expect(checkUrl(value, { schemes: ["https"], relative: true })).toBe(false);
  expect(compiled(loose, "java\tscript:alert(1)").ok).toBe(false);
});

test("url_rejects_protocol_relative", () => {
  for (const value of ["//evil.example", "//", "\\\\evil.example", "\\evil", "/\\evil.example"])
    expect(checkUrl(value, { schemes: ["https"], relative: true })).toBe(false);
  expect(checkUrl("/a//b", { schemes: ["https"], relative: true })).toBe(true);
});

test("url_relative_only_when_allowed", () => {
  for (const value of ["/path", "a/b.png", "../x", "#top", "?q=a:b", "", "1abc:x", ":x"])
    expect(checkUrl(value, { schemes: ["https"], relative: true })).toBe(true);
  for (const value of ["/path", "a/b.png", "#top", ""]) expect(checkUrl(value, { schemes: ["https"] })).toBe(false);
  expect(checkUrl("/path", { schemes: ["https"], relative: false })).toBe(false);
  // `a/b:c` has no scheme: the slash ends the scheme grammar, as in a browser.
  expect(checkUrl("a/b:c", { schemes: ["https"], relative: true })).toBe(true);
  // `foo:bar` has one, and it is not allowed.
  expect(checkUrl("foo:bar", { schemes: ["https"], relative: true })).toBe(false);
});

test("url_allowed_in_widget_schema", () => {
  const catalog = catalogDocument as unknown as Catalog;
  const widget = {
    format: "liveframe-manifest/1",
    id: "links",
    version: "1.0.0",
    catalogId: catalog.catalogId,
    params: obj({}),
    state: obj({ home: str({ maxLength: 200, url: { schemes: ["https"], relative: true } }) }),
    context: obj({}),
    initialState: { home: "/start" },
    sources: {},
    actions: [],
  };
  const capabilities: Capabilities = { format: "liveframe-capabilities/1", actions: {}, sources: {} };
  const context = { catalog, capabilities };
  expect(validateManifest(widget, context).ok).toBe(true);
  // The initial state is matched against the schema, so a disallowed scheme is rejected there.
  const bad = validateManifest({ ...widget, initialState: { home: "javascript:alert(1)" } }, context);
  expect(bad.ok).toBe(false);
  // A pattern is still refused beside it.
  const withPattern = validateManifest(
    { ...widget, state: obj({ home: str({ maxLength: 200, pattern: "^a" }) }), initialState: { home: "a" } },
    context,
  );
  expect(withPattern.ok).toBe(false);
});

test("url_keyword_is_closed", () => {
  const url = (rule: unknown) => ({ type: "string", maxLength: 10, url: rule });
  expect(isLanguageSchema(url({ schemes: ["https"] }))).toBe(true);
  for (const rule of [
    {},
    { schemes: [] },
    { schemes: ["HTTPS"] },
    { schemes: ["1x"] },
    { schemes: ["a b"] },
    { schemes: ["https", "https"] },
    { schemes: Array.from({ length: 17 }, (_, i) => `s${String.fromCharCode(97 + i)}`) },
    { schemes: ["https"], relative: "yes" },
    { schemes: ["https"], extra: true },
  ])
    expect(isLanguageSchema(url(rule))).toBe(false);
  // It is not a regular expression: a schema may not carry both.
  expect(isLanguageSchema({ ...url({ schemes: ["https"] }), pattern: "^a" })).toBe(false);
  const result = checkValue({ ...url({ schemes: ["https"] }), pattern: "^a" } as never, "https:");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors[0]?.pointer).toBe("/url");
});

test("url_json_schema_agrees_with_checker", () => {
  const values = [
    "https://a.example/x?y=z#f",
    "HTTPS://A.EXAMPLE",
    "mailto:a@b.example",
    "MAILTO:a@b.example",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,x",
    "//evil.example",
    "\\\\evil.example",
    "\\evil",
    "/\\evil",
    "/ok/path",
    "/a//b",
    "a/b:c",
    "../up",
    "#top",
    "?q=a:b",
    "",
    ":x",
    "1abc:x",
    "foo:bar",
    "ht+tp:x",
    "https:",
    "https",
    " https://a",
    "https://a b",
    "https://a\u0000",
    "https://a\u007f",
    "https://a b",
    "https://日本語.example",
    "ｈttps://a",
  ];
  const ajv = new Ajv2020({ strict: true });
  for (const rule of [
    { schemes: ["https"] },
    { schemes: ["https"], relative: true },
    { schemes: ["https", "mailto"], relative: true },
    { schemes: ["a+b", "c.d", "e-f"], relative: true },
  ]) {
    const pattern = urlPattern(rule);
    const expression = new RegExp(pattern, "u");
    const published = ajv.compile({ type: "string", pattern });
    for (const value of values) {
      const verdict = checkUrl(value, rule);
      expect(expression.test(value), `${JSON.stringify(rule)} ${JSON.stringify(value)}`).toBe(verdict);
      expect(published(value)).toBe(verdict);
    }
  }
});

test("url_pattern_is_linear", () => {
  // No nested quantifier: a long near-miss input finishes at once.
  const expression = new RegExp(urlPattern({ schemes: ["https"], relative: true }), "u");
  const started = performance.now();
  expect(expression.test(`${"a".repeat(200_000)}:`)).toBe(false);
  expect(expression.test(`a${"+".repeat(200_000)}`)).toBe(true);
  expect(performance.now() - started).toBeLessThan(200);
});

test("url_generated_types_and_schemas_document_the_schemes", () => {
  const source = generate(catalogDocument as unknown as Catalog);
  expect(source).toContain("/** Expects a URL with scheme https or a relative reference. */");
});

test("url_changes_classify_catalog_changes", () => {
  const catalog = (schema: LanguageSchema) => {
    const doc = structuredClone(catalogDocument) as unknown as Catalog;
    const image = doc.definitions.find((d) => d.kind === "image");
    if (!image) throw Error("Expected image");
    (image.props.properties as Record<string, LanguageSchema>).src = schema;
    const result = validateCatalog(doc);
    if (!result.ok) throw Error(JSON.stringify(result.errors));
    return result.value;
  };
  const base = catalog(str({ maxLength: 2048, url: { schemes: ["https"] } }));
  const wider = catalog(str({ maxLength: 2048, url: { schemes: ["https", "mailto"], relative: true } }));
  expect(classifyCatalogChange(base, wider).level).toBe("minor");
  const narrower = classifyCatalogChange(wider, base);
  expect(narrower.level).toBe("major");
  expect(narrower.reasons).toContain("kind image.src url relative changed");
  expect(classifyCatalogChange(catalog(str({ maxLength: 2048 })), base).level).toBe("major");
  expect(classifyCatalogChange(base, catalog(str({ maxLength: 2048 }))).level).toBe("minor");
});
