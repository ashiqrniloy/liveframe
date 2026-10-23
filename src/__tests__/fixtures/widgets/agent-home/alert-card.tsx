/** @jsxImportSource @arnilo/liveframe/sdk */
import { action } from "@arnilo/liveframe/sdk";
import { Box, Button, Disclosure, Heading, Icon, Inline, Menu, MenuItem, Stack, Text } from "../ui.gen.ts";
import { Facts } from "./facts.tsx";
import type { QueueItem } from "./manifest.ts";

/** The alert focus card: a refused or unread signal, with acknowledge, snooze and convert. */
export function AlertCard({ alert, canAct }: { alert: QueueItem; canAct: boolean }) {
  return (
    <Box semantics="article" variant="plate">
      <Inline key="kicker" gap="space.2" align="center">
        <Icon key="brand" name="seal-brand" width="size.glyph" height="size.glyph" />
        <Text key="word" text={alert.kicker} textStyle="ui" tone="foil" />
      </Inline>
      <Stack key="head" gap="space.2">
        <Heading text={alert.title} level={2} textStyle="heading.3" />
        {/* 8px gap plus 8px right padding on the stamp: 16px between the word and the time, 8px between lines. */}
        <Inline key="state" gap="space.2" wrap="wrap" align="center">
          <Inline key="stamp" gap="space.2" align="center" paddingRight="space.2">
            <Icon key="marker" name="mk-struck" />
            <Text key="word" text={alert.status} textStyle="mono.strong" tone="danger" />
          </Inline>
          <Text key="when" text={alert.meta} textStyle="meta" tone="muted" />
        </Inline>
      </Stack>
      {alert.lead ? <Text key="lead" text={alert.lead} textStyle="meta" /> : null}
      <Facts facts={alert.facts} />
      <Disclosure key="reference" label="Reference">
        <Text text={alert.reference} textStyle="meta" />
      </Disclosure>
      <Box
        key="decide"
        variant="rule"
        paddingX="space.0"
        paddingTop="space.4"
        paddingBottom="space.0"
        marginTop="space.1"
      >
        <Inline wrap={{ base: "wrap", "bp.sm": "nowrap" }} justify="between" align="center" gap="space.3">
          <Text key="note" text={alert.note} textStyle="meta" tone="muted" maxWidth="56ch" />
          {canAct && (
            <Inline key="acts" gap="space.2" wrap="wrap" shrink={0}>
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
        </Inline>
      </Box>
    </Box>
  );
}
