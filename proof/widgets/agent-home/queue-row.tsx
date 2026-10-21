/** @jsxImportSource ../../runtime */
import { Box, Button, state, Text } from "../../runtime/index.ts";

export function QueueRow({
  id,
  title,
  status,
  meta,
  foldedAlerts,
  selected,
}: {
  id: string;
  title: string;
  status: string;
  meta: string;
  foldedAlerts: number;
  selected: boolean;
}) {
  return (
    <Box surface={selected ? "surface.selected" : "surface.module"} padding="space.2">
      <Button label={title} variant="ghost" width="fill" onPress={state.set("selected", id)} />
      <Text
        text={`${selected ? "Selected · " : ""}${status} · ${meta}${foldedAlerts ? ` · ${foldedAlerts} alert folded here` : ""}`}
        textStyle="meta"
        tone="muted"
      />
    </Box>
  );
}
