import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Catalog } from "../formats/catalog.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import { defineComponent, validateCatalog } from "../formats/catalog.ts";
import { validateManifest } from "../formats/manifest.ts";
import { obj, str } from "../schema.ts";
import { type Elements, ephemeralManifest, renderElements } from "@arnilo/liveframe/sdk";
import { compileValidator } from "../index.ts";
import { renderWorkloads } from "./fixtures/render-workloads.ts";
import { toElements } from "../../scripts/fixtures/elements.ts";
import catalogJson from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import cases from "./fixtures/elements.json" with { type: "json" };
import { generateElementsSchema } from "../sdk/gen.ts";

const installed = validateCatalog(catalogJson);
if (!installed.ok) throw new Error(JSON.stringify(installed.errors));
const validator = compileValidator({ catalog: installed.value, capabilities, manifest });
const workloads = renderWorkloads();

test("render_elements_matches_render_for_fixtures", () => {
  expect(cases.map((entry) => entry.name)).toEqual(workloads.map((entry) => entry.name));
  for (const [index, entry] of cases.entries()) {
    const workload = workloads[index];
    if (!workload) throw new Error("Missing workload");
    expect(entry.elements as unknown).toEqual(toElements(workload.run(0).root));
    const result = renderElements(entry.elements, {
      validator: workload.validator,
      surfaceId: "proof",
      revision: 0,
    });
    if (!result.ok) throw new Error(`${entry.name}: ${JSON.stringify(result.errors)}`);
    expect(result.value).toEqual(workload.run(0));
  }
});

test("render_elements_error_pointers_into_json", () => {
  const cases: readonly [unknown, string, string, number?][] = [
    [{ kind: "nope", props: {} }, "unknown-component", ""],
    [{ kind: "text", props: { text: "x" }, bogus: 1 }, "invalid-prop", "/bogus"],
    [{ kind: "text", props: { text: 1 } }, "invalid-prop", "/props/text"],
    [
      { kind: "text", props: { text: "x" }, children: [{ kind: "text", props: { text: "y" } }] },
      "invalid-children",
      "/children",
    ],
    [
      {
        kind: "stack",
        props: {},
        children: [
          { kind: "text", key: "a", props: { text: "x" } },
          { kind: "text", key: "a", props: { text: "y" } },
        ],
      },
      "duplicate-key",
      "/children/1",
    ],
    [
      {
        kind: "stack",
        props: {},
        children: [
          { kind: "text", props: { text: "x" } },
          { kind: "text", props: { text: "y" } },
        ],
      },
      "missing-key",
      "/children/1",
    ],
    [
      { kind: "stack", props: {}, children: [{ kind: "text", props: { text: "x" } }] },
      "limit-exceeded",
      "/children/0",
      1,
    ],
    [{ kind: "text", props: { text: "x" }, children: {} }, "invalid-prop", "/children"],
  ];
  for (const [input, kind, pointer, nodes] of cases) {
    const result = renderElements(input, {
      validator,
      surfaceId: "proof",
      revision: 0,
      ...(nodes === undefined ? {} : { limits: { nodes } }),
    });
    if (result.ok) throw new Error(`Expected ${kind} at ${pointer}`);
    expect(result.errors).toContainEqual(expect.objectContaining({ kind, pointer }));
  }
});

