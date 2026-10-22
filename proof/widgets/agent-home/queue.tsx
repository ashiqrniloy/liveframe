/** @jsxImportSource ../../runtime */
import {
  action,
  Box,
  Button,
  Heading,
  Inline,
  Menu,
  MenuItem,
  Separator,
  Stack,
  state,
  Tab,
  Tabs,
  Text,
} from "../../runtime/index.ts";
import { AlertCard } from "./alert-card.tsx";
import { DecisionCard } from "./decision-card.tsx";
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
  const showing = visible.reduce((sum, group) => sum + group.total, 0);
  const cursors = { ...s.cursors };
  for (const group of groups) if (group.next) cursors[group.id] = group.next;
  const more = groups.some((group) => group.next);
  return (
    <Box semantics="section" surface="surface.raised" radius="radius.plate" padding="space.5">
      <Stack gap="space.3">
        <Stack key="header" semantics="header" gap="space.0" marginBottom="space.3">
          <Inline key="head" justify="between" align="end" wrap="wrap" gap="space.4" paddingBottom="space.2">
            <Heading
              key="title"
              text="Queue"
              level={2}
              textStyle={{ base: "heading.2.compact", "bp.md": "heading.2" }}
            />
            <Text key="checked" text={`Checked ${data.checked}`} textStyle="fine" tone="muted" />
          </Inline>
          <Separator key="rule" />
        </Stack>
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
            <Inline key="retry">
              <Button label="Retry the queue" onPress={action("queue.retry")} />
            </Inline>
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
          <Stack key="ready" gap="space.3">
            <Tabs label="Queue category" value={s.filter} onChange={state.set("filter")}>
              <Tab key="all" value="all" label={`All ${total}`} />
              {groups.map((group) => (
                <Tab key={group.id} value={group.id} label={`${group.label} ${group.total}`} />
              ))}
            </Tabs>
            <Inline key="columns" wrap="wrap" gap="space.5" align="start">
              <Stack
                key="focus"
                gap="space.3"
                position={{ base: "static", "bp.md": "sticky" }}
                insetTop="space.4"
                width="size.rail"
                grow={1}
                shrink={1}
              >
                {focus?.category === "tasks" ? (
                  <TaskCard key={focus.id} task={focus} params={params} current={s} />
                ) : focus?.category === "alerts" ? (
                  <AlertCard key={focus.id} alert={focus} canAct={params.canAct} />
                ) : focus ? (
                  <DecisionCard key={focus.id} focus={focus} params={params} />
                ) : (
                  <Heading text="Nothing else waits on you" level={3} />
                )}
              </Stack>
              <Box key="rows" semantics="aside" label="Queue rows" width="size.rail" grow={0} shrink={1}>
                <Stack gap="space.0">
                  {visible.map((group, index) => (
                    <Stack key={group.id} gap="space.0" marginTop={index === 0 ? "space.0" : "space.5"}>
                      <Inline key="label" marginBottom="space.2">
                        <Text text={group.label} textStyle="overline" tone="foil" />
                      </Inline>
                      {group.rows.map((row) => (
                        <QueueRow
                          key={row.id}
                          id={row.id}
                          category={group.id}
                          title={row.title}
                          status={row.rowStatus}
                          meta={row.rowMeta}
                          foldedAlerts={row.foldedAlerts ?? 0}
                          selected={focus?.id === row.id}
                        />
                      ))}
                      <Separator key="rule" />
                      {group.rows.length === 0 && (
                        <Inline key="empty">
                          <Text text="Nothing else waits on you" textStyle="meta" tone="muted" />
                        </Inline>
                      )}
                    </Stack>
                  ))}
                  <Inline
                    key="pager"
                    semantics="nav"
                    label="Pagination"
                    gap="space.3"
                    justify="between"
                    align="center"
                    wrap="wrap"
                    paddingTop="space.3"
                  >
                    <Text text={`Showing ${showing}`} textStyle="mono" tone="muted" />
                    {more && (
                      <Inline key="actions">
                        <Button label="Next" onPress={state.set("cursors", cursors)} />
                      </Inline>
                    )}
                  </Inline>
                  {data.stale && (
                    <Box key="stale" variant="callout" marginTop="space.3">
                      <Stack gap="space.1">
                        <Text key="word" text="stale" textStyle="mono.strong" tone="warning" />
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
            <Box key="footer" semantics="footer" variant="rule" paddingX="space.0" paddingBottom="space.0">
              <Menu label="Widget options">
                <MenuItem key="about" label="About this widget" onPress={action("queue.about")} />
              </Menu>
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
