import { compileValidator, type Intent, type IntentOrigin, validateCapabilities } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { useMemo } from "react";
import capabilities from "../../src/__tests__/fixtures/widgets/capabilities.json";
import { catalog } from "../css/fixtures.ts";
import { systems, themes } from "../css/sheets.ts";
import { implementations } from "../renderer/primitives/index.tsx";
import type { Snapshot } from "./pages.ts";

const checked = validateCapabilities(capabilities);
if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
const installedCapabilities = checked.value;
const { Surface } = createRenderer({ catalog, implementations });
const fallback = <p>Widget unavailable</p>;
export function ProofSurface({
  snapshot,
  onIntent,
  designSystem = "certified",
}: {
  snapshot: Snapshot;
  onIntent: (intent: Intent, origin: IntentOrigin) => void;
  designSystem?: keyof typeof systems;
}) {
  const validator = useMemo(
    () => compileValidator({ catalog, capabilities: installedCapabilities, manifest: snapshot.manifest }),
    [snapshot.manifest],
  );
  return (
    <Surface
      tree={snapshot.tree}
      validator={validator}
      theme={themes[designSystem]}
      designSystem={systems[designSystem]}
      onIntent={onIntent}
      fallback={fallback}
    />
  );
}
