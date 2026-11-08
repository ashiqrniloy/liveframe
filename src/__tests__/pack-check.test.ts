import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Catalog, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { checkPackages, pack } from "../pack/index.ts";
import { templateRunner } from "../preview/index.ts";
import type { Runner } from "../preview/runner.ts";
import { fileStore } from "../store/fs/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import { agentHomeTemplate } from "./fixtures/templates/agent-home.ts";
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const install = { catalog, capabilities };
const widget = proofWidgets[0];
if (!widget) throw new Error("Missing agent-home fixture");
const templatePackage = value(
  pack({ template: agentHomeTemplate, manifest: widget.manifest, scenarios: widget.scenarios }, install),
);
const codePackage = value(pack(drafts[1] as NonNullable<(typeof drafts)[number]>, install));

/** The catalog with one kind taken out, and the same id: what a careless "minor" release would ship. */
function without(kind: string): Catalog {
  const doc = { ...catalogDoc, definitions: catalogDoc.definitions.filter((definition) => definition.kind !== kind) };
  return value(validateCatalog(doc));
}

test("removed_kind_breaks_dependent_package", async () => {
  expect(JSON.stringify(agentHomeTemplate)).toContain('"separator"');
  const [template, code] = await checkPackages([templatePackage, codePackage], {
    catalog: without("separator"),
    capabilities,
  });
  expect(template).toMatchObject({
    id: templatePackage.manifest.id,
    version: templatePackage.manifest.version,
    hash: templatePackage.hash,
    ok: false,
  });
  expect(template?.errors.length).toBeGreaterThan(0);
  // Without a runner a code package is verified, not rendered, so a removed kind is invisible to it.
  expect(code?.ok).toBe(true);
});

test("minor_catalog_change_keeps_packages_ok", async () => {
  const next = value(validateCatalog({ ...catalogDoc, description: "Reworded, nothing else changed" }));
  const report = await checkPackages([templatePackage, codePackage], {
    catalog: next,
    capabilities,
    runner: templateRunner(),
  });
  // The template package renders; the code package is refused by templateRunner, which is the host's choice to pair.
  expect(report[0]).toMatchObject({ ok: true, errors: [] });
  expect(report[1]?.ok).toBe(false);
  const rendered = await checkPackages([templatePackage], { catalog: next, capabilities });
  expect(rendered[0]?.ok).toBe(true);
});

test("scenario_render_failure_reported", async () => {
  const failing: Runner = {
    async render(_pkg, inputs) {
      if (inputs.params === undefined) throw new Error("unreachable");
      return { ok: false, errors: [{ kind: "render-failed", pointer: "/x", message: "widget threw" }] };
    },
  };
  const [failed] = await checkPackages([codePackage], { ...install, runner: failing });
  expect(failed?.ok).toBe(false);
  expect(failed?.errors[0]).toMatchObject({ kind: "render-failed", pointer: "/scenarios/0/x" });

  const throwing: Runner = {
    async render() {
      throw new Error("runner down");
    },
  };
  const [thrown] = await checkPackages([codePackage], { ...install, runner: throwing });
  expect(thrown?.errors[0]).toMatchObject({ kind: "render-failed", pointer: "/scenarios/0", message: "runner down" });

  // A tree the host validator rejects is a failure whatever the runner said.
  const invalid: Runner = {
    async render(_pkg, _inputs, options) {
      return {
        ok: true,
        value: {
          format: "liveframe-tree/1",
          surfaceId: options.surfaceId,
          revision: 1,
          catalogId: "x@1",
          root: { kind: "nope" },
        } as never,
      };
    },
  };
  const [rejected] = await checkPackages([codePackage], { ...install, runner: invalid });
  expect(rejected?.ok).toBe(false);
});

test("untrusted_documents_are_reported_not_thrown", async () => {
  const report = await checkPackages([null, { manifest: { id: "a", version: "1" }, hash: "h" }, "x"], install);
  expect(report.map((entry) => entry.ok)).toEqual([false, false, false]);
  expect(report[1]).toMatchObject({ id: "a", version: "1", hash: "h" });
  expect(report[0]).toMatchObject({ id: "", version: "", hash: "" });
});

const cleanup: string[] = [];
afterEach(async () => {
  for (const dir of cleanup.splice(0)) await rm(dir, { recursive: true, force: true });
});

test("cli_prints_report", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-check-"));
  cleanup.push(dir);
  const store = fileStore(join(dir, "data"));
  await store.putPackage(templatePackage);
  await store.putPackage(codePackage);
  await Bun.write(join(dir, "catalog.json"), JSON.stringify(catalogDoc));
  await Bun.write(
    join(dir, "broken.json"),
    JSON.stringify({ ...catalogDoc, definitions: catalogDoc.definitions.filter((d) => d.kind !== "separator") }),
  );
  await Bun.write(join(dir, "capabilities.json"), JSON.stringify(capabilitiesDoc));
  const run = async (catalogFile: string) => {
    const proc = Bun.spawn(
      [
        "bun",
        "src/cli/liveframe.ts",
        "check-packages",
        join(dir, "data"),
        "--catalog",
        join(dir, catalogFile),
        "--capabilities",
        join(dir, "capabilities.json"),
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
    return { report: JSON.parse(out) as { id: string; ok: boolean }[], code };
  };
  const good = await run("catalog.json");
  expect(good.code).toBe(0);
  expect(good.report.map((entry) => entry.ok)).toEqual([true, true]);
  const bad = await run("broken.json");
  expect(bad.code).toBe(1);
  expect(bad.report.filter((entry) => !entry.ok).map((entry) => entry.id)).toEqual([templatePackage.manifest.id]);
});
