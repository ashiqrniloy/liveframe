/** @jsxImportSource @arnilo/liveframe/sdk */
import { expect, test } from "bun:test";
import { action, state } from "@arnilo/liveframe/sdk";
import { Button, Checkbox, Grid, Select, Stack, Text, TextField } from "./fixtures/widgets/ui.gen.ts";

test("generated_types_reject_wrong_props", () => {
  const valid = [
    <Stack key="case-0" gap={{ base: "space.1", "bp.sm": "space.2" }}>
      <Text text="hello" />
    </Stack>,
    <Button key="case-1" label="Save" onPress={action("save")} />,
    <Button key="case-2" label="Reset" onPress={state.set("query", "")} />,
    <TextField key="case-3" label="Query" value="" onChange={state.set("query")} />,
    <TextField key="case-4" label="Query" value="" onChange={action("search", {}, { bind: "query" })} />,
    <Checkbox key="case-5" label="Active" checked onChange={state.set("active")} />,
    <Grid key="case-6" columns={["1fr", "size.rail"]} width="56ch" />,
    <Select key="case-7" label="Pick" value="a" options={[{ value: "a", label: "A" }]} />,
  ];
  expect(valid).toHaveLength(8);

  // @ts-expect-error: raw CSS is outside the vocabulary
  const gap = <Stack gap="13px" />;
  // @ts-expect-error: variants are closed
  const variant = <Button label="A" variant="unknown" />;
  // @ts-expect-error: events carry intent data
  const callback = <Button label="A" onPress={() => {}} />;
  // @ts-expect-error: a no-value event cannot fill an implicit state value
  const implicit = <Button label="A" onPress={state.set("query")} />;
  // @ts-expect-error: a no-value event cannot bind an action argument
  const bound = <Button label="A" onPress={action("save", {}, { bind: "query" })} />;
  const children = (
    // @ts-expect-error: text has no children
    <Text text="A">
      <Text text="B" />
    </Text>
  );
  // @ts-expect-error: required text is missing
  const missing = <Text />;
  // @ts-expect-error: undeclared breakpoint
  const breakpoint = <Stack gap={{ base: "space.1", "bp.unknown": "space.2" }} />;
  // @ts-expect-error: base is required
  const base = <Stack gap={{ "bp.sm": "space.1" }} />;
  // @ts-expect-error: fill is a declared fillable role
  const fill = <Stack fill="text.primary" />;
  // @ts-expect-error: nested schema fields are typed
  const nested = <Select label="Pick" value="a" options={[{ value: 1, label: "A" }]} />;
  expect([gap, variant, callback, implicit, bound, children, missing, breakpoint, base, fill, nested]).toHaveLength(11);
});
