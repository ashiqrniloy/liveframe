/** @jsxImportSource ../runtime */
import { queueFixture } from "../host/fixtures/queue.ts";
import {
  action,
  Button,
  Heading,
  Inline,
  proofCatalog,
  type RenderOptions,
  Stack,
  state,
  Text,
  TextField,
  type WidgetProps,
} from "../runtime/index.ts";

export const harnessInputs = {
  params: {},
  state: { selected: "task:0", query: "" },
  data: queueFixture,
  context: { size: "full" },
};
export const harnessOptions: RenderOptions = {
  catalog: proofCatalog,
  actions: ["tasks.claim"],
  state: {
    type: "object",
    properties: { selected: { type: "string", maxLength: 128 }, query: { type: "string", maxLength: 100 } },
    required: ["selected", "query"],
    additionalProperties: false,
  },
  context: {
    type: "object",
    properties: { size: { type: "string", enum: ["small", "medium", "large", "full"] } },
    required: ["size"],
    additionalProperties: false,
  },
};
export const harnessActions = {
  "tasks.claim": {
    type: "object",
    properties: { id: { type: "string", maxLength: 128 } },
    required: ["id"],
    additionalProperties: false,
  },
} as const;

// shortcut: retained on the design-system page until Task 10 uses the reference widgets.
export function harnessWidget({
  state: s,
  data,
  context,
}: WidgetProps<
  typeof harnessInputs.params,
  typeof harnessInputs.state,
  typeof harnessInputs.data,
  typeof harnessInputs.context
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
