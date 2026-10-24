import type { WidgetProps } from "@arnilo/liveframe/sdk";
import agentManifest from "../proof/agent-home.manifest.json" with { type: "json" };
import coreManifest from "../proof/core-queue.manifest.json" with { type: "json" };
import gitManifest from "../proof/git-status.manifest.json" with { type: "json" };
import rackManifest from "../proof/rack-module.manifest.json" with { type: "json" };
import type { QueueProps } from "./agent-home/manifest.ts";
import { AgentHomeQueue } from "./agent-home/queue.tsx";
import agentScenarios from "./agent-home/scenarios.json" with { type: "json" };
import coreScenarios from "./core-queue/scenarios.json" with { type: "json" };
import { CoreQueue } from "./core-queue/widget.tsx";
import { GitStatus } from "./git-status/git-status.tsx";
import type { GitEntry } from "./git-status/manifest.ts";
import gitScenarios from "./git-status/scenarios.json" with { type: "json" };
import harnessManifest from "./harness/manifest.json" with { type: "json" };
import harnessScenarios from "./harness/scenarios.json" with { type: "json" };
import { harnessWidget } from "./harness/widget.tsx";
import type { RackData, RackState } from "./rack-module/manifest.ts";
import { RackModule } from "./rack-module/rack-module.tsx";
import rackScenarios from "./rack-module/scenarios.json" with { type: "json" };

type Fixture = {
  readonly name: string;
  readonly manifest: unknown;
  readonly widget: (inputs: WidgetProps) => unknown;
  readonly scenarios: readonly (WidgetProps & { readonly name: string })[];
  readonly exports: Readonly<Record<string, string>>;
};

export const proofWidgets: readonly Fixture[] = [
  {
    name: "agent-home",
    manifest: {
      ...agentManifest,
      sources: {
        status: { source: "queue.status", params: {} },
        checked: { source: "queue.checked", params: {} },
        stale: { source: "queue.stale", params: {} },
        groups: { source: "queue.groups", params: {} },
      },
    },
    widget: (inputs) => AgentHomeQueue(inputs as QueueProps),
    scenarios: agentScenarios,
    exports: { ready: "agent-home" },
  },
  {
    name: "core-queue",
    manifest: coreManifest,
    widget: (inputs) => CoreQueue(inputs as QueueProps),
    scenarios: coreScenarios,
    exports: {
      small: "core-queue.small",
      medium: "core-queue.medium",
      large: "core-queue.large",
      full: "core-queue.full",
    },
  },
  {
    name: "git-status",
    manifest: gitManifest,
    widget: (inputs) => GitStatus(inputs as WidgetProps<object, object, { statuses: GitEntry[] }, { size: string }>),
    scenarios: gitScenarios,
    exports: { benchmark: "git-status" },
  },
  {
    name: "rack-module",
    manifest: rackManifest,
    widget: (inputs) => RackModule(inputs as WidgetProps<object, RackState, RackData, { size: string }>),
    scenarios: rackScenarios,
    exports: { benchmark: "rack-module" },
  },
  {
    name: "harness",
    manifest: harnessManifest,
    widget: (inputs) => harnessWidget(inputs as Parameters<typeof harnessWidget>[0]),
    scenarios: harnessScenarios,
    exports: {},
  },
];
