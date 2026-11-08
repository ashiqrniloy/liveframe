import { isThenable } from "../internal.ts";
import type { HostEvent } from "./types.ts";

/**
 * A containing reporter, or `undefined` without a handler: call it as `notify?.({ … })` and the event
 * is only built when someone listens. A throw or a rejected promise never reaches the pipeline.
 */
export function notifier(
  onEvent: ((event: HostEvent) => unknown) | undefined,
): ((event: HostEvent) => void) | undefined {
  if (!onEvent) return undefined;
  return (event) => {
    try {
      const result = onEvent(Object.freeze(event));
      if (isThenable(result)) Promise.resolve(result).then(undefined, () => undefined);
    } catch {
      // A host's logger must never break rendering.
    }
  };
}
