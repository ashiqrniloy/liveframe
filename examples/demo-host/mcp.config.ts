import { pack } from "@arnilo/liveframe/pack";
import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { capabilities, catalog } from "./app.ts";
import { previewRoutes } from "./preview.ts";
import { readDraft } from "./widgets/draft.ts";

// The shared library the host installs (`widgets/cards`), supplied to every draft the agent writes. The agent reads it
// with `list_libraries` and imports `liveframe:lib/acme.cards@1.0.0`; it cannot add a library of its own.
const cards = pack(await readDraft(new URL("./widgets/cards/", import.meta.url).pathname), { catalog, capabilities });
if (!cards.ok) throw new Error(`widgets/cards does not pack: ${JSON.stringify(cards.errors)}`);

// The same runner the demo host renders with, so an agent previews what a viewer will get.
const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: workerRunner(),
  libraries: [cards.value],
  // The demo's own <Preview> page, bound to the server's session. `liveframe mcp` captures it.
  async preview(binding) {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      routes: await previewRoutes(binding),
    });
    return { url: new URL("/preview", server.url).href, close: () => server.stop(true) };
  },
};

export default config;
