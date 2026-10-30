// node --experimental-vm-modules vm-validator.mjs <bundle.js> <request.json>
import { readFileSync } from "node:fs";
import vm from "node:vm";

const [bundlePath, requestPath] = process.argv.slice(2);
const context = vm.createContext({});
const validator = new vm.SourceTextModule(readFileSync(bundlePath, "utf8"), { context });
await validator.linkRequests([]);
validator.instantiate();
await validator.evaluate();

const harness = new vm.SourceTextModule(
  `import { compileValidator, checkOffered } from "validator";
   export function run(request) {
     const { catalog, capabilities, manifest, tree, origin, intent } = JSON.parse(request);
     const validator = compileValidator({ catalog, capabilities, manifest });
     return JSON.stringify({
       validated: validator.validateTree(tree),
       accepted: checkOffered(tree, origin, intent, validator),
       forged: checkOffered(tree, { ...origin, revision: 0 }, intent, validator),
     });
   }`,
  { context },
);
await harness.linkRequests([validator]);
harness.instantiate();
await harness.evaluate();
console.log(harness.namespace.run(readFileSync(requestPath, "utf8")));
