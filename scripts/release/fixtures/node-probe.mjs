// Gate step 7: the host-API-free subpaths run under plain Node, from another directory.
import { readFileSync } from "node:fs";
import { validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import { baseCss } from "@arnilo/liveframe/css";
import { catalogSuite } from "@arnilo/liveframe/conformance";
import { pack } from "@arnilo/liveframe/pack";
import { jsx, primitive } from "@arnilo/liveframe/sdk";
import { memoryStore } from "@arnilo/liveframe/store";

const read = (name) => JSON.parse(readFileSync(new URL(`./${name}.json`, import.meta.url), "utf8"));
const catalog = validateCatalog(read("catalog"));
const capabilities = validateCapabilities(read("capabilities"));
if (!catalog.ok || !capabilities.ok) throw new Error("The fixture documents do not validate");

const files = Object.fromEntries(
  ["entry.tsx", "card.tsx"].map((name) => [name, readFileSync(new URL(`./widget/${name}`, import.meta.url), "utf8")]),
);
const options = { catalog: catalog.value, capabilities: capabilities.value, surfaceId: "node", revision: 1 };
const packed = pack({ files, entry: "entry.tsx", manifest: read("manifest"), scenarios: [read("scenario")] }, options);
if (!packed.ok) throw new Error(JSON.stringify(packed.errors));

const checks = {
  validateCatalog: catalog.ok,
  "sdk.primitive": jsx(primitive("text"), { text: "ok" }).type !== undefined,
  "css.baseCss": baseCss(catalog.value).ok,
  "pack.pack": packed.ok,
  "store.memoryStore": (await memoryStore().getPlacement("missing")) === undefined,
  "conformance.catalogSuite":
    catalogSuite({
      ...options,
      manifest: read("manifest"),
      examples: [],
      published: catalog.value,
    }).length > 0,
};
for (const [name, passed] of Object.entries(checks)) if (!passed) throw new Error(`${name} failed`);
console.log(`node ${process.version} ran ${Object.keys(checks).length} entry points`);
