/** @jsxImportSource @arnilo/liveframe/sdk */
import { state } from "@arnilo/liveframe/sdk";
import { DecisionCard } from "../agent-home/decision-card.tsx";
import type { QueueProps } from "../agent-home/manifest.ts";
import { AgentHomeQueue } from "../agent-home/queue.tsx";
import { QueueRow } from "../agent-home/queue-row.tsx";
import { Box, Button, Heading, Inline, Stack, Text } from "../ui.gen.ts";
import { Metric } from "./metric.tsx";

export function CoreQueue(props: QueueProps) {
  const { context, data, state: s, params } = props;
  if (context.size === "full" || data.status !== "ready") return <AgentHomeQueue {...props} />;
  const decisions = data.groups.find((group) => group.id === "decisions");
  const index = decisions?.pages.findIndex((page) => page.cursor === s.cursors.decisions) ?? -1;
  if (!decisions || index < 0) throw new Error("Unknown decisions cursor");
  if (context.size === "small") {
    let count = 0;
    for (let i = 0; i <= index; i++) count += decisions.pages[i]?.rows.length ?? 0;
    return <Metric value={count} />;
  }
  const rows = decisions.pages.slice(0, index + 1).flatMap((page) => page.rows);
  const focus = rows.find((row) => row.id === s.selected) ?? rows[0];
  const next = decisions.pages[index]?.nextCursor;
  return (
    <Box semantics="section" surface="surface.raised" padding="space.4">
      <Stack gap="space.4">
        <Inline key="header" semantics="header" justify="between" wrap="wrap" gap="space.2">
          <Heading text="Your decision queue" level={2} />
          <Text text={`Checked ${data.checked}`} textStyle="meta" tone="muted" />
        </Inline>
        {!params.canAct && <Text key="readonly" text="Read-only desk" tone="info" />}
        <Inline key="columns" wrap="wrap" gap="space.5" align="start">
          {context.size === "large" && focus && (
            <Stack key="focus" gap="space.3" position="sticky" insetTop="space.4" width="size.rail" grow={1} shrink={1}>
              <DecisionCard focus={focus} params={params} />
            </Stack>
          )}
          <Box
            key="rows"
            semantics="aside"
            label="Queue rows"
            width="size.rail"
            grow={context.size === "large" ? 0 : 1}
            shrink={1}
          >
            <Stack gap="space.1">
              {rows.map((row) => (
                <QueueRow
                  key={row.id}
                  id={row.id}
                  category={row.category}
                  title={row.title}
                  status={row.rowStatus}
                  meta={row.rowMeta}
                  foldedAlerts={row.foldedAlerts ?? 0}
                  selected={focus?.id === row.id}
                />
              ))}
              {rows.length === 0 && <Text text="No decisions are waiting on you." tone="muted" />}
              <Inline key="pager" semantics="nav" label="Pagination" justify="between" gap="space.2">
                <Text text={`Showing ${rows.length}`} textStyle="meta" />
                {next !== undefined && (
                  <Button label="Load more" onPress={state.set("cursors", { ...s.cursors, decisions: next })} />
                )}
              </Inline>
              {data.stale && (
                <Box key="stale" variant="callout">
                  <Stack gap="space.1">
                    <Text key="word" text="Stale" textStyle="label" tone="warning" />
                    <Text
                      key="body"
                      text="An item changed while this page was open. Reload to see it before deciding."
                      textStyle="meta"
                      tone="muted"
                    />
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>
        </Inline>
      </Stack>
    </Box>
  );
}
