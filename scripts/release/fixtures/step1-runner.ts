/** Gate step 1: pack, store, reload and render one draft through both runners. */
import { loadPlacement } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";
import { pack, verifyPackage } from "@arnilo/liveframe/pack";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { draft, inputs, packageOptions, valid } from "./gate.ts";

const options = await packageOptions();
const input = await draft();
const pkg = valid(pack(input, options));
valid(verifyPackage(pkg, options));
for (const specifier of ["sdk", "sdk/jsx-runtime", "sdk/jsx-dev-runtime"])
  if (!pkg.code.includes(`"@arnilo/liveframe/${specifier}"`)) throw new Error(`Code never imports ${specifier}`);

const dir = new URL("./store/", import.meta.url).pathname;
const placement = {
  id: "card",
  slot: "home.main",
  widget: { id: pkg.manifest.id, version: pkg.manifest.version },
  params: {},
};
const store = fileStore(dir);
await store.putPackage(pkg);
await store.putPlacement(placement);

const loaded = valid(await loadPlacement(fileStore(dir), placement.id, options));
if (loaded.package.hash !== pkg.hash) throw new Error("The reloaded package has another hash");
const props = { ...inputs(input), params: loaded.params, state: loaded.state };
const worker = workerRunner({ timeoutMs: 2000 });
try {
  const inProcess = valid(await inProcessRunner().render(loaded.package, props, options));
  const isolated = valid(await worker.render(loaded.package, props, options));
  const kinds = JSON.stringify(inProcess);
  if (kinds !== JSON.stringify(isolated)) throw new Error("The two runners rendered different trees");
  if (!kinds.includes('"heading"') || !kinds.includes("Installed archive"))
    throw new Error(`Unexpected tree: ${kinds.slice(0, 200)}`);
} finally {
  worker.close();
}
console.log("packed, stored, reloaded and rendered with both runners");
