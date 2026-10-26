/** @jsxImportSource @arnilo/liveframe/sdk */
import { action, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { Button, Dialog, Heading, Stack, Text } from "./ui.gen.ts";

type Params = { name: string };
type State = { count: number; help: boolean };

export default function Hello({ params, state: s }: WidgetProps<Params, State>) {
  return (
    <Stack gap="space.3" padding="space.4">
      <Heading text={`Hello, ${params.name}`} level={2} />
      <Text text={`Pressed ${s.count} times`} />
      <Button key="press" label="Press" variant="primary" onPress={state.set("count", s.count + 1)} />
      <Button key="notify" label="Notify" onPress={action("demo.notify", { message: `Hello from ${params.name}` })} />
      <Button key="help" label="Help" variant="ghost" onPress={state.set("help", true)} />
      <Dialog label="Help" open={s.help} onClose={state.set("help", false)}>
        <Text text="Press counts in the widget's state. Notify asks the host to run an action." />
      </Dialog>
    </Stack>
  );
}
