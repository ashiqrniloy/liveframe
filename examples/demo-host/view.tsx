import { compileValidator, type Intent, type IntentOrigin, type Manifest, type UiTree } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { useMemo } from "react";
import { capabilities, catalog, designSystem, theme } from "./app.ts";
import { implementations } from "./primitives/index.tsx";

const { Surface } = createRenderer({ catalog, implementations });
const fallback = <p>Widget unavailable</p>;

/** Draws a tree the server rendered. <Surface> validates every arrival against the widget's manifest (law 2). */
export function DemoSurface({
  tree,
  manifest,
  onIntent,
}: {
  tree: UiTree;
  manifest: Manifest;
  onIntent: (intent: Intent, origin: IntentOrigin) => void;
}) {
  const validator = useMemo(() => compileValidator({ catalog, capabilities, manifest }), [manifest]);
  return (
    <Surface
      tree={tree}
      validator={validator}
      theme={theme}
      designSystem={designSystem}
      onIntent={onIntent}
      fallback={fallback}
    />
  );
}
