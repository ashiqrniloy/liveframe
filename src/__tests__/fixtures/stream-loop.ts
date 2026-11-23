import { compileValidator } from "../../index.ts";
import { ephemeralManifest } from "../../sdk/elements.ts";
import capabilities from "./proof/capabilities.json" with { type: "json" };
import catalog from "./proof/catalog.json" with { type: "json" };

/** The validator the streaming-loop test and bench draw against: the proof catalog, no actions. */
export const streamLoopValidator = compileValidator({
  catalog,
  capabilities,
  manifest: ephemeralManifest({ catalogId: catalog.catalogId, actions: [] }),
});

/** An element document of `rows + 3` nodes: a stack holding a heading text and a stack of `rows` text rows. */
export function streamLoopDocument(rows: number): unknown {
  return {
    kind: "stack",
    props: { label: "Session" },
    children: [
      { kind: "text", key: "title", props: { text: "Agent session" } },
      {
        kind: "stack",
        key: "rows",
        props: {},
        children: Array.from({ length: rows }, (_, i) => ({ kind: "text", key: `r${i}`, props: { text: `Row ${i}` } })),
      },
    ],
  };
}

/** The text cut into chunks of `size` characters, as a model's tokens arrive. */
export function chunksOf(text: string, size: number): string[] {
  return Array.from({ length: Math.ceil(text.length / size) }, (_, i) => text.slice(i * size, (i + 1) * size));
}
