/** @jsxImportSource ../../runtime */
import { action, Box, Button, Heading, Popover, Stack, Text } from "../../runtime/index.ts";
import type { QueueItem, QueueProps } from "./manifest.ts";
export function DecisionCard({ focus, params }: { focus: QueueItem; params: QueueProps["params"] }) {
  return (
    <Box surface="surface.module" padding="space.5">
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
          <Button label="Review and decide" variant="primary" onPress={action("decisions.review", { id: focus.id })} />
        )}
      </Stack>
    </Box>
  );
}
