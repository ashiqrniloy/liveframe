// Run by `bun scripts/release/archive-gate.ts --dir packages/a2ui` in the install directory, outside the checkout:
// the installed package must load with only its core peer, convert an A2UI surface, and its output must pass the
// core's compiled validator (the gate copies the proof catalog and capabilities into ./fixtures).
import { compileValidator, validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import { ephemeralManifest, renderElements } from "@arnilo/liveframe/sdk";
import { fromA2ui } from "@arnilo/liveframe-a2ui";
import capabilitiesJson from "./fixtures/capabilities.json" with { type: "json" };
import catalogJson from "./fixtures/catalog.json" with { type: "json" };

const must = <T>(result: { ok: true; value: T } | { ok: false; errors: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
};
const catalog = must(validateCatalog(catalogJson));
const capabilities = must(validateCapabilities(capabilitiesJson));
const catalogId = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json";
const jsonl = [
  { version: "v0.9.1", createSurface: { surfaceId: "main", catalogId } },
  {
    version: "v0.9.1",
    updateComponents: {
      surfaceId: "main",
      components: [
        { id: "root", component: "Column", children: ["title", "claim"] },
        { id: "title", component: "Text", text: { path: "/title" } },
        {
          id: "claim",
          component: "Button",
          child: "label",
          action: { event: { name: "claim", context: { id: "t1" } } },
        },
        { id: "label", component: "Text", text: "Claim" },
      ],
    },
  },
  { version: "v0.9.1", updateDataModel: { surfaceId: "main", value: { title: "Write the report" } } },
]
  .map((message) => JSON.stringify(message))
  .join("\n");

const converted = must(
  fromA2ui(jsonl, {
    catalogId,
    components: {
      Column: { kind: "stack" },
      Text: { kind: "text", props: { text: "text" } },
      Button: { kind: "button", lift: { child: "label" }, event: "onPress" },
    },
    actions: { claim: "tasks.claim" },
  }),
);
const validator = compileValidator({
  catalog,
  capabilities,
  manifest: ephemeralManifest({ catalogId: catalog.catalogId, actions: ["tasks.claim"] }),
});
const tree = must(renderElements(converted.elements, { validator, surfaceId: "smoke", revision: 0 }));
if (tree.root.children?.[0]?.props.text !== "Write the report") throw new Error("The data path did not resolve");
if (fromA2ui(jsonl.replace('"text":"Claim"', '"text":{"call":"now"}'), { catalogId, components: {} }).ok)
  throw new Error("A refused construct converted");
console.log("a2ui converts, and its output passes the compiled validator");
