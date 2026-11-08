/** @jsxImportSource @arnilo/liveframe/sdk */

import { TaskCard } from "liveframe:lib/acme.cards@1.0.0";
import type { WidgetProps } from "@arnilo/liveframe/sdk";
import { Stack } from "./ui.gen.ts";

type Params = { open: number };

export default function Summary({ params }: WidgetProps<Params>) {
  return (
    <Stack gap="space.2" padding="space.4">
      <TaskCard key="open" title={`${params.open} open tasks`} detail="Counted by the host" />
      <TaskCard key="shared" title="Shared library" detail="The same card, in a second widget" />
    </Stack>
  );
}
