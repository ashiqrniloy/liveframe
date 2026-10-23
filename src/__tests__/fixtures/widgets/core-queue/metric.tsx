/** @jsxImportSource @arnilo/liveframe/sdk */
import { Box, Heading, Stack, Text } from "../ui.gen.ts";

export function Metric({ value }: { value: number }) {
  return (
    <Box surface="surface.raised" padding="space.4">
      <Stack gap="space.2">
        <Text key="label" text="Decisions waiting on you · today" textStyle="label" />
        <Heading text={String(value)} level={2} />
        <Text key="scope" text="Current page · not a queue total" textStyle="meta" tone="muted" />
      </Stack>
    </Box>
  );
}
