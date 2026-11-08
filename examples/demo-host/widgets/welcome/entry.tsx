/** @jsxImportSource @arnilo/liveframe/sdk */

import { TaskCard } from "liveframe:lib/acme.cards@1.0.0";
import type { WidgetProps } from "@arnilo/liveframe/sdk";
import { Stack } from "./ui.gen.ts";

type Params = { name: string };

export default function Welcome({ params }: WidgetProps<Params>) {
  return (
    <Stack padding="space.4">
      <TaskCard title={`Welcome, ${params.name}`} detail="This card comes from the shared acme.cards library" />
    </Stack>
  );
}
