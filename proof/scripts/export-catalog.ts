// Regenerates the install-validator fixture; the full format exporter will reuse this conversion.
import { type Catalog, type LanguageSchema, validateCatalog } from "../../src/index.ts";
import { definitions } from "../catalog/definitions.ts";
import type { PropSchema } from "../catalog/define.ts";
import vocabulary from "../../src/__tests__/fixtures/vocabulary.json" with { type: "json" };

function schema(input: PropSchema): LanguageSchema {
  switch (input.type) {
    case "string":
      if (input.maxLength !== undefined) return { ...input, maxLength: input.maxLength };
      if (!input.enum) throw new Error("Cannot bound a proof string without an enum");
      return { ...input, maxLength: Math.max(...input.enum.map((value) => [...value].length)) };
    case "array":
      return { ...input, items: schema(input.items) };
    case "object":
      return {
        ...input,
        properties: Object.fromEntries(Object.entries(input.properties).map(([key, value]) => [key, schema(value)])),
      };
    default:
      return input;
  }
}

const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "proof.ui@1",
  description: "Phase 0 primitive catalog.",
  vocabulary,
  definitions: definitions.map((definition) => ({
    ...definition,
    description: `The ${definition.kind} primitive.`,
    props: schema(definition.props),
    defaultVariant: definition.variants[0],
    events: Object.fromEntries(
      Object.entries(definition.events).map(([name, event]) => [
        definition.kind === "textField" && name === "onSubmit" ? "onCommit" : name,
        { ...event, description: `The ${name} event.` },
      ]),
    ),
  })),
};
const result = validateCatalog(catalog);
if (!result.ok) throw new Error(JSON.stringify(result.errors));
if (result.value.definitions.length !== 24) throw new Error("Expected the 24-kind proof catalog");
const output: Catalog = result.value;
await Bun.write(
  new URL("../../src/__tests__/fixtures/catalog.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
