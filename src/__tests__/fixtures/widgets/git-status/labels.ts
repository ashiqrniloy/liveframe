// The owner's own code, adapted from the owner's own Clay project
// (`packages/git/src/status.ts`, commit 7770d18c): no third-party licence applies
// (plans/backlog.md, "Decide the Clay-derived git-status labels fixture", closed 2026-10-29).
//
// Read-only status tree composition. Produces an inert SDUI status tree. The adapter never emits absolute
// repository/workspace paths, control characters, or executable code:
// only sanitized branch/dirty/count labels.

const MAX_STATUS_TEXT = 160;
// biome-ignore lint/suspicious/noControlCharactersInRegex: remove control characters from untrusted labels
const controls = /[\u0000-\u001f\u007f]+/g;

export function sanitizeText(value: unknown, fallback: string): string {
  const text = String(value ?? fallback)
    .replace(controls, " ")
    .replace(/[A-Za-z]:[\\/][^\s]+/g, "[path]")
    .replace(/(?:~|\.\.?)[\\/][^\s]+/g, "[path]")
    .replace(/\b[\w.-]+(?:[\\/][\w.-]+)+\b/g, "[path]")
    .trim();
  return text.length > 0 ? text.slice(0, MAX_STATUS_TEXT) : fallback;
}

export function rootLabel(workspaceRoot: unknown): string {
  const raw = String(workspaceRoot ?? "workspace")
    .replace(controls, " ")
    .trim();
  const base = raw.split(/[\\/]/).filter(Boolean).pop() ?? "workspace";
  return sanitizeText(base, "workspace");
}

export function headLabel(head: { kind?: string; name?: string; shortSha?: string } | null | undefined): string {
  if (!head) {
    return "HEAD: unknown";
  }
  switch (head.kind) {
    case "branch":
      return `Branch: ${sanitizeText(head.name, "main")}`;
    case "detached":
      return `Detached: ${sanitizeText(head.shortSha, "HEAD")}`;
    case "unborn":
      return "Branch: (no commits yet)";
    default:
      return "HEAD: unknown";
  }
}

export function dirtyLabel(snapshot: { dirty?: boolean; changedFileCount?: number } | null | undefined): string {
  if (!snapshot) {
    return "Status: not refreshed";
  }
  if (!snapshot.dirty) {
    return "Status: clean";
  }
  const count = Number(snapshot.changedFileCount ?? 0);
  return `Status: ${count > 0 ? `${count} changed` : "dirty"}`;
}

export function refreshLabel(refreshState: { kind?: string; status?: { kind?: string } } | null | undefined): string {
  if (!refreshState) {
    return "Refresh: idle";
  }
  switch (refreshState.kind) {
    case "idle":
      return "Refresh: idle";
    case "refreshing":
      return "Refresh: refreshing";
    case "last-success":
      return "Refresh: current";
    case "last-error": {
      const status = refreshState.status?.kind || "error";
      return `Refresh: ${status}`;
    }
    default:
      return "Refresh: idle";
  }
}