test("ephemeral_manifest_validates", () => {
  const ephemeral = ephemeralManifest({
    catalogId: catalogJson.catalogId,
    actions: ["tasks.claim"],
    state: { selected: "task:0", open: true, count: 1 },
  });
  const checked = validateManifest(ephemeral, {
    catalog: catalogJson as Catalog,
    capabilities: capabilities as Capabilities,
  });
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  const compiled = compileValidator({ catalog: catalogJson, capabilities, manifest: checked.value });
  const result = renderElements(
    {
      kind: "button",
      props: { label: "Claim" },
      events: { onPress: { type: "action", name: "tasks.claim", args: { id: "task:0" } } },
    },
    { validator: compiled, surfaceId: "ephemeral", revision: 0 },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  expect(ephemeral.state.required).toEqual(["selected", "open", "count"]);
  expect(() => ephemeralManifest({ catalogId: catalogJson.catalogId, actions: [], state: null as never })).toThrow(
    "state object",
  );
  expect(() =>
    ephemeralManifest({ catalogId: catalogJson.catalogId, actions: [], state: { nested: { bad: null } } as never }),
  ).toThrow("not null");
});

test("elements_schema_deterministic_and_drift_checked", async () => {
  const schema = generateElementsSchema(installed.value);
  expect(generateElementsSchema(installed.value)).toBe(schema);
  expect(schema).toBe(await Bun.file("src/__tests__/fixtures/widgets/elements.schema.json").text());
  const ajv = new Ajv2020({ strict: true });
  const validate = ajv.compile(JSON.parse(schema));
  for (const entry of cases) {
    if (!validate(entry.elements)) throw new Error(`${entry.name}: ${JSON.stringify(validate.errors?.slice(0, 3))}`);
  }
});

const small = {
  format: "liveframe-catalog/1",
  catalogId: "test.elements@1",
  description: "Element type fixture.",
  vocabulary: {
    colourRoles: ["text.primary", "surface.base"],
    surfaceRoles: ["surface.base"],
    fillableRoles: [],
    typographyRoles: ["body"],
    space: ["space.1"],
    radius: ["radius.control"],
    size: ["size.glyph"],
    breakpoints: ["bp.sm"],
    tones: { default: "text.primary" },
    surfaceTypography: "body",
  },
  definitions: [
    defineComponent({
      kind: "label",
      description: "One label.",
      props: obj({ text: str({ maxLength: 80 }) }),
      children: "none",
      variants: ["default", "muted"],
      defaultVariant: "default",
      slots: ["root"],
      events: {},
      styleProps: ["tone"],
      a11y: { role: "paragraph" },
    }),
  ],
} as const satisfies Catalog;

test("cli_writes_and_checks_elements_schema", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-elements-"));
  const out = join(dir, "elements.schema.json");
  const run = async (...args: string[]) => {
    const child = Bun.spawn([process.execPath, "--conditions", "liveframe:source", "src/cli/liveframe.ts", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const timer = setTimeout(() => child.kill(), 10_000);
    try {
      return { code: await child.exited, stderr: await new Response(child.stderr).text() };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    expect(
      (await run("gen", "src/__tests__/fixtures/proof/catalog.json", "--elements-schema", "--out", out)).code,
    ).toBe(0);
    expect(await Bun.file(out).text()).toBe(generateElementsSchema(installed.value));
    expect(
      (await run("gen", "src/__tests__/fixtures/proof/catalog.json", "--elements-schema", "--out", out, "--check"))
        .code,
    ).toBe(0);
    await Bun.write(out, "drift");
    const drift = await run(
      "gen",
      "src/__tests__/fixtures/proof/catalog.json",
      "--elements-schema",
      "--out",
      out,
      "--check",
    );
    expect(drift.code).toBe(1);
    expect(drift.stderr).toContain("drift");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("elements_type_and_schema_agree", () => {
  const installed = validateCatalog(small);
  if (!installed.ok) throw new Error(JSON.stringify(installed.errors));
  const doc = { kind: "label", variant: "muted", props: { text: "Hi" } } satisfies Elements<typeof small>;
  const validate = new Ajv2020({ strict: true }).compile(JSON.parse(generateElementsSchema(installed.value)));
  expect(validate(doc)).toBe(true);
  // @ts-expect-error only declared kinds
  const wrongKind = { kind: "missing" } satisfies Elements<typeof small>;
  expect(validate(wrongKind)).toBe(false);
  // @ts-expect-error a schema-declared prop is required in the type
  const wrongProps = { kind: "label", props: { text: 1 } } satisfies Elements<typeof small>;
  expect(validate(wrongProps)).toBe(false);
});
