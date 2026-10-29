import { expect, test } from "bun:test";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileValidator,
  type LiveframeError,
  type Result,
  validateCatalog,
  validateCapabilities,
  validateDesignSystem,
  validateManifest,
  validateTheme,
} from "../index.ts";
import { validateWidgetPackageShape } from "../formats/package.ts";
import { validatePlacement, validateStyleRecord } from "../formats/records.ts";
import { renderElements } from "../sdk/elements.ts";

const FORMATS = [
  "catalog",
  "theme",
  "design-system",
  "capabilities",
  "manifest",
  "ui-tree",
  "package",
  "placement",
  "style-record",
  "elements",
] as const;
type Format = (typeof FORMATS)[number];

/** Every kind a format validator can return, reviewed against the validator sources. */
const FORMAT_KINDS = {
  catalog: ["invalid-document", "unknown-name"],
  theme: ["invalid-document", "unknown-name", "insufficient-contrast"],
  "design-system": [
    "invalid-document",
    "unknown-name",
    "colour-outside-theme",
    "incomplete-design-system",
    "cyclic-extends",
  ],
  capabilities: ["invalid-document", "limit-exceeded"],
  manifest: ["invalid-document", "catalog-mismatch", "unknown-name", "limit-exceeded"],
  "ui-tree": [
    "invalid-prop",
    "invalid-children",
    "unknown-component",
    "duplicate-key",
    "undeclared-event",
    "undeclared-action",
    "limit-exceeded",
  ],
  package: ["invalid-document", "limit-exceeded"],
  placement: ["invalid-document"],
  "style-record": ["invalid-document"],
  elements: [
    "invalid-prop",
    "invalid-children",
    "unknown-component",
    "missing-key",
    "duplicate-key",
    "undeclared-event",
    "undeclared-action",
    "limit-exceeded",
  ],
} satisfies Record<Format, readonly LiveframeError["kind"][]>;

/** Kinds produced by pack, render, store, preview or authoring code, never by a format validator. */
const NON_FORMAT_KINDS = [
  "forbidden-import",
  "transpile-failed",
  "hash-mismatch",
  "version-conflict",
  "not-found",
  "host-element",
  "function-prop",
  "async-render",
  "render-failed",
] as const;

const SUPPORT_ROLES = new Set(["catalog", "capabilities", "manifest", "theme", "designSystem", "vocabulary"]);
const corpusRoot = fileURLToPath(new URL("../../conformance/corpus/", import.meta.url));

type ExpectedError = { readonly kind: LiveframeError["kind"]; readonly pointer: string };
type CorpusCase = {
  readonly label: string;
  readonly format: Format;
  readonly file: string;
  readonly inputs: Readonly<Record<string, string>>;
  readonly doc: unknown;
  readonly support: Readonly<Record<string, unknown>>;
  readonly options: Readonly<{ maxErrors?: number; limits?: { nodes?: number; depth?: number; bytes?: number } }>;
  readonly expect: { readonly ok: true } | { readonly ok: false; readonly errors: readonly ExpectedError[] };
};

