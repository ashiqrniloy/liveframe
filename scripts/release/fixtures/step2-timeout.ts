/** Gate step 2: a looping widget times out in the worker, and the next render recovers. */
import { pack } from "@arnilo/liveframe/pack";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { draft, inputs, packageOptions, valid } from "./gate.ts";

const options = await packageOptions();
const input = await draft();
const loop = valid(
  pack(
    {
      ...input,
      files: { "entry.ts": "export default () => { while (true) {} };" },
      entry: "entry.ts",
    },
    options,
  ),
);
const pkg = valid(pack(input, options));
const props = inputs(input);
const worker = workerRunner({ timeoutMs: 1500 });
try {
  const failed = await worker.render(loop, props, options);
  if (failed.ok || failed.errors[0]?.kind !== "limit-exceeded")
    throw new Error(`The looping widget did not time out: ${JSON.stringify(failed)}`);
  const next = await worker.render(pkg, props, options);
  if (!next.ok) throw new Error(`The worker did not recover: ${JSON.stringify(next.errors)}`);
} finally {
  worker.close();
}
console.log("worker timed out the loop and recovered");
