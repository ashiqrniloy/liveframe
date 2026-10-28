/** @jsxImportSource @arnilo/liveframe/sdk */
import { action } from "@arnilo/liveframe/sdk";
import { Box, Button, Disclosure, Heading, Icon, Inline, Stack, Text } from "../ui.gen.ts";
import { Facts } from "./facts.tsx";
import type { QueueItem, QueueProps } from "./manifest.ts";

/** The focus card: kicker, title, state, facts, reference and the decide row (artifact `.plate`). */
export function DecisionCard({ focus, params }: { focus: QueueItem; params: QueueProps["params"] }) {
  return (
    <Box semantics="article" variant="plate">
      <Inline key="kicker" gap="space.2" align="center">
        <Icon key="brand" name="seal-brand" tone="foil" width="size.glyph" height="size.glyph" />
        <Text key="word" text={focus.kicker} textStyle="ui" tone="foil" />
      </Inline>
      <Stack key="head" gap="space.2">
        <Heading text={focus.title} level={2} textStyle="heading.3" />
        {/* 8px gap plus 8px right padding on the stamp: 16px between the word and the time, 8px between lines. */}
        <Inline key="state" gap="space.2" wrap="wrap" align="center">
          <Inline key="stamp" gap="space.2" align="center" paddingRight="space.2">
            <Icon key="marker" name="mk-dashed" tone="warning" />
            <Text key="word" text={focus.status} textStyle="mono.strong" tone="warning" />
          </Inline>
          <Text key="when" text={focus.meta} textStyle="meta" tone="muted" />
        </Inline>
      </Stack>
      <Facts facts={focus.facts} />
      <Disclosure key="reference" label="Reference">
        <Text text={focus.reference} textStyle="meta" />
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
          <Text key="note" text={focus.note} textStyle="meta" tone="muted" maxWidth="56ch" />
          {params.canAct && (
            <Inline key="acts" shrink={0}>
              <Button
                label="Review and decide"
                variant="primary"
                onPress={action("decisions.review", { id: focus.id })}
              />
            </Inline>
          )}
        </Inline>
      </Box>
    </Box>
  );
}
