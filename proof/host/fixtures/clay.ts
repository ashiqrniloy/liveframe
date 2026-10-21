import type { GitEntry, RackData } from "../../widgets/clay/manifest.ts";

// Synthetic workspace paths exercise the source adapter's path redaction.
export const gitFixture: { statuses: GitEntry[] } = {
  statuses: [
    {
      workspaceRootId: "clay",
      workspaceRoot: "/synthetic/clay",
      snapshot: { head: { kind: "branch", name: "main" }, dirty: true, changedFileCount: 2 },
      refreshState: { kind: "last-success" },
    },
    {
      workspaceRootId: "tools",
      workspaceRoot: "/synthetic/tools",
      snapshot: { head: { kind: "detached", shortSha: "abc1234" }, dirty: false },
      refreshState: { kind: "last-error", status: { kind: "unavailable" } },
    },
    {
      workspaceRootId: "new",
      workspaceRoot: "/synthetic/new",
      snapshot: { head: { kind: "unborn" }, dirty: true },
      refreshState: { kind: "refreshing" },
    },
    { workspaceRootId: "pending", workspaceRoot: "/synthetic/pending", snapshot: null, refreshState: null },
    {
      workspaceRootId: "unknown",
      workspaceRoot: "/synthetic/unknown",
      snapshot: { head: null, dirty: false },
      refreshState: { kind: "idle" },
    },
    {
      workspaceRootId: "sanitized",
      workspaceRoot: "/synthetic/safe\nroot",
      snapshot: { head: { kind: "branch", name: "topic/private\nbranch" }, dirty: false },
      refreshState: { kind: "last-error" },
    },
  ],
};
export const rackFixture: RackData = {
  containerId: "agent-info",
  sessionId: "clay/coding-agent",
  files: [
    { name: "ContainerTrack.tsx", status: "M", operation: "written" },
    { name: "DESIGN.md", status: "R", operation: "read" },
  ],
};
