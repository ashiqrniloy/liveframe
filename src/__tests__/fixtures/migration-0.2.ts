import type { Json } from "../../index.ts";
import { capture, type CaptureBackend } from "@arnilo/liveframe/preview/capture";
import type { Placement, Store } from "@arnilo/liveframe/store";

// Both samples below also appear verbatim in docs/migration-0.2.md; the guide test
// asserts that and runs these functions, so a guide edit that would not compile fails.

export async function scopedState(store: Store, placement: Placement, state: Json) {
  await store.putPlacement(placement);
  await store.putState(placement.id, "", state); // shared by every viewer
  await store.putState(placement.id, "viewer-7", state); // one viewer's own state
  const shared = await store.getState(placement.id, "");
  const mine = await store.getState(placement.id, "viewer-7");
  await store.deletePlacement(placement.id); // removes every scope
  return { shared, mine, afterDelete: await store.getState(placement.id, "viewer-7") };
}

export async function captureOnce(url: string, backend: CaptureBackend) {
  const { index, files } = await capture(url, { backend, scenarios: ["ready"] });
  return { index, files };
}
