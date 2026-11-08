// Run by `bun scripts/release/archive-gate.ts --dir packages/runner-quickjs` in the install directory, outside the
// checkout: the installed package must find its child entry, its wasm and the core's runner-kit bundle on its own,
// and pass the isolation conformance cases the repository's tests run.
import { validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import { runnerSuite } from "@arnilo/liveframe/conformance";
import fixtures from "@arnilo/liveframe/conformance/runner/fixtures.json" with { type: "json" };
import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";

const must = <T>(result: { ok: true; value: T } | { ok: false; errors: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
};
const catalog = must(validateCatalog(fixtures.catalog));
const capabilities = must(validateCapabilities(fixtures.capabilities));
const packages = [fixtures.packages.ok, fixtures.packages.templateOk] as never;

const cases = runnerSuite({
  runner: () => quickjsRunner({ timeoutMs: 100 }),
  catalog,
  capabilities,
  packages,
  isolation: true,
});
let failed = 0;
for (const c of cases) {
  try {
    await c.run();
  } catch (error) {
    failed++;
    console.error(`${c.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`${cases.length - failed}/${cases.length} runner conformance cases pass`);
process.exit(failed === 0 ? 0 : 1);
