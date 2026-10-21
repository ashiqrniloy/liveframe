/** @jsxImportSource ../../runtime */
import { Box, Button, Grid, Heading, Inline, Stack, state, Text } from "../../runtime/index.ts";
import { DecisionCard } from "../agent-home/decision-card.tsx";
import type { QueueProps } from "../agent-home/manifest.ts";
import { AgentHomeQueue } from "../agent-home/queue.tsx";
import { QueueRow } from "../agent-home/queue-row.tsx";
import { Metric } from "./metric.tsx";

export function CoreQueue(props: QueueProps) {
  const { context, data, state: s, params } = props;
  if (context.size === "full" || data.status !== "ready") return <AgentHomeQueue {...props} />;
  const decisions = data.groups.find((group) => group.id === "decisions");
  const index = decisions?.pages.findIndex((page) => page.cursor === s.cursors.decisions) ?? -1;
  if (!decisions || index < 0) throw new Error("Unknown decisions cursor");
  const rows = decisions.pages.slice(0, index + 1).flatMap((page) => page.rows);
  if (context.size === "small") return <Metric value={rows.length} />;
  const focus = rows.find((row) => row.id === s.selected) ?? rows[0];
  const next = decisions.pages[index]?.nextCursor;
  return (
    <Box surface="surface.raised" padding="space.4">
      <Stack gap="space.4">
        <Inline key="header" justify="between" wrap="wrap" gap="space.2">
          <Heading text="Your decision queue" level={2} />
          <Text text={`Checked ${data.checked}`} textStyle="meta" tone="muted" />
        </Inline>
        {!params.canAct && <Text key="readonly" text="Read-only desk" tone="info" />}
        <Grid columns={context.size === "large" ? ["1fr", "1fr"] : ["1fr"]} gap="space.5" align="start">
          {context.size === "large" && focus && <DecisionCard key="focus" focus={focus} params={params} />}
          <Stack key="rows" gap="space.1">
            {rows.map((row) => (
              <QueueRow
                key={row.id}
                id={row.id}
                title={row.title}
                status={row.status}
                meta={row.meta}
                foldedAlerts={row.foldedAlerts ?? 0}
                selected={focus?.id === row.id}
              />
            ))}
            {rows.length === 0 && <Text text="No decisions are waiting on you." tone="muted" />}
          </Stack>
        </Grid>
        <Inline key="pager" justify="between" gap="space.2">
          <Text text={`Showing ${rows.length}`} textStyle="meta" />
          {next !== undefined && (
            <Button label="Load more" onPress={state.set("cursors", { ...s.cursors, decisions: next })} />
          )}
        </Inline>
        {data.stale && (
          <Text
            text="Stale · An item changed while this page was open. Reload to see it before deciding."
            tone="warning"
          />
        )}
      </Stack>
    </Box>
  );
}
