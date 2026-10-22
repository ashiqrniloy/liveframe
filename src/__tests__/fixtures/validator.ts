import { strict as assert } from "node:assert";
import { compileValidator, obj, str, type UiNode, type UiTree, validateCatalog } from "../../index.ts";
import catalogDocument from "./proof/catalog.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };

const installed = validateCatalog(catalogDocument);
assert(installed.ok, "Invalid benchmark catalog");
export const validatorCatalog = installed.value;

// Reconstruct the proof's 50-row queue without running widget code; escalation now requires a reason.
const synthetic: UiTree = {
  format: "liveframe/1",
  catalogId: validatorCatalog.catalogId,
  surfaceId: "proof",
  revision: 0,
  root: {
    id: "root",
    kind: "stack",
    props: {},
    style: { gap: "space.3" },
    children: [
      { id: "root/heading", kind: "heading", props: { text: "Waiting on you", level: 2 } },
      {
        id: "root/rows",
        kind: "stack",
        props: {},
        children: Array.from({ length: 50 }, (_, i): UiNode => {
          const id = `root/rows/task:${i}`;
          const task = `task:${i}`;
          return {
            id,
            kind: "inline",
            props: {},
            style: { gap: "space.2" },
            children: [
              { id: `${id}/title`, kind: "text", props: { text: `Synthetic task ${i}` } },
              { id: `${id}/detail`, kind: "text", props: { text: "Waiting on you" } },
              { id: `${id}/owner`, kind: "text", props: { text: "You" } },
              {
                id: `${id}/select`,
                kind: "button",
                props: { label: "Select" },
                events: { onPress: { type: "setState", key: "selected", value: task } },
              },
              {
                id: `${id}/claim`,
                kind: "button",
                props: { label: "Claim" },
                events: { onPress: { type: "action", name: "tasks.claim", args: { id: task } } },
              },
              {
                id: `${id}/escalate`,
                kind: "button",
                props: { label: "Escalate" },
                events: {
                  onPress: { type: "action", name: "tasks.escalate", args: { id: task, reason: "Needs help" } },
                },
              },
            ],
          };
        }),
      },
    ],
  },
};

const rackCapabilities = {
  ...capabilities,
  actions: {
    "container.close": { description: "Close container", args: obj({ containerId: str({ maxLength: 128 }) }) },
    "agent.send": {
      description: "Send message",
      args: obj({ sessionId: str({ maxLength: 128 }), message: str({ maxLength: 10_000, pattern: "[\\s\\S]" }) }),
    },
  },
};
const rackManifest = {
  ...manifest,
  id: "rack-module",
  params: obj({}),
  state: obj({ tab: str({ maxLength: 7, enum: ["files", "om", "context"] }), draft: str({ maxLength: 10_000 }) }),
  initialState: { tab: "files", draft: "check the context tab" },
  actions: Object.keys(rackCapabilities.actions),
};

export async function validatorFixtures() {
  const queue = compileValidator({ catalog: validatorCatalog, capabilities, manifest });
  const rack = compileValidator({ catalog: validatorCatalog, capabilities: rackCapabilities, manifest: rackManifest });
  const fixtures = [];
  for (const [name, nodes] of [
    ["agent-home", 679],
    ["core-queue.small", 5],
    ["core-queue.medium", 414],
    ["core-queue.large", 446],
    ["core-queue.full", 473],
    ["git-status", 145],
    ["rack-module", 236],
    ["synthetic-queue", 353],
  ] as const) {
    const input: unknown =
      name === "synthetic-queue"
        ? synthetic
        : await Bun.file(new URL(`./proof/${name}.tree.json`, import.meta.url)).json();
    const { validateTree } = name === "rack-module" ? rack : queue;
    const result = validateTree(input);
    assert(result.ok, `${name}: ${JSON.stringify(result)}`);
    const count = (node: UiNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
    assert.equal(count(result.value.root), nodes, `${name}: unexpected node count`);
    fixtures.push({ name, nodes, tree: result.value, validateTree });
  }
  return fixtures;
}
