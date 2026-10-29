import { expect, test } from "bun:test";

test("preloads_are_effective", () => {
  for (const [name, specifier, preload] of [
    ["playwright", "playwright", "./src/__tests__/fixtures/no-playwright.ts"],
    ["mcp-sdk", "@modelcontextprotocol/server", "./src/__tests__/fixtures/no-mcp-sdk.ts"],
  ] as const) {
    const blocked = Bun.spawnSync(
      ["bun", "--preload", preload, "--eval", `await import(${JSON.stringify(specifier)})`],
      {
        cwd: new URL("../..", import.meta.url).pathname,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(blocked.exitCode, name).not.toBe(0);
    expect(blocked.stderr.toString(), name).toContain("is not installed");
    const unblocked = Bun.spawnSync(["bun", "--eval", `await import(${JSON.stringify(specifier)})`], {
      cwd: new URL("../..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(unblocked.exitCode, name).toBe(0);
  }
});
