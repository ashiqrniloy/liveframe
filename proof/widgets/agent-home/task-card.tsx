/** @jsxImportSource ../../runtime */
import {
  action,
  Box,
  Button,
  Dialog,
  Heading,
  Inline,
  Popover,
  Stack,
  state,
  Text,
  TextField,
} from "../../runtime/index.ts";
import type { QueueItem, QueueProps } from "./manifest.ts";

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
    <Box surface="surface.module" padding="space.5">
      <Stack gap="space.4">
        <Text key="kicker" text={task.kicker} textStyle="meta" tone="muted" />
        <Heading text={task.title} level={3} />
        <Text key="status" text={task.status} tone="warning" />
        <Text key="meta" text={task.meta} textStyle="meta" tone="muted" />
        <Stack key="facts" gap="space.2">
          {task.facts.map((fact) => (
            <Text key={fact.label} text={`${fact.label}: ${fact.value}`} />
          ))}
        </Stack>
        <Popover label="Reference">
          <Text text={task.reference} textStyle="meta" />
        </Popover>
        <Text key="note" text={task.note} />
        {params.canAct && (
          <Inline gap="space.2" wrap="wrap">
            <Button key="claim" label="Claim" variant="primary" onPress={action("tasks.claim", { id: task.id })} />
            {params.canEscalate && (
              <Button key="escalate" label="Escalate…" onPress={state.set("escalating", task.id)} />
            )}
          </Inline>
        )}
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
      </Stack>
    </Box>
  );
}
