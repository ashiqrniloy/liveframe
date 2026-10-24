/** @jsxImportSource @arnilo/liveframe/sdk */
import { action, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { Button, Heading, Inline, Stack, Text, TextField } from "../ui.gen.ts";
export function harnessWidget({
  state: s,
  data,
  context,
}: WidgetProps<
  object,
  { selected: string; query: string },
  { items: readonly { id: string; title: string }[] },
  { size: string }
>) {
  return (
    <Stack gap="space.3" padding="space.3">
      <Heading text="Proof host smoke widget" level={2} />
      <Text key="size" text={`Size: ${context.size}`} />
      <Text key="selected" text={`Selected: ${s.selected}`} />
      <TextField label="Query" value={s.query} onChange={state.set("query")} />
      <Stack key="rows" gap="space.1">
        {data.items.map((row) => (
          <Inline key={row.id} gap="space.2">
            <Text text={row.title} />
            <Button key="select" label={`Select ${row.id}`} onPress={state.set("selected", row.id)} />
            <Button
              key="claim"
              variant="primary"
              label={`Claim ${row.id}`}
              onPress={action("tasks.claim", { id: row.id })}
            />
          </Inline>
        ))}
      </Stack>
    </Stack>
  );
}
