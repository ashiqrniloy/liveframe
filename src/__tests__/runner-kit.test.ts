import { expect, test } from "bun:test";
import { render } from "@arnilo/liveframe/sdk";
import { linkPackage, renderModule } from "@arnilo/liveframe/runner-kit";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import { pack } from "../pack/index.ts";
import { cachedValidatorCount } from "../runner-kit/cache.ts";
import { loadModule } from "../preview/load.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { drafts } from "./fixtures/widgets/drafts.ts";
import { proofWidgets } from "./fixtures/widgets/index.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities, surfaceId: "kit", revision: 1 };
const sdkLine = 'import * as __lf_sdk0 from "@arnilo/liveframe/sdk";';
const sandbox = (specifier: string) => `sandbox:${specifier}`;

test("link_package_rewrites_only_canonical_header", () => {
  const code = `${sdkLine}
import * as __lf_sdk1 from "@arnilo/liveframe/sdk/jsx-runtime";
import * as __lf_sdk2 from "@arnilo/liveframe/sdk/jsx-dev-runtime";
const text = \`
${sdkLine}
\`;
export default [text, "@arnilo/liveframe/sdk"];`;
  const linked = value(linkPackage(code, sandbox));
  expect(linked).toBe(
    code
      .replace(sdkLine, 'import * as __lf_sdk0 from "sandbox:@arnilo/liveframe/sdk";')
      .replace('"@arnilo/liveframe/sdk/jsx-runtime"', '"sandbox:@arnilo/liveframe/sdk/jsx-runtime"')
      .replace('"@arnilo/liveframe/sdk/jsx-dev-runtime"', '"sandbox:@arnilo/liveframe/sdk/jsx-dev-runtime"'),
  );
  // A header-only package ends without a newline.
  expect(value(linkPackage(sdkLine, sandbox))).toBe('import * as __lf_sdk0 from "sandbox:@arnilo/liveframe/sdk";');
  // Code with no SDK imports, including bare non-header imports, is returned as it came.
  for (const plain of ["export default 1;", `export default () => 1;\n${sdkLine}`, ""])
    expect(value(linkPackage(plain, sandbox))).toBe(plain);
});

test("link_package_rewrites_what_pack_emits", () => {
  for (const draft of drafts) {
    const packed = value(pack(draft, options));
    const linked = value(linkPackage(packed.code, sandbox));
    expect(linked).toContain('"sandbox:@arnilo/liveframe/sdk');
    expect(linked.replaceAll("sandbox:", "")).toBe(packed.code);
  }
});

test("link_package_rejects_missing_header", () => {
  for (const code of [
    'import * as __lf_sdk0 from "@arnilo/liveframe/sdk"\nexport default 1;', // no semicolon
    'import * as __lf_sdk0 from "@arnilo/liveframe/other";', // not an SDK specifier
    'import * as __lf_sdk0  from "@arnilo/liveframe/sdk";', // not canonical spacing
    "import * as __lf_sdk0 from '@arnilo/liveframe/sdk';", // single quotes
    'import * as __lf_sdk1 from "@arnilo/liveframe/sdk";', // out of sequence
    `${sdkLine}\n${sdkLine.replace("sdk0", "sdk1")}`, // the same specifier twice
    `${sdkLine}\nimport * as __lf_sdkX from "@arnilo/liveframe/sdk/jsx-runtime";`,
  ]) {
    const result = linkPackage(code, sandbox);
    expect(result, code).toMatchObject({ ok: false, errors: [{ kind: "invalid-document", pointer: "/code" }] });
  }
});

test("render_module_matches_render", async () => {
  for (const [i, fixture] of proofWidgets.entries()) {
    const draft = drafts[i];
    if (!draft) throw new Error("Missing draft");
    const pkg = value(pack(draft, options));
    const module = await loadModule(pkg.code, pkg.hash);
    const validator = compileValidator({ ...options, manifest: pkg.manifest });
    for (const scenario of fixture.scenarios) {
      const expected = render(fixture.widget, scenario, { ...options, validator });
      expect(expected.ok, `${fixture.name}/${scenario.name}`).toBe(true);
      expect(renderModule(module.default, scenario, { ...options, manifest: pkg.manifest })).toEqual(expected);
    }
  }
});

test("render_module_reports_bad_widgets", () => {
  const fixture = proofWidgets[0];
  const draft = drafts[0];
  if (!fixture || !draft) throw new Error("Missing agent-home fixture");
  const current = { ...options, manifest: value(pack(draft, options)).manifest };
  const inputs = fixture.scenarios[0];
  if (!inputs) throw new Error("Missing scenario");
  for (const widget of [
    3,
    undefined,
    () => {
      throw new Error("widget failed");
    },
  ])
    expect(renderModule(widget, inputs, current)).toMatchObject({
      ok: false,
      errors: [{ kind: "render-failed", pointer: "" }],
    });
});

test("render_module_caches_validator_bounded", () => {
  const fixture = proofWidgets[0];
  const draft = drafts[0];
  if (!fixture || !draft) throw new Error("Missing agent-home fixture");
  const manifest = value(pack(draft, options)).manifest;
  const inputs = fixture.scenarios[0];
  if (!inputs) throw new Error("Missing scenario");
  const current = { ...options, catalog: { ...catalog }, capabilities: { ...capabilities } };
  expect(cachedValidatorCount(current.catalog, current.capabilities)).toBe(0);
  // The same manifest, whichever object carries it, shares one validator.
  renderModule(fixture.widget, inputs, { ...current, manifest });
  renderModule(fixture.widget, inputs, { ...current, manifest: structuredClone(manifest) });
  expect(cachedValidatorCount(current.catalog, current.capabilities)).toBe(1);
  for (let i = 0; i <= 64; i++) {
    renderModule(fixture.widget, inputs, { ...current, manifest: { ...manifest, id: `kit-${i}` } });
    expect(cachedValidatorCount(current.catalog, current.capabilities)).toBeLessThanOrEqual(64);
  }
  expect(cachedValidatorCount(current.catalog, current.capabilities)).toBe(64);
});
