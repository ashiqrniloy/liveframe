/** @jsxImportSource ../../runtime */
import { action, Box, Button, Heading, Inline, Menu, MenuItem, Popover, Stack, Text } from "../../runtime/index.ts";
import type { QueueItem } from "./manifest.ts";

export function AlertCard({ alert, canAct }: { alert: QueueItem; canAct: boolean }) {
  return (
    <Box surface="surface.module" padding="space.5">
      <Stack gap="space.4">
        <Text key="kicker" text={alert.kicker} textStyle="meta" tone="muted" />
        <Heading text={alert.title} level={3} />
        <Text key="status" text={alert.status} tone="danger" />
        <Text key="meta" text={alert.meta} textStyle="meta" tone="muted" />
        {alert.lead ? <Text key="lead" text={alert.lead} /> : null}
        <Popover label="Reference">
          <Text text={alert.reference} textStyle="meta" />
        </Popover>
        <Text key="note" text={alert.note} />
        {canAct && (
          <Inline gap="space.2" wrap="wrap">
            <Button
              key="acknowledge"
              label="Acknowledge"
              variant="primary"
              onPress={action("alerts.acknowledge", { id: alert.id })}
            />
            <Menu label="Snooze">
              <MenuItem
                key="hour"
                label="For 1 hour"
                onPress={action("alerts.snooze", { id: alert.id, duration: "hour" })}
              />
              <MenuItem
                key="day"
                label="For 1 day"
                onPress={action("alerts.snooze", { id: alert.id, duration: "day" })}
              />
            </Menu>
            <Button key="convert" label="Convert to task" onPress={action("alerts.convert", { id: alert.id })} />
          </Inline>
        )}
      </Stack>
    </Box>
  );
}
