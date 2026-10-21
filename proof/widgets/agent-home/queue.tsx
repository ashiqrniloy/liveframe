/** @jsxImportSource ../../runtime */
import {
  action,
  Box,
  Button,
  Grid,
  Heading,
  Inline,
  Popover,
  Stack,
  state,
  Tab,
  Tabs,
  Text,
} from "../../runtime/index.ts";
import { AlertCard } from "./alert-card.tsx";
import type { QueueProps } from "./manifest.ts";
import { QueueRow } from "./queue-row.tsx";
import { TaskCard } from "./task-card.tsx";

export function AgentHomeQueue({ params, state: s, data }: QueueProps) {
  const permitted = data.groups.filter((group) => group.id !== "alerts" || params.canViewAlerts);
  if (s.filter === "alerts" && !params.canViewAlerts) throw new Error("Alerts are unavailable");
  const groups = permitted.map((group) => {
    const index = group.pages.findIndex((page) => page.cursor === s.cursors[group.id]);
    if (index < 0) throw new Error(`Unknown ${group.id} cursor`);
    return {
      ...group,
      rows: group.pages.slice(0, index + 1).flatMap((page) => page.rows),
      next: group.pages[index]?.nextCursor,
    };
  });
  const visible = groups.filter((group) => s.filter === "all" || group.id === s.filter);
  const rows = visible.flatMap((group) => group.rows);
  const focus = rows.find((row) => row.id === s.selected) ?? rows[0];
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  const cursors = { ...s.cursors };
  for (const group of groups) if (group.next) cursors[group.id] = group.next;
  const more = groups.some((group) => group.next);
  return (
    <Box surface="surface.raised" padding="space.4">
      <Stack gap="space.4">
        <Inline justify="between" wrap="wrap" gap="space.2">
          <Heading text="Queue" level={2} />
          <Text text={`Checked ${data.checked}`} textStyle="meta" tone="muted" />
        </Inline>
        {!params.canAct && <Text key="readonly" text="Read-only desk" tone="info" />}
        {data.status === "loading" ? (
          <Stack key="loading" gap="space.2">
            <Heading text="Loading" level={3} />
            <Text text="Loading the queue. Static rows, no animated skeleton." tone="muted" />
            <Box key="row-1" surface="surface.well" height="space.4" />
            <Box key="row-2" surface="surface.well" height="space.4" />
            <Box key="row-3" surface="surface.well" height="space.4" />
          </Stack>
        ) : data.status === "failed" ? (
          <Stack key="failed" gap="space.3">
            <Heading text="The queue did not load" level={3} tone="danger" />
            <Text text="Synapta could not reach your queue just now. Your draft and the dock still work; try the queue again." />
            <Button label="Retry the queue" onPress={action("queue.retry")} />
          </Stack>
        ) : data.status === "empty" ? (
          <Stack key="empty" gap="space.2">
            <Heading text="Nothing else waits on you" level={3} />
            <Text
              text="You have reached the end of the queue. Standing orders keep running, and new work appears here."
              tone="muted"
            />
          </Stack>
        ) : (
          <Stack key="ready" gap="space.4">
            <Tabs label="Queue category" value={s.filter} onChange={state.set("filter")}>
              <Tab key="all" value="all" label={`All ${total}`} />
              {groups.map((group) => (
                <Tab key={group.id} value={group.id} label={`${group.label} ${group.total}`} />
              ))}
            </Tabs>
            <Grid columns={["1fr", "1fr"]} gap="space.5" align="start">
              <Stack key="focus" gap="space.3">
                {focus?.category === "tasks" ? (
                  <TaskCard key={focus.id} task={focus} params={params} current={s} />
                ) : focus?.category === "alerts" ? (
                  <AlertCard key={focus.id} alert={focus} canAct={params.canAct} />
                ) : focus ? (
                  <Box key={focus.id} surface="surface.module" padding="space.5">
                    <Stack gap="space.4">
                      <Text key="kicker" text={focus.kicker} textStyle="meta" tone="muted" />
                      <Heading text={focus.title} level={3} />
                      <Text key="status" text={focus.status} tone="warning" />
                      <Text key="meta" text={focus.meta} textStyle="meta" tone="muted" />
                      <Stack key="facts" gap="space.2">
                        {focus.facts.map((fact) => (
                          <Text key={fact.label} text={`${fact.label}: ${fact.value}`} />
                        ))}
                      </Stack>
                      <Popover label="Reference">
                        <Text text={focus.reference} textStyle="meta" />
                      </Popover>
                      <Text key="note" text={focus.note} />
                      {params.canAct && (
                        <Button
                          label="Review and decide"
                          variant="primary"
                          onPress={action("decisions.review", { id: focus.id })}
                        />
                      )}
                    </Stack>
                  </Box>
                ) : (
                  <Heading text="Nothing else waits on you" level={3} />
                )}
              </Stack>
              <Stack key="rows" gap="space.3">
                {visible.map((group) => (
                  <Stack key={group.id} gap="space.1">
                    <Heading text={group.label} level={4} textStyle="label" />
                    {group.rows.map((row) => (
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
                    {group.rows.length === 0 && <Text text="Nothing else waits on you" tone="muted" />}
                  </Stack>
                ))}
                <Inline gap="space.2" justify="between">
                  <Text text={`Showing ${rows.length}`} textStyle="meta" />
                  {more && <Button label="Load more" onPress={state.set("cursors", cursors)} />}
                </Inline>
                {data.stale && (
                  <Text
                    text="Stale · An item changed while this page was open. Reload to see it before deciding."
                    tone="warning"
                  />
                )}
              </Stack>
            </Grid>
            <Popover label="Widget options">
              <Text text="About this widget: a synthetic queue composed from primitives." />
            </Popover>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
