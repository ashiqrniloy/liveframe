/** @jsxImportSource ../runtime */
import { expect, test } from "bun:test";
import {
  action,
  Box,
  Button,
  Grid,
  Heading,
  Menu,
  MenuItem,
  render,
  Stack,
  Text,
  WidgetError,
} from "../runtime/index.ts";
import type { Child } from "../runtime/types.ts";
import { inputs, options } from "./runtime.test.ts";

function Card({ title, children }: { readonly title: string; readonly children?: Child }) {
  return (
    <Stack>
      <Heading text={title} level={2} />
      {children}
    </Stack>
  );
}

test("automatic_jsx_runtime_expands_typed_catalog_primitives", () => {
  const widget = () => (
    <Grid columns={["1fr", "32ch"]} gap="space.3">
      <Stack key="rows">
        {["a", "b"].map((id) => (
          <Card key={id} title={id}>
            <Button label="Open" onPress={action("tasks.open", { id })} />
          </Card>
        ))}
      </Stack>
      <Menu label="More">
        <MenuItem label="Open" onPress={action("tasks.open")} />
      </Menu>
    </Grid>
  );
  const result = render(widget, inputs, options);
  expect(result).not.toBeInstanceOf(WidgetError);
  if (result instanceof WidgetError) throw result;
  expect(result.root.children?.[0]?.children?.[1]?.children?.[0]?.id).toBe("root/rows/b/heading");
  expect(result.root.children?.[1]?.kind).toBe("menu");
});

// These expressions are compiled by the proof typecheck, never rendered.
function invalidProps() {
  // @ts-expect-error required prop comes from the catalog schema
  <Button />;
  // @ts-expect-error variants are catalog literals
  <Button label="x" variant="invented" />;
  // @ts-expect-error props stay closed
  <Button label="x" className="raw" />;
  // @ts-expect-error events carry data, not callbacks
  <Button label="x" onPress={() => {}} />;
  // @ts-expect-error primitive does not declare this style prop
  <Button label="x" padding="space.2" />;
  // @ts-expect-error spacing is token constrained
  <Stack gap="13px" />;
  <Text text="x">
    {/* @ts-expect-error childless primitive */}
    <Button label="x" />
  </Text>;
  // @ts-expect-error host elements are forbidden
  <div />;
  // @ts-expect-error enum values come from the schema
  <Text text="x" tone="red" />;
  // @ts-expect-error nested schemas remain typed
  <MenuItem label={42} />;
  // @ts-expect-error radius takes a declared radius name or full
  <Box radius="4px" />;
  // @ts-expect-error position is a closed enum
  <Box position="fixed" />;
  // @ts-expect-error fill takes a declared fillable role
  <Box fill="surface.raised" />;
  // @ts-expect-error a responsive value needs its base value
  <Grid columns={{ "bp.md": ["1fr"] }} />;
  // @ts-expect-error breakpoints are declared
  <Grid columns={{ base: ["1fr"], "bp.lg": ["1fr"] }} />;
  // @ts-expect-error text alignment is a closed enum
  <Text text="x" textAlign="justify" />;
}
void invalidProps;

// Typed style props that must compile.
function validProps() {
  <Box position="sticky" insetTop="space.3" radius="radius.plate" fill="accent.soft" />;
  <Grid columns={{ base: ["1fr"], "bp.md": ["1fr", "size.rail"] }} />;
  <Text text="x" textAlign="center" />;
  <Button label="x" align="start" />;
}
void validProps;
