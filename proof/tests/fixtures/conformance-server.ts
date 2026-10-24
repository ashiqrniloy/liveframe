import { scenarioExamples } from "../../../src/__tests__/fixtures/conformance/index.ts";
import { supplementalExample } from "../../../src/__tests__/fixtures/conformance/supplemental.ts";

// These scenarios expose every node during SSR. Menus and inactive panels need browser fixtures.
const visible = new Set([
  "agent-home/loading",
  "agent-home/empty",
  "agent-home/failed",
  "core-queue/small",
  "core-queue/medium",
  "core-queue/large",
  "core-queue/host-small",
  "core-queue/host-medium",
  "core-queue/host-large",
  "git-status/ready",
  "git-status/empty",
  "git-status/benchmark",
]);
export const serverExamples = [
  ...scenarioExamples.filter((tree) => visible.has(tree.surfaceId)),
  {
    ...supplementalExample,
    root: {
      ...supplementalExample.root,
      children: supplementalExample.root.children
        ?.filter((node) => node.kind !== "menu")
        .map((node) => (node.kind === "dialog" || node.kind === "popover" ? { ...node, children: [] } : node)),
    },
  },
];
