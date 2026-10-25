/** @jsxImportSource @arnilo/liveframe/sdk */
import { compileValidator, LiveframeFailure } from "@arnilo/liveframe";
import { action, render, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import catalog from "./proof/catalog.json" with { type: "json" };
import { Button, Stack, Text } from "./widgets/ui.gen.ts";

export function Claim({ state: s }: WidgetProps<unknown, { selected: string }>) {
  return (
    <Stack gap="space.2">
      <Text text={s.selected} />
      <Button key="select" label="Select" onPress={state.set("selected", "t1")} />
      <Button key="claim" label="Claim" onPress={action("tasks.claim", { id: "t1" })} />
    </Stack>
  );
}

export const validator = compileValidator({ catalog, capabilities, manifest });
export const inputs = {
  params: { canAct: true, canEscalate: false, canViewAlerts: true },
  state: manifest.initialState,
  data: {},
  context: { size: "small" },
};
export const result = render(Claim, inputs, { validator, surfaceId: "home", revision: 1 });
if (!result.ok) throw new LiveframeFailure(result.errors);
// result.value is a validated UiTree containing primitives and intent data.
