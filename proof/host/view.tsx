import { definitions } from "../catalog/definitions.ts";
import { implementations } from "../renderer/primitives/index.tsx";
import { registry } from "../renderer/registry.ts";
import { Surface } from "../renderer/surface.tsx";
import type { Intent } from "../runtime/types.ts";
import type { Snapshot } from "./state.ts";

const registered = registry({ definitions }, implementations);
export function ProofSurface({ snapshot, onIntent }: { snapshot: Snapshot; onIntent: (intent: Intent) => void }) {
  return (
    <Surface
      tree={snapshot.tree}
      options={snapshot.options}
      registry={registered}
      onIntent={onIntent}
      fallback={<p>Widget unavailable</p>}
    />
  );
}
