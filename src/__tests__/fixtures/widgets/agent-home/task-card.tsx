/** @jsxImportSource @arnilo/liveframe/sdk */
import { action, state } from "@arnilo/liveframe/sdk";
import { Box, Button, Dialog, Disclosure, Heading, Icon, Inline, Stack, Text, TextField } from "../ui.gen.ts";
import { Facts } from "./facts.tsx";
import type { QueueItem, QueueProps } from "./manifest.ts";

/** The task focus card: the same plate shape as the decision card, with claim and escalate. */
export function TaskCard({
  task,
  params,
  current,
}: {
  task: QueueItem;
  params: QueueProps["params"];
  current: QueueProps["state"];
}) {
  const validReason = Array.from(current.reason).length >= 1 && Array.from(current.reason).length <= 500;
  return (
    <Box semantics="article" variant="plate">
      <Inline key="kicker" gap="space.2" align="center">
        <Icon key="brand" name="seal-brand" width="size.glyph" height="size.glyph" />
        <Text key="word" text={task.kicker} textStyle="ui" tone="foil" />
      </Inline>
      <Stack key="head" gap="space.2">
        <Heading text={task.title} level={2} textStyle="heading.3" />
        {/* 8px gap plus 8px right padding on the stamp: 16px between the word and the time, 8px between lines. */}
        <Inline key="state" gap="space.2" wrap="wrap" align="center">
          <Inline key="stamp" gap="space.2" align="center" paddingRight="space.2">
            <Icon key="marker" name="mk-dashed" />
            <Text key="word" text={task.status} textStyle="mono.strong" tone="warning" />
          </Inline>
          <Text key="when" text={task.meta} textStyle="meta" tone="muted" />
        </Inline>
      </Stack>
      <Facts facts={task.facts} />
      <Disclosure key="reference" label="Reference">
        <Text text={task.reference} textStyle="meta" />
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
          <Text key="note" text={task.note} textStyle="meta" tone="muted" maxWidth="56ch" />
          {params.canAct && (
            <Inline key="acts" gap="space.2" wrap="wrap" shrink={0}>
              <Button key="claim" label="Claim" variant="primary" onPress={action("tasks.claim", { id: task.id })} />
              {params.canEscalate && (
                <Button key="escalate" label="Escalate…" onPress={state.set("escalating", task.id)} />
              )}
            </Inline>
          )}
        </Inline>
      </Box>
      {params.canAct && params.canEscalate && current.escalating === task.id && (
        <Dialog label="Escalate this task?" open onClose={state.set("escalating", "")}>
          <Stack gap="space.3">
            <Text
              key="explanation"
              text="It goes to the people who can reassign it, with your reason attached. The task stays open."
            />
            <TextField label="Reason" value={current.reason} maxLength={500} onChange={state.set("reason")} />
            <Text
              key="help"
              text="1–500 characters. Everyone who sees the task sees the reason. Leave the field to confirm your draft."
              textStyle="meta"
            />
            <Inline gap="space.2">
              <Button key="cancel" label="Cancel" variant="ghost" onPress={state.set("escalating", "")} />
              {validReason ? (
                <Button
                  key="send"
                  label="Escalate"
                  variant="primary"
                  onPress={action("tasks.escalate", { id: task.id, reason: current.reason })}
                />
              ) : (
                <Button key="send" label="Escalate" variant="primary" disabled />
              )}
            </Inline>
          </Stack>
        </Dialog>
      )}
    </Box>
  );
}
