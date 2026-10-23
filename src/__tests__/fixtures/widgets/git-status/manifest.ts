export interface GitEntry {
  workspaceRootId: string;
  workspaceRoot: string;
  snapshot?: {
    head?: { kind: string; name?: string; shortSha?: string };
    dirty: boolean;
    changedFileCount?: number;
  };
  refreshState?: { kind: string; status?: { kind: string } };
}
