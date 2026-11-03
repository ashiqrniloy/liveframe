#!/usr/bin/env bun
/**
 * Fail on a high or critical advisory in a package that the build bundled into `dist/`.
 * `bun audit --prod` cannot see these: they are devDependencies at install time. Run it after `bun run build`.
 *
 *   timeout 60s bun scripts/release/audit-bundled.ts
 */
import { readBundled } from "./sbom.ts";

type Advisory = { id?: unknown; title?: unknown; severity?: unknown; url?: unknown };

/** `bun audit --json` maps a package name to its advisories. */
export function bundledAdvisories(audit: unknown, bundled: readonly string[]): string[] {
  if (typeof audit !== "object" || audit === null || Array.isArray(audit)) throw new Error("Unexpected audit output");
  const failures: string[] = [];
  for (const name of bundled) {
    const advisories = (audit as Record<string, unknown>)[name];
    if (advisories === undefined) continue;
    if (!Array.isArray(advisories)) throw new Error(`Unexpected audit entry for ${name}`);
    for (const advisory of advisories as Advisory[])
      if (advisory.severity === "high" || advisory.severity === "critical")
        failures.push(`${name}: ${String(advisory.severity)} ${String(advisory.title)} ${String(advisory.url)}`);
  }
  return failures;
}

if (import.meta.main) {
  const root = new URL("../../", import.meta.url).pathname;
  const proc = Bun.spawnSync(["bun", "audit", "--json"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  // `bun audit` exits non-zero when it finds advisories, so the output is read either way.
  const text = proc.stdout.toString().trim();
  if (!text) {
    console.error(`bun audit --json printed nothing (exit ${proc.exitCode}): ${proc.stderr.toString().trim()}`);
    process.exit(1);
  }
  const bundled = readBundled(root).map(({ name }) => name);
  const failures = bundledAdvisories(JSON.parse(text), bundled);
  if (failures.length > 0) {
    console.error(`High or critical advisories in bundled code:\n${failures.join("\n")}`);
    process.exit(1);
  }
  console.log(`no high or critical advisories in the ${bundled.length} bundled packages`);
}