function fail(label: string, message: string): never {
  throw new Error(`${label}: ${message}`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function documentPath(caseFile: string, path: string): string {
  if (isAbsolute(path)) fail(caseFile, `input path must be relative: ${path}`);
  const resolved = resolve(dirname(caseFile), path);
  const inside = relative(corpusRoot, resolved);
  if (inside === ".." || inside.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(inside))
    fail(caseFile, `input path escapes the corpus root: ${path}`);
  return resolved;
}

async function readJson(path: string): Promise<unknown> {
  try {
    return await Bun.file(path).json();
  } catch (error) {
    fail(path, error instanceof Error ? error.message : String(error));
  }
}

function parseCase(file: string, raw: unknown): CorpusCase {
  if (!record(raw) || !record(raw.inputs)) fail(file, "expected { inputs, options, expect }");
  const format = file.slice(corpusRoot.length).split("/")[0] as Format;
  if (!FORMATS.includes(format)) fail(file, `unknown corpus format ${format}`);
  if (typeof raw.inputs.doc !== "string") fail(file, "inputs.doc must name a JSON file");
  const inputs: Record<string, string> = {};
  for (const [role, path] of Object.entries(raw.inputs)) {
    if (typeof path !== "string") fail(file, `input ${role} must name a JSON file`);
    inputs[role] = path;
  }
  const options = raw.options ?? {};
  if (!record(options)) fail(file, "options must be an object");
  for (const key of Object.keys(options)) {
    if (key !== "maxErrors" && key !== "limits") fail(file, `unknown option ${key}`);
    if (format !== "ui-tree" && format !== "elements") fail(file, `${key} is only valid on ui-tree/elements`);
  }
  if (!record(raw.expect) || typeof raw.expect.ok !== "boolean") fail(file, "expect must carry an ok boolean");
  let expected: CorpusCase["expect"];
  if (raw.expect.ok) expected = { ok: true };
  else {
    if (!Array.isArray(raw.expect.errors)) fail(file, "a failing case lists its errors");
    const errors = raw.expect.errors.map((entry) => {
      if (!record(entry) || typeof entry.kind !== "string" || typeof entry.pointer !== "string")
        fail(file, "each expected error needs kind and pointer strings");
      return { kind: entry.kind as LiveframeError["kind"], pointer: entry.pointer };
    });
    expected = { ok: false, errors };
  }
  return {
    label: relative(corpusRoot, file),
    format,
    file,
    inputs,
    doc: undefined,
    support: {},
    options: options as CorpusCase["options"],
    expect: expected,
  };
}

async function loadCases(): Promise<readonly CorpusCase[]> {
  const files = [...new Bun.Glob("*/*.json").scanSync({ cwd: corpusRoot, onlyFiles: true })]
    .filter((file) => !file.startsWith("common/"))
    .sort();
  const cache = new Map<string, Promise<unknown>>();
  const read = (path: string) => {
    let value = cache.get(path);
    if (!value) {
      value = readJson(path);
      cache.set(path, value);
    }
    return value;
  };
  const cases: CorpusCase[] = [];
  for (const name of files) {
    const file = join(corpusRoot, name);
    const parsed = parseCase(file, await read(file));
    const support: Record<string, unknown> = {};
    for (const [role, path] of Object.entries(parsed.inputs)) {
      if (role === "doc") continue;
      if (!SUPPORT_ROLES.has(role)) fail(parsed.label, `unknown input role ${role}`);
      support[role] = await read(documentPath(file, path));
    }
    const docPath = parsed.inputs.doc;
    if (!docPath) fail(parsed.label, "inputs.doc is missing");
    cases.push({ ...parsed, doc: await read(documentPath(file, docPath)), support });
  }
  return cases;
}

const cases = await loadCases();

function runner(corpusCase: CorpusCase): Result<unknown> {
  const support = corpusCase.support;
  switch (corpusCase.format) {
    case "catalog":
      return validateCatalog(corpusCase.doc);
    case "theme":
      return validateTheme(corpusCase.doc, support.vocabulary as never);
    case "design-system": {
      const registry: Record<string, unknown> = {};
      const doc = corpusCase.doc;
      if (record(doc) && typeof doc.id === "string") registry[doc.id] = doc;
      const parent = support.designSystem;
      if (record(parent) && typeof parent.id === "string") registry[parent.id] = parent;
      return validateDesignSystem(corpusCase.doc, { catalog: support.catalog as never, registry: registry as never });
    }
    case "capabilities":
      return validateCapabilities(corpusCase.doc);
    case "manifest":
      return validateManifest(corpusCase.doc, {
        catalog: support.catalog as never,
        capabilities: support.capabilities as never,
      });
    case "package":
      return validateWidgetPackageShape(corpusCase.doc);
    case "placement":
      return validatePlacement(corpusCase.doc);
    case "style-record":
      return validateStyleRecord(corpusCase.doc);
    case "ui-tree": {
      const validator = compileValidator({
        catalog: support.catalog as never,
        capabilities: support.capabilities as never,
        manifest: support.manifest as never,
      });
      return validator.validateTree(corpusCase.doc, corpusCase.options);
    }
    case "elements": {
      const validator = compileValidator({
        catalog: support.catalog as never,
        capabilities: support.capabilities as never,
        manifest: support.manifest as never,
      });
      return renderElements(corpusCase.doc, {
        validator,
        surfaceId: "corpus",
        revision: 1,
        ...corpusCase.options,
      });
    }
  }
}

function pair(error: ExpectedError): string {
  return `${error.kind}\u0000${error.pointer}`;
}

function checkCase(corpusCase: CorpusCase): void {
  const result = runner(corpusCase);
  if (corpusCase.expect.ok) {
    if (!result.ok)
      fail(
        corpusCase.label,
        `expected ok, got ${result.errors.map((error) => `${error.kind} ${error.pointer}`).join("; ")}`,
      );
    return;
  }
  if (result.ok) fail(corpusCase.label, "expected failure, got ok");
  if (result.errors.length > 20) fail(corpusCase.label, `returned ${result.errors.length} errors; the bound is 20`);
  const actual = new Set(result.errors.map(pair));
  const expected = new Set(corpusCase.expect.errors.map(pair));
  if (actual.size !== expected.size || [...expected].some((entry) => !actual.has(entry)))
    fail(
      corpusCase.label,
      `expected ${[...expected].join(" | ") || "no errors"}, got ${[...actual].join(" | ") || "no errors"}`,
    );
}

test("corpus_cases_match_validators", () => {
  expect(new Set(cases.map((corpusCase) => corpusCase.format))).toEqual(new Set(FORMATS));
  for (const corpusCase of cases) checkCase(corpusCase);
});

test("corpus_covers_every_validator_error_kind", async () => {
  const covered = new Set<string>();
  for (const corpusCase of cases)
    if (corpusCase.expect.ok === false)
      for (const error of corpusCase.expect.errors) covered.add(`${corpusCase.format}/${error.kind}`);
  for (const format of FORMATS)
    for (const kind of FORMAT_KINDS[format])
      expect(covered.has(`${format}/${kind}`), `${format} has no failing ${kind} case`).toBe(true);

  const source = await Bun.file(new URL("../errors.ts", import.meta.url)).text();
  const start = source.indexOf("readonly kind:");
  const end = source.indexOf(";", start);
  const declared = new Set([...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  const classified = new Set<string>([...FORMATS.flatMap((format) => FORMAT_KINDS[format]), ...NON_FORMAT_KINDS]);
  expect(declared).toEqual(classified);
});
