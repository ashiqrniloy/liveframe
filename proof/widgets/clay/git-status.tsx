/** @jsxImportSource ../../runtime */
import {
  dirtyLabel,
  headLabel,
  refreshLabel,
  rootLabel,
} from "../../../src/__tests__/fixtures/widgets/git-status/labels.ts";
import { Heading, Icon, Inline, Stack, Text, type WidgetProps } from "../../runtime/index.ts";
import type { GitEntry } from "./manifest.ts";

function StatusRow({ text, icon }: { text: string; icon?: string | null }) {
  return (
    <Inline gap="space.1" align="center">
      {icon ? <Icon name={icon} /> : null}
      <Text text={text} />
    </Inline>
  );
}
function GitRoot({ root }: { root: GitEntry }) {
  const snapshot = root.snapshot;
  const kind = root.refreshState?.kind;
  return (
    <>
      <StatusRow key="root" text={rootLabel(root.workspaceRoot)} />
      <StatusRow
        key="head"
        text={headLabel(snapshot?.head)}
        icon={snapshot?.head && ["branch", "detached", "unborn"].includes(snapshot.head.kind) ? "git.branch" : null}
      />
      <StatusRow
        key="dirty"
        text={dirtyLabel(snapshot)}
        icon={snapshot ? (snapshot.dirty ? "status.warning" : "status.success") : null}
      />
      <StatusRow
        key="refresh"
        text={refreshLabel(root.refreshState)}
        icon={kind === "last-success" ? "status.success" : kind === "last-error" ? "status.error" : null}
      />
    </>
  );
}
export function GitStatus({ data }: WidgetProps<object, object, { statuses: GitEntry[] }, { size: string }>) {
  return (
    <Stack padding="space.3" gap="space.1">
      <Heading text="Git" level={2} />
      {data.statuses.length ? (
        data.statuses.map((root) => <GitRoot key={root.workspaceRootId} root={root} />)
      ) : (
        <Text text="No workspace roots" />
      )}
    </Stack>
  );
}
