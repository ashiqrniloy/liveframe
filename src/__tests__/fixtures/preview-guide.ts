import type { Result } from "@arnilo/liveframe";
import { createPreview, inProcessRunner } from "@arnilo/liveframe/preview";
import { memoryStore } from "@arnilo/liveframe/store";
import { capabilities, catalog, draft } from "./preview-guide-host.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

// Use the runner your production backend uses: preview and production must agree.
const session = createPreview({ catalog, capabilities, runner: inProcessRunner() });

const pkg = value(session.update(draft)); // Packs the draft; nothing is stored.
const tree = value(await session.render({ scenario: "ready" })); // Send this tree to the browser.

// A cell's setState re-renders inside the session.
const filtered = value(await session.intent({ type: "setState", key: "filter", value: "tasks" }));

// An action is checked and logged. Preview never dispatches it.
await session.intent({ type: "action", name: "tasks.claim", args: { id: "t1" } });
const log = session.intents();

// Every scenario must render before you publish.
const checks = value(await session.check());
if (checks.some(({ result }) => !result.ok)) throw new Error("A scenario fails");

// Publishing stores exactly the package the session returned.
const store = memoryStore();
await store.putPackage(pkg);

export { filtered, log, pkg, store, tree };
