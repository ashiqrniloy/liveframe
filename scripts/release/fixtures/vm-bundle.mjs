// Runs the runner kit bundle outside Bun, in a fresh Node vm context with no host globals:
//   node --experimental-vm-modules vm-bundle.mjs <bundle.js> <request.json>
// The request carries { code, manifest, catalog, capabilities, inputs, surfaceId, revision }.
// It prints the renderModule() result as JSON, or `unsupported` when Node lacks linkRequests().
import { readFileSync } from "node:fs";
import vm from "node:vm";

const [bundlePath, requestPath] = process.argv.slice(2);
if (typeof vm.SourceTextModule?.prototype.linkRequests !== "function") {
  console.log("unsupported");
  process.exit(0);
}

const context = vm.createContext({});
const make = (identifier, source) => new vm.SourceTextModule(source, { identifier, context });

const kit = make("sandbox:kit", readFileSync(bundlePath, "utf8"));
// The packed code links its three SDK specifiers to the bundle's one namespace.
const harness = make(
  "sandbox:harness",
  `import * as kit from "sandbox:kit";
   import * as linked from "sandbox:linked";
   export const run = (request) => {
     const { manifest, catalog, capabilities, inputs, surfaceId, revision } = JSON.parse(request);
     return JSON.stringify({
       globals: { bun: typeof Bun, process: typeof process, require: typeof require },
       result: kit.renderModule(linked.default, inputs, { catalog, capabilities, manifest, surfaceId, revision }),
     });
   };`,
);
const request = readFileSync(requestPath, "utf8");
const { code } = JSON.parse(request);

await kit.linkRequests([]);
kit.instantiate();
await kit.evaluate();

const linked = kit.namespace.linkPackage(code, () => "sandbox:kit");
if (!linked.ok) throw new Error(JSON.stringify(linked.errors));
const widget = make("sandbox:linked", linked.value);
await widget.linkRequests(widget.moduleRequests.map(() => kit));
await harness.linkRequests(harness.moduleRequests.map(({ specifier }) => (specifier === "sandbox:kit" ? kit : widget)));
harness.instantiate();
await harness.evaluate();

console.log(harness.namespace.run(request));
