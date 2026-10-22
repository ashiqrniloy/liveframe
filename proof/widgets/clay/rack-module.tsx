/** @jsxImportSource ../../runtime */
import {
  action,
  Box,
  Button,
  Heading,
  Icon,
  Inline,
  Separator,
  Stack,
  state,
  Tab,
  Tabs,
  Text,
  TextField,
  type WidgetProps,
} from "../../runtime/index.ts";
import type { initialRackState, RackData } from "./manifest.ts";

// shortcut: Send uses a committed draft; revisit when intents can bind local input values.
export function RackModule({
  state: s,
  data,
}: WidgetProps<object, typeof initialRackState, RackData, { size: string }>) {
  return (
    <Box surface="surface.module" padding="space.3">
      <Stack gap="space.3">
        <Inline key="rail" gap="space.2" align="center">
          <Box key="patch" fill="patch.1" radius="full" padding="space.0" width="space.2" height="space.2" />
          <Text key="ordinal" text="05" textStyle="mono" />
          <Text key="session" text="Coding Agent · clay" textStyle="meta" />
        </Inline>
        <Inline key="head" gap="space.2" align="center" wrap="wrap">
          <Icon name="info" />
          <Heading text="agent info" level={2} />
          <Text key="target" text="Coding Agent" />
          <Text key="badge" text="coding-agent" textStyle="meta" />
          <Button
            label="Close container"
            icon="close"
            variant="ghost"
            onPress={action("container.close", { containerId: data.containerId })}
          />
        </Inline>
        <Heading text="Files this session touched" level={3} />
        <Tabs label="Information tabs" value={s.tab} onChange={state.set("tab")}>
          <Tab key="files" label="Files" value="files">
            <Stack gap="space.2">
              {data.files.map((file) => (
                <Inline key={file.name} gap="space.2">
                  <Text key="status" text={file.status} textStyle="mono" />
                  <Text key="name" text={file.name} />
                  <Text key="operation" text={file.operation} textStyle="meta" tone="muted" />
                </Inline>
              ))}
              <Text text={`${data.files.length} files · session`} textStyle="meta" tone="muted" />
            </Stack>
          </Tab>
          <Tab key="om" label="OM" value="om">
            <Text text="No OM fixture data" />
          </Tab>
          <Tab key="context" label="Context" value="context">
            <Text text="37k / 96k · 38%" />
          </Tab>
        </Tabs>
        <Separator />
        <TextField
          label="Message to Coding Agent"
          multiline
          placeholder="Ask the agent…"
          value={s.draft}
          maxLength={10000}
          onChange={state.set("draft")}
        />
        <Text key="commit" text="Leave the field to commit your draft before Send." textStyle="meta" tone="muted" />
        <Text key="context" text="Context: 37k / 96k · 38%" textStyle="meta" />
        <Inline key="params" gap="space.2" align="center" wrap="wrap">
          <Box key="lamp" fill="accent.primary" radius="full" padding="space.0" width="space.2" height="space.2" />
          <Text key="working" text="Working" />
          <Box key="jack" fill="patch.1" radius="full" padding="space.0" width="space.2" height="space.2" />
          <Text key="agent" text="Coding Agent" />
          <Text key="model" text="Model: sonnet-4.6" />
          <Text key="effort" text="Effort: high" />
          {[1, 2, 3].map((pip) => (
            <Box
              key={pip}
              fill="accent.primary"
              radius="radius.plate"
              padding="space.0"
              width="space.1"
              height="space.2"
            />
          ))}
          {s.draft.length > 0 ? (
            <Button
              label="Send"
              variant="primary"
              onPress={action("agent.send", { sessionId: data.sessionId, message: s.draft })}
            />
          ) : (
            <Button label="Send" variant="primary" disabled />
          )}
        </Inline>
      </Stack>
    </Box>
  );
}
