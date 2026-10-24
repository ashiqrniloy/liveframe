import { type Result, validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import type { Scenario } from "@arnilo/liveframe/pack";
import catalogDoc from "../proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./capabilities.json" with { type: "json" };
import { proofWidgets } from "./index.ts";
export function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
export const packageOptions = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
const root = new URL("./", import.meta.url);
const files: Record<string, string> = {};
for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan(root.pathname))
  files[path] = await Bun.file(new URL(path, root)).text();
const entries = [
  ["agent-home/queue.tsx", "AgentHomeQueue"],
  ["core-queue/widget.tsx", "CoreQueue"],
  ["git-status/git-status.tsx", "GitStatus"],
  ["rack-module/rack-module.tsx", "RackModule"],
  ["harness/widget.tsx", "harnessWidget"],
];
export const drafts = proofWidgets.map((fixture, i) => {
  const entry = entries[i];
  if (!entry) throw new Error("Missing widget entry");
  return {
    files: { ...files, "entry.ts": `export { ${entry[1]} as default } from "./${entry[0]}";` },
    entry: "entry.ts",
    manifest: fixture.manifest,
    scenarios: fixture.scenarios as readonly Scenario[],
  };
});
