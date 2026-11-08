/** @jsxImportSource @arnilo/liveframe/sdk */
import { type ActionStatus, action, ex, local, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { Button, Heading, Inline, Stack, Text, TextField } from "./ui.gen.ts";

type Params = { pageSize: number };
type State = { cursor: number };
type Task = { id: string; title: string; owner: string };
type Data = { tasks: { items: Task[]; more: boolean } };
type Results = Readonly<Record<string, ActionStatus<{ readonly owner: string }>>>;

export default function Queue({ params, state: s, data, actions }: WidgetProps<Params, State, Data, object, Results>) {
  return (
    <Stack gap="space.3" padding="space.4" label="Task queue">
      <Heading text="Task queue" level={2} />
      {/* The filter is local state: it hides rows already in the tree, with no request. */}
      <TextField key="filter" label="Filter this page" placeholder="Type, then press Enter" onChange={local.set("q")} />
      {data.tasks.items.map((task) => {
        const claim = actions[`claim:${task.id}`];
        return (
          <Inline key={task.id} gap="space.2" when={ex.contains(task.title, local("q"))}>
            <Text key="title" text={task.title} />
            {task.owner === "" ? (
              <Button
                key="claim"
                label={claim?.status === "pending" ? "Claiming…" : "Claim"}
                variant="primary"
                disabled={claim?.status === "pending"}
                onPress={action("tasks.claim", { id: task.id }, { resultKey: `claim:${task.id}` })}
              />
            ) : (
              <Text key="owner" text={`Claimed by ${task.owner}`} />
            )}
            <Button key="select" label="Select" variant="ghost" onPress={action("selection.select", { id: task.id })} />
          </Inline>
        );
      })}
      <Inline gap="space.2">
        {s.cursor > 0 ? (
          <Button
            key="previous"
            label="Previous"
            variant="ghost"
            onPress={state.set("cursor", Math.max(0, s.cursor - params.pageSize))}
          />
        ) : null}
        {data.tasks.more ? (
          <Button key="next" label="Next" variant="primary" onPress={state.set("cursor", s.cursor + params.pageSize)} />
        ) : null}
      </Inline>
    </Stack>
  );
}
