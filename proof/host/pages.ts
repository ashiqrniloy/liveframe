import { agentHomeActions, agentHomeOptions, initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";
import { GitStatus } from "../widgets/clay/git-status.tsx";
import { gitOptions, initialRackState, rackActions, rackOptions } from "../widgets/clay/manifest.ts";
import { RackModule } from "../widgets/clay/rack-module.tsx";
import { CoreQueue } from "../widgets/core-queue/widget.tsx";
import { harnessActions, harnessInputs, harnessOptions, harnessWidget } from "../widgets/harness.tsx";
import { gitFixture, rackFixture } from "./fixtures/clay.ts";
import { agentHomeFixture } from "./fixtures/queue.ts";
import { createSurface } from "./state.ts";

// Task 10 replaces the remaining smoke registration.
export const pages = {
  "agent-home": "Synapta's agent-home queue",
  "core-queue": "Core queue at four sizes",
  "git-status": "Clay's git status",
  "rack-module": "Rack agent information module",
  "design-system": "Design-system switch — reference proof pending Task 10",
} as const;

export const agentHomeScenarios = ["ready", "loading", "empty", "failed", "read-only", "no-alerts", "no-escalate"];

export function openPage(size: string, name = "core-queue", scenario = "ready") {
  if (name === "git-status")
    return createSurface(
      GitStatus,
      { params: {}, state: {}, data: scenario === "empty" ? { statuses: [] } : gitFixture, context: { size } },
      gitOptions,
      {},
    );
  if (name === "rack-module")
    return createSurface(
      RackModule,
      { params: {}, state: initialRackState, data: rackFixture, context: { size } },
      rackOptions,
      rackActions,
    );
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
