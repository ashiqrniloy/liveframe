/** @jsxImportSource ../../runtime */
import { Box, Inline, Separator, Stack, Text } from "../../runtime/index.ts";

// Two facts sit side by side on the artifact's 2-column auto-fit grid, one column when narrow.
export function Facts({ facts }: { facts: readonly { readonly label: string; readonly value: string }[] }) {
  return (
    <Box key="facts">
      <Separator key="rule" />
      <Inline
        wrap={{ base: "wrap", "bp.sm": "nowrap" }}
        align="start"
        paddingTop="space.3"
        gap={{ base: "space.3", "bp.sm": "space.5" }}
      >
        {facts.map((fact) => (
          <Stack key={fact.label} semantics="terms" gap="space.0" width={{ base: "fill", "bp.sm": "48.67%" }}>
            <Inline key="term" semantics="term">
              <Text text={fact.label} textStyle="meta" tone="muted" />
            </Inline>
            <Inline key="detail" semantics="detail">
              <Text text={fact.value} textStyle="meta" />
            </Inline>
          </Stack>
        ))}
      </Inline>
    </Box>
  );
}
