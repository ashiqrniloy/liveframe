// The agent digest of a catalog (spec §7.2; plan 039 Task 3, design G.1–G.8).
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ephemeralManifest, renderElements } from "@arnilo/liveframe/sdk";
import starterCatalogJson from "../../packages/starter/src/catalog.json" with { type: "json" };
import { LiveframeFailure } from "../errors.ts";
import { validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { compileValidator } from "../index.ts";
import type { Result } from "../errors.ts";
import { bool, obj, str } from "../schema.ts";
import { generateDigest } from "../sdk/gen.ts";
import catalogJson from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesJson from "./fixtures/widgets/capabilities.json" with { type: "json" };

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const catalog = valid(validateCatalog(catalogJson));
const starter = valid(validateCatalog(starterCatalogJson));
const capabilities = valid(validateCapabilities(capabilitiesJson));
const local = obj({ q: str({ maxLength: 80 }), expanded: bool() });

/** The text from one `### kind` heading to the next heading. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n${heading}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = text.indexOf("\n#", start + heading.length + 2);
  return text.slice(start, end < 0 ? undefined : end);
}

test("digest_names_every_kind_prop_variant_event_action_and_source", () => {
  for (const [subject, caps] of [
    [catalog, capabilities],
    [starter, undefined],
  ] as const) {
    const text = generateDigest(subject, caps ? { capabilities: caps } : {});
    expect(text.startsWith(`# ${subject.catalogId}\n`)).toBe(true);
    for (const d of subject.definitions) {
      const kind = section(text, `### ${d.kind}${d.deprecated ? ` (deprecated: ${d.deprecated})` : ""}`);
      expect(kind).toContain(d.description);
      for (const prop of Object.keys(d.props.properties)) expect(kind).toMatch(new RegExp(`[ ;]${prop}\\??: `));
      for (const variant of d.variants.length > 1 ? d.variants : []) expect(kind).toContain(variant);
      for (const event of Object.keys(d.events)) expect(kind).toContain(`${event}(`);
      for (const name of d.styleProps) expect(kind).toContain(name);
      if (typeof d.children !== "string")
        for (const rule of d.children) expect(kind).toContain(`${rule.kind} ${rule.min}..${rule.max}`);
    }
    for (const name of Object.keys(caps?.actions ?? {})) expect(section(text, "## Actions")).toContain(`- ${name}(`);
    for (const name of Object.keys(caps?.sources ?? {})) expect(section(text, "## Sources")).toContain(`- ${name}(`);
  }
});

/** A deep copy with every object's keys in reverse order; arrays keep theirs. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reversed(child)]),
  );
}

test("digest_is_deterministic", () => {
  const options = { capabilities, local };
  const text = generateDigest(catalog, options);
  expect(generateDigest(catalog, options)).toBe(text);
  const shuffled = {
    capabilities: valid(validateCapabilities(reversed(capabilitiesJson))),
    local: reversed(local) as typeof local,
  };
  expect(generateDigest(valid(validateCatalog(reversed(catalogJson))), shuffled)).toBe(text);
  expect(text.endsWith("\n")).toBe(true);
  expect(text.endsWith("\n\n")).toBe(false);
});

test("digest_over_budget_fails_with_the_overrun", () => {
  const length = generateDigest(catalog).length;
  expect(generateDigest(catalog, { budget: length }).length).toBe(length);
  let failure: unknown;
  try {
    generateDigest(catalog, { budget: length - 1 });
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(LiveframeFailure);
  expect((failure as LiveframeFailure).errors).toEqual([
    {
      kind: "limit-exceeded",
      pointer: "/digest",
      message: "The digest is longer than its budget",
      expected: `at most ${length - 1} characters, got ${length}`,
    },
  ]);
});

test("digest_holds_no_paths_and_no_design_values", () => {
  const withMeta = valid(
    validateCapabilities({
      ...capabilitiesJson,
      actions: {
        ...capabilitiesJson.actions,
        "tasks.claim": { ...capabilitiesJson.actions["tasks.claim"], meta: { route: "/srv/internal-claim" } },
      },
    }),
  );
  expect(generateDigest(catalog, { capabilities: withMeta })).not.toContain("internal-claim");
  for (const text of [generateDigest(catalog, { capabilities, local }), generateDigest(starter)]) {
    expect(text).not.toContain(process.cwd());
    expect(text).not.toMatch(/(?:^|[\s"'`(])\/[\w.-]+\/[\w.-]+/m);
    expect(text).not.toContain("file:");
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(text).not.toContain("--lf-");
    expect(text).not.toMatch(/\b(?:oklch|rgb|hsl)a?\(/);
  }
});

/** The digest's example, parsed. */
function example(text: string): unknown {
  const block = /Example:\n\n```json\n([\s\S]*?)```/.exec(text);
  expect(block).not.toBeNull();
  return JSON.parse(block?.[1] ?? "");
}

test("digest_example_renders_through_render_elements", () => {
  for (const subject of [catalog, starter] as Catalog[]) {
    for (const withLocal of [false, true]) {
      const manifest = ephemeralManifest({
        catalogId: subject.catalogId,
        actions: [],
        ...(withLocal ? { local, initialLocal: { q: "", expanded: false } } : {}),
      });
      const validator = compileValidator({ catalog: subject, capabilities, manifest });
      const doc = example(generateDigest(subject, withLocal ? { local } : {}));
      const result = renderElements(doc, { validator, surfaceId: "agent", revision: 0 });
      expect(result.ok ? [] : result.errors).toEqual([]);
      expect(JSON.stringify(doc).includes("local.q")).toBe(withLocal);
    }
  }
});

test("digest_lists_local_keys_only_when_given", () => {
  const without = generateDigest(catalog, { capabilities });
  expect(without).not.toContain("## Expressions");
  expect(without).not.toContain("setLocal");
  expect(without).not.toContain("local.");
  const withLocal = generateDigest(catalog, { capabilities, local });
  expect(section(withLocal, "## Expressions")).toContain("- local.expanded: boolean\n- local.q: string≤80\n");
  expect(withLocal).toContain('"type": "setLocal"');
  for (const operator of ["$contains", "$eq", "$cond", "$path"]) expect(withLocal).toContain(operator);
  expect(withLocal).not.toContain("$filter");
});

test("gen_check_detects_a_stale_digest", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-digest-"));
  try {
    const out = join(dir, "catalog.digest.md");
    const gen = (...flags: string[]) =>
      Bun.spawnSync([
        "bun",
        "src/cli/liveframe.ts",
        "gen",
        "src/__tests__/fixtures/proof/catalog.json",
        "--digest",
        "--out",
        out,
        ...flags,
      ]);
    expect(gen().exitCode).toBe(0);
    expect(await Bun.file(out).text()).toBe(generateDigest(catalog));
    expect(gen("--check").exitCode).toBe(0);
    await Bun.write(out, (await Bun.file(out).text()).replace("### box", "### boxes"));
    const stale = gen("--check");
    expect(stale.exitCode).toBe(1);
    expect(stale.stderr.toString()).toContain("Generated output drift");
    const over = gen("--budget", "100");
    expect(over.exitCode).toBe(1);
    expect(over.stderr.toString()).toContain("at most 100 characters");
    expect(gen("--budget", "lots").exitCode).toBe(2);
    expect(gen("--manifest", out).exitCode).toBe(2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
