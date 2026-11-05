import { strict as assert } from "node:assert";
import {
  validateCapabilities,
  validateCatalog,
  validateDesignSystem,
  validateManifest,
  validateTheme,
} from "../src/index.ts";
import { metric } from "./metrics.ts";

const fixture = async (name: string) =>
  Bun.file(new URL(`../src/__tests__/fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog = await fixture("catalog");
const capabilities = await fixture("capabilities");
const manifest = await fixture("agent-home.manifest");
const theme = await fixture("certified.theme");
const designSystem = await fixture("certified.design-system");
const checks = {
  catalog: () => validateCatalog(catalog),
  capabilities: () => validateCapabilities(capabilities),
  manifest: () => validateManifest(manifest, { catalog, capabilities }),
  theme: () => validateTheme(theme, catalog.vocabulary),
  designSystem: () => validateDesignSystem(designSystem, { catalog, registry: {} }),
};
for (const [name, check] of Object.entries(checks)) {
  for (let i = 0; i < 30; i++) assert(check().ok, name);
  const samples: number[] = [];
  for (let i = 0; i < 101; i++) {
    const start = performance.now();
    for (let j = 0; j < 10; j++) assert(check().ok, name);
    samples.push((performance.now() - start) / 10);
  }
  samples.sort((a, b) => a - b);
  const median = samples[50];
  assert(median !== undefined);
  metric(`${name}.medianMs`, median);
  console.log(`${name}: ${median.toFixed(4)} ms`);
}
