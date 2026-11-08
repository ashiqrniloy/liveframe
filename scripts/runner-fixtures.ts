#!/usr/bin/env bun

/**
 * Writes (or with `--check` verifies) `conformance/runner/fixtures.json`, the language-neutral form of
 * the fixtures `runnerSuite()` runs: its catalog, capabilities, packages and probe table.
 */
import { runnerFixtureDocument } from "../src/conformance/runner-fixtures.ts";

const file = new URL("../conformance/runner/fixtures.json", import.meta.url);
const text = `${JSON.stringify(runnerFixtureDocument(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (
    (await Bun.file(file)
      .text()
      .catch(() => "")) !== text
  ) {
    console.error("conformance/runner/fixtures.json is stale: run bun scripts/runner-fixtures.ts");
    process.exit(1);
  }
} else {
  await Bun.write(file, text);
}
