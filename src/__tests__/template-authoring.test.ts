import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { createAuthoring } from "../authoring/index.ts";
import { validateManifest } from "../formats/manifest.ts";
import { type Json, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { inProcessRunner, templateRunner } from "../preview/index.ts";
import { createPreview } from "../preview/session.ts";
import { generateTemplateSchema } from "../sdk/gen.ts";
import { OPERATORS } from "../template/expr.ts";
import type { Template } from "../template/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import { coreQueueTemplate } from "./fixtures/templates/core-queue.ts";
import { gitStatusTemplate } from "./fixtures/templates/git-status.ts";
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const widget = proofWidgets[0];
if (!widget) throw new Error("Missing agent-home fixture");
const draft = { template: agentHomeTemplate, manifest: widget.manifest, scenarios: widget.scenarios };
const scenario = widget.scenarios[0]?.name as string;

// ---- Preview session and authoring ------------------------------------------------------------------

test("preview_session_renders_template_draft", async () => {
  const session = createPreview({ catalog, capabilities, runner: templateRunner() });
  const packed = value(session.update(draft));
  expect(packed.template).toEqual(agentHomeTemplate);
  expect(packed.code).toBeUndefined();
  const rendered = value(await session.render({ scenario }));
  // The same draft through the in-process runner gives the same tree: one packer, one renderer.
  const other = createPreview({ catalog, capabilities, runner: inProcessRunner() });
  value(other.update(draft));
  const baseline = value(await other.render({ scenario }));
  const anonymous = (tree: object) => JSON.stringify({ ...tree, surfaceId: "", revision: 0 });
  expect(anonymous(rendered)).toBe(anonymous(baseline));
  // Every scenario renders, and a setState intent re-renders from the new state.
  const checked = value(await session.check());
  expect(checked.map(({ result }) => result.ok)).toEqual(widget.scenarios.map(() => true));
  const filtered = await session.intent({ type: "setState", key: "filter", value: "tasks" });
  expect(filtered.ok).toBe(true);
  expect(JSON.stringify(filtered)).not.toBe(JSON.stringify(rendered));
});

test("preview_session_template_errors_keep_the_previous_draft", async () => {
  const session = createPreview({ catalog, capabilities, runner: templateRunner() });
  value(session.update(draft));
  const broken = JSON.parse(JSON.stringify(agentHomeTemplate).replace('"state.filter"', '"state.nope"')) as Template;
  const failed = session.update({ ...draft, template: broken });
  expect(failed.ok).toBe(false);
  if (!failed.ok)
    expect(failed.errors).toContainEqual(
      expect.objectContaining({ kind: "unknown-name", pointer: expect.stringMatching(/^\/template\/root\//) }),
    );
  expect((await session.render({ scenario })).ok).toBe(true);
});

test("template_runner_session_refuses_a_code_draft_at_render", async () => {
  const session = createPreview({ catalog, capabilities, runner: templateRunner() });
  value(session.update(drafts[0] as NonNullable<(typeof drafts)[number]>));
  const rendered = await session.render({ scenario });
  expect(rendered.ok).toBe(false);
  if (!rendered.ok) expect(rendered.errors).toContainEqual(expect.objectContaining({ pointer: "/code" }));
});

test("authoring_packs_and_renders_a_template_draft", async () => {
  const authoring = createAuthoring({ catalog, capabilities, runner: templateRunner() });
  try {
    const packed = value(await authoring.packDraft(draft));
    expect(packed).toMatchObject({ id: (widget.manifest as { id: string }).id });
    const tree = value(await authoring.renderScenarios({ scenario }));
    expect(tree).toMatchObject({ format: "liveframe/1" });
    // Exactly one of files and template.
    const both = await authoring.packDraft({ ...draft, files: { "a.ts": "" }, entry: "a.ts" } as never);
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.errors.map((error) => error.pointer).sort()).toEqual(["/entry", "/files"]);
    const neither = await authoring.packDraft({ manifest: draft.manifest, scenarios: draft.scenarios } as never);
    expect(neither.ok).toBe(false);
    if (!neither.ok) expect(neither.errors.map((error) => error.pointer)).toContain("/files");
  } finally {
    await authoring.close();
  }
});

test("authoring_template_schema_is_the_generated_schema", async () => {
  const authoring = createAuthoring({ catalog, capabilities, runner: templateRunner() });
  try {
    const manifest = widget.manifest as never;
    const plain = value(await authoring.generatedTypes({ module: "templateSchema" }));
    expect(plain.types).toBe(generateTemplateSchema(catalog, { capabilities }));
    expect(plain.note).toContain("template.schema.json");
    const narrowed = value(await authoring.generatedTypes({ module: "templateSchema", manifest }));
    expect(narrowed.types).toBe(
      generateTemplateSchema(catalog, { capabilities, manifest: value(validManifest(widget.manifest)) }),
    );
    const bad = await authoring.generatedTypes({ module: "templateSchema", manifest: { id: "Bad Id" } });
    expect(bad.ok).toBe(false);
  } finally {
    await authoring.close();
  }
});

function validManifest(doc: unknown) {
  return validateManifest(doc, { catalog, capabilities });
}

// ---- The generated template schema ------------------------------------------------------------------

function ajv(): Ajv2020 {
  return new Ajv2020({ strict: false, allErrors: false });
}

const proofTemplates = [
  ["agent-home", agentHomeTemplate],
  ["core-queue", coreQueueTemplate],
  ["git-status", gitStatusTemplate],
] as const;

/** Forbidden-keyword scan over schema positions only (not property names). */
function keywords(schema: unknown, found: Set<string> = new Set()): Set<string> {
  if (!schema || typeof schema !== "object") return found;
  if (Array.isArray(schema)) {
    for (const item of schema) keywords(item, found);
    return found;
  }
  for (const [key, child] of Object.entries(schema)) {
    found.add(key);
    if (key === "properties" || key === "$defs")
      for (const member of Object.values(child as object)) keywords(member, found);
    else if (key !== "enum" && key !== "const") keywords(child, found);
  }
  return found;
}

test("template_schema_validates_proof_templates", () => {
  const manifestFor = (name: string) => proofWidgets.find((fixture) => fixture.name === name)?.manifest;
  for (const [name, template] of proofTemplates) {
    // Without a manifest the schema checks kinds, props, style, events and operators, not paths.
    const generic = ajv().compile(JSON.parse(generateTemplateSchema(catalog)));
    expect(generic(template), `${name}: ${JSON.stringify(generic.errors?.[0])}`).toBe(true);
    const manifest = value(validManifest(manifestFor(name)));
    const narrowed = ajv().compile(JSON.parse(generateTemplateSchema(catalog, { capabilities, manifest })));
    expect(narrowed(template), `${name}: ${JSON.stringify(narrowed.errors?.[0])}`).toBe(true);
  }
});

test("template_schema_rejects_what_install_would", () => {
  const manifest = value(validManifest(widget.manifest));
  const validate = ajv().compile(JSON.parse(generateTemplateSchema(catalog, { capabilities, manifest })));
  const text = (body: Json): Json => ({
    format: "liveframe-template/1",
    root: { kind: "text", props: { text: body } },
  });
  expect(validate(text("hello"))).toBe(true);
  expect(validate(text({ $path: "state.filter" }))).toBe(true);
  // A name bound by a loop is not a root: a path into it is not enumerated.
  expect(validate(text({ $concat: [{ $path: "state.filter" }, "!"] }))).toBe(true);
  expect(validate(text({ $path: "state.nope" }))).toBe(false); // not a path of this manifest
  expect(validate(text({ $bogus: 1 }))).toBe(false); // not an operator
  expect(validate(text({ $eq: [1] }))).toBe(false); // wrong arity
  expect(validate({ format: "liveframe-template/1", root: { kind: "nope" } })).toBe(false);
  expect(validate({ format: "liveframe-template/1", root: { kind: "text", props: { nope: "x" } } })).toBe(false);
  expect(validate({ format: "liveframe-template/1", root: { kind: "text", props: {}, style: { nope: 1 } } })).toBe(
    false,
  );
  expect(validate({ format: "liveframe-template/2", root: { kind: "text", props: { text: "x" } } })).toBe(false);
});

test("template_schema_names_exactly_the_operators_the_evaluator_has", () => {
  const schema = JSON.parse(generateTemplateSchema(catalog)) as {
    $defs: { operator: { anyOf: { required: string[] }[] } };
  };
  const names = schema.$defs.operator.anyOf.map((branch) => branch.required[0]);
  expect([...names].sort()).toEqual([...OPERATORS].sort());
});

test("template_schema_with_manifest_lists_paths_state_keys_and_actions", () => {
  const manifest = value(validManifest(widget.manifest));
  const schema = JSON.parse(generateTemplateSchema(catalog, { capabilities, manifest })) as {
    $defs: {
      operator: { anyOf: { properties: Record<string, { anyOf?: { enum?: string[] }[] }> }[] };
      intent: {
        anyOf: { properties: { type: { const: string }; key?: { enum: string[] }; name?: { const: string } } }[];
      };
    };
  };
  const pathBranch = schema.$defs.operator.anyOf.find((branch) => "$path" in branch.properties);
  const paths = pathBranch?.properties.$path?.anyOf?.[0]?.enum ?? [];
  expect(paths).toEqual(expect.arrayContaining(["state", "state.filter", "params", "context", "data", "data.groups"]));
  const setState = schema.$defs.intent.anyOf.find((branch) => branch.properties.type.const === "setState");
  expect(setState?.properties.key?.enum).toEqual(Object.keys(manifest.state.properties));
  const actions = schema.$defs.intent.anyOf
    .filter((branch) => branch.properties.type.const === "action")
    .map((branch) => branch.properties.name?.const);
  expect(actions).toEqual([...manifest.actions]);
});

test("template_schema_is_deterministic", () => {
  const manifest = value(validManifest(widget.manifest));
  const options = { capabilities, manifest };
  expect(generateTemplateSchema(catalog, options)).toBe(generateTemplateSchema(catalog, options));
  expect(generateTemplateSchema(catalog)).not.toBe(generateTemplateSchema(catalog, options));
});

test("structured_subset_drops_constraint_keywords_and_keeps_the_shape", () => {
  const full = JSON.parse(generateTemplateSchema(catalog, { capabilities }));
  const subset = JSON.parse(generateTemplateSchema(catalog, { capabilities, structuredSubset: true }));
  const present = keywords(subset);
  for (const dropped of [
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "uniqueItems",
    "patternProperties",
    "propertyNames",
    "oneOf",
    "allOf",
    "not",
    "format",
  ])
    expect(present.has(dropped), dropped).toBe(false);
  expect(keywords(full).has("maxLength")).toBe(true);
  // Every object is closed or an open map of one schema, and the subset still accepts the proof templates.
  const validate = ajv().compile(subset);
  for (const [name, template] of proofTemplates) expect(validate(template), name).toBe(true);
  expect(JSON.stringify(subset).length).toBeLessThan(JSON.stringify(full).length);
});

// ---- The CLI ----------------------------------------------------------------------------------------

const fixtures = "src/__tests__/fixtures";

async function gen(args: string[]): Promise<{ code: number; stderr: string }> {
  const child = Bun.spawn(["bun", "--conditions", "liveframe:source", "src/cli/liveframe.ts", "gen", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => child.kill(), 20_000);
  try {
    const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    return { code, stderr };
  } finally {
    clearTimeout(timer);
  }
}

test("template_schema_cli_matches_function", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-template-schema-"));
  const input = `${fixtures}/proof/catalog.json`;
  const caps = `${fixtures}/widgets/capabilities.json`;
  const manifestFile = join(dir, "manifest.json");
  await Bun.write(manifestFile, JSON.stringify(widget.manifest));
  try {
    const cases = [
      { flags: [], options: {} },
      { flags: ["--capabilities", caps], options: { capabilities } },
      {
        flags: ["--capabilities", caps, "--manifest", manifestFile],
        options: { capabilities, manifest: value(validManifest(widget.manifest)) },
      },
      { flags: ["--structured-subset"], options: { structuredSubset: true } },
    ];
    for (const { flags, options } of cases) {
      const out = join(dir, "schema.json");
      const run = await gen([input, "--template-schema", ...flags, "--out", out]);
      expect(run.code, run.stderr).toBe(0);
      expect(await Bun.file(out).text()).toBe(generateTemplateSchema(catalog, options));
      // --check passes on its own output and fails on drift.
      expect((await gen([input, "--template-schema", ...flags, "--out", out, "--check"])).code).toBe(0);
      await Bun.write(out, "{}\n");
      expect((await gen([input, "--template-schema", ...flags, "--out", out, "--check"])).code).toBe(1);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);

test("template_schema_cli_usage_errors", async () => {
  const input = `${fixtures}/proof/catalog.json`;
  const out = join(tmpdir(), "liveframe-never-written.json");
  // Template flags need --template-schema; the three emitters are exclusive; a manifest needs its capabilities.
  for (const flags of [
    ["--structured-subset"],
    ["--manifest", "m.json"],
    ["--template-schema", "--elements-schema"],
    ["--template-schema", "--implementations"],
    ["--template-schema", "--structured-subset", "--structured-subset"],
  ]) {
    const run = await gen([input, ...flags, "--out", out]);
    expect(run.code, flags.join(" ")).toBe(2);
  }
  const needsCapabilities = await gen([
    input,
    "--template-schema",
    "--manifest",
    `${fixtures}/proof/agent-home.manifest.json`,
    "--out",
    out,
  ]);
  expect(needsCapabilities.code).toBe(2);
  expect(needsCapabilities.stderr).toContain("--manifest needs --capabilities");
});
