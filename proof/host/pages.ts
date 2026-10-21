import { agentHomeActions, agentHomeOptions, initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";
import { CoreQueue } from "../widgets/core-queue/widget.tsx";
import { harnessActions, harnessInputs, harnessOptions, harnessWidget } from "../widgets/harness.tsx";
import { agentHomeFixture } from "./fixtures/queue.ts";
import { createSurface } from "./state.ts";

// Tasks 9–10 replace the remaining smoke registrations.
export const pages = {
  "agent-home": "Synapta's agent-home queue",
  "core-queue": "Core queue at four sizes",
  "git-status": "Git status — reference widget pending Task 9",
  "rack-module": "Rack module — reference widget pending Task 9",
  "design-system": "Design-system switch — reference proof pending Task 10",
} as const;

export const agentHomeScenarios = ["ready", "loading", "empty", "failed", "read-only", "no-alerts", "no-escalate"];

export function openPage(size: string, name = "core-queue", scenario = "ready") {
  if (name === "agent-home" || name === "core-queue")
    return createSurface(
      name === "core-queue" ? CoreQueue : AgentHomeQueue,
      {
        params: {
          ...queueParams,
          canAct: scenario !== "read-only",
          canViewAlerts: scenario !== "no-alerts",
          canEscalate: scenario !== "no-escalate",
        },
        state: initialQueueState,
        data: {
          ...agentHomeFixture,
          status: scenario === "loading" || scenario === "empty" || scenario === "failed" ? scenario : "ready",
        },
        context: { size },
      },
      agentHomeOptions,
      agentHomeActions,
    );
  return createSurface(harnessWidget, { ...harnessInputs, context: { size } }, harnessOptions, harnessActions);
}
