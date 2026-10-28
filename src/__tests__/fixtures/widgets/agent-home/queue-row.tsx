/** @jsxImportSource @arnilo/liveframe/sdk */
import { state } from "@arnilo/liveframe/sdk";
import { Box, Button, Icon, Inline, Stack, Text } from "../ui.gen.ts";
import type { Category } from "./manifest.ts";

const markers: Record<Category, { name: string; tone: "warning" | "danger" }> = {
  decisions: { name: "mk-dashed", tone: "warning" },
  tasks: { name: "mk-dashed", tone: "warning" },
  alerts: { name: "mk-struck", tone: "danger" },
};

export function QueueRow({
  id,
  category,
  title,
  status,
  meta,
  foldedAlerts,
  selected,
}: {
  id: string;
  category: Category;
  title: string;
  status: string;
  meta: readonly string[];
  foldedAlerts: number;
  selected: boolean;
}) {
  return (
    <Box {...(selected ? { surface: "surface.well" } : {})} variant="rule">
      {/* Retain the empty trailing grid gap when there is no folded-alert flag. */}
      <Inline key="grid" gap="space.3" align="start" paddingRight={foldedAlerts ? "space.0" : "space.3"}>
        <Icon key="marker" name={markers[category].name} tone={markers[category].tone} width="space.4" shrink={0} />
        <Stack key="body" gap="space.1" align="start" grow={1} basis={0}>
          <Button key="subject" label={title} variant="ghost" current={selected} onPress={state.set("selected", id)} />
          {/* 4px gap with 8px right padding on every but the last word: 12px between words, 4px between lines. */}
          <Inline key="meta" gap="space.1" wrap="wrap" align="center">
            <Text text={status} textStyle="mono" tone="muted" paddingRight="space.2" />
            {meta.map((entry, index) => (
              <Text
                key={entry}
                text={entry}
                textStyle="meta"
                tone="muted"
                paddingRight={index === meta.length - 1 ? "space.0" : "space.2"}
              />
            ))}
          </Inline>
        </Stack>
        {foldedAlerts ? (
          <Inline key="flag" gap="space.2" align="center" shrink={0}>
            <Icon key="marker" name="mk-solid" tone="info" />
            <Text key="word" text={`${foldedAlerts} alert folded here`} textStyle="caption" tone="warning" />
          </Inline>
        ) : null}
      </Inline>
    </Box>
  );
}
