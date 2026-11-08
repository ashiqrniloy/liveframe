import { expect, test } from "bun:test";
import { runnerSuite } from "@arnilo/liveframe/conformance";
import { quickjsRunner } from "../index.ts";
import { install, packages } from "./fixtures.ts";

// The contract cases and the isolation cases: the runner proves the claims it makes.
for (const c of runnerSuite({ runner: () => quickjsRunner({ timeoutMs: 100 }), ...install, packages, isolation: true }))
  test(c.name, c.run, c.timeout);

test("suite_is_not_empty", () => {
  expect(runnerSuite({ runner: () => quickjsRunner(), ...install, packages, isolation: true }).length).toBeGreaterThan(
    15,
  );
});
