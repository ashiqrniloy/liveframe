#!/usr/bin/env bun
/**
 * Plan 039 Task 3 (design G.8), operator side: the agent's only description of the catalog is a digest, and the host
 * renders what it writes with `renderElements` and `streamElements`.
 *
 *   bun scripts/agent-acceptance/digest-run.ts digest --out <dir>   # writes <dir>/catalog.digest.md for the agent
 *   bun scripts/agent-acceptance/digest-run.ts check <answer.json>  # renders the agent's element JSON, prints a report
 *
 * The host is the getting-started one: the starter catalog, the demo host's capabilities, and an ephemeral manifest
 * that offers `tasks.claim` and a `local` filter key `q`. The agent never sees this file or the repository.
 */
import { join } from "node:path";
import { compileValidator, type Result, validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import { ephemeralManifest, renderElements, streamElements } from "@arnilo/liveframe/sdk";
import { generateDigest } from "@arnilo/liveframe/sdk/gen";
import { createSurfaceCore, type NodeContext } from "@arnilo/liveframe/surface";
import capabilitiesJson from "../../examples/demo-host/capabilities.json" with { type: "json" };
import catalogJson from "../../packages/starter/src/catalog.json" with { type: "json" };
import type { UiNode } from "../../src/formats/tree.ts";
import { obj, str } from "../../src/schema.ts";

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const catalog = valid(validateCatalog(catalogJson));
const capabilities = valid(validateCapabilities(capabilitiesJson));
const local = obj({ q: str({ maxLength: 80 }) });
const [mode, arg, third] = process.argv.slice(2);

if (mode === "digest") {
  const out = third ?? (arg === "--out" ? undefined : arg);
  if (!out) throw new Error("usage: digest-run.ts digest --out <dir>");
  await Bun.write(join(out, "catalog.digest.md"), generateDigest(catalog, { capabilities, local, budget: 24_000 }));
  console.log(`Wrote ${join(out, "catalog.digest.md")}`);
} else if (mode === "check" && arg) {
  const text = await Bun.file(arg).text();
  const validator = compileValidator({
    catalog,
    capabilities,
    manifest: ephemeralManifest({
      catalogId: catalog.catalogId,
      actions: ["tasks.claim"],
      local,
      initialLocal: { q: "" },
    }),
  });
  const rendered = renderElements(JSON.parse(text), { validator, surfaceId: "agent-digest", revision: 1 });
  if (!rendered.ok) {
    console.log(JSON.stringify({ ok: false, errors: rendered.errors }, null, 2));
    process.exit(1);
  }
  // The same text streamed in 64-character chunks gives the same final tree.
  const stream = streamElements({ validator, surfaceId: "agent-digest", revision: 0 });
  let drawn = 0;
  for (let i = 0; i < text.length; i += 64) if (stream.push(text.slice(i, i + 64))?.ok) drawn++;
  const streamed = stream.end();
  const tree = rendered.value;
  const nodes: UiNode[] = [];
  const walk = (node: UiNode) => {
    nodes.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree.root);
  // Filtering in the browser: the surface core evaluates `when` over local state; no intent leaves it.
  const intents: unknown[] = [];
  const core = createSurfaceCore({ catalog, validator, onIntent: (intent) => void intents.push(intent) });
  const accepted = core.accept(tree);
  const contexts = (context: NodeContext | undefined): NodeContext[] =>
    context ? [context, ...context.items.flatMap((item) => contexts(item as NodeContext))] : [];
  const field = nodes.find((node) => Object.values(node.events ?? {}).some((intent) => intent.type === "setLocal"));
  const visible = (q: string) => {
    contexts(core.snapshot().root)
      .find((context) => context.id === field?.id)
      ?.emit("onChange", q);
    return contexts(core.snapshot().root)
      .filter((context) => nodes.find((node) => node.id === context.id)?.when)
      .map((context) => context.id);
  };
  const query = third ?? "a";
  console.log(
    JSON.stringify(
      {
        ok: true,
        nodes: nodes.length,
        kinds: [...new Set(nodes.map((node) => node.kind))],
        gated: nodes.filter((node) => node.when).length,
        bound: nodes.filter((node) => node.bind).length,
        claims: text.split('"tasks.claim"').length - 1,
        streamedTrees: drawn,
        streamEqualsRender: streamed.ok && JSON.stringify(streamed.value.root) === JSON.stringify(tree.root),
        accepted: accepted.ok,
        filterField: field?.id ?? null,
        gatedShown: { "": visible(""), [query]: visible(query) },
        intentsWhileFiltering: intents.length,
      },
      null,
      2,
    ),
  );
} else throw new Error("usage: digest-run.ts digest --out <dir> | check <answer.json>");
