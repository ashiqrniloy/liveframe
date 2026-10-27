export {
  type Placement,
  type StyleRecord,
  validatePlacement,
  validateState,
  validateStyleRecord,
} from "../formats/records.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { Placement, StyleRecord } from "../formats/records.ts";
import type { Json } from "../formats/tree.ts";

/** One host-defined scope. Reads remain untrusted until validated. */
export interface Store {
  putPackage(pkg: WidgetPackage): Promise<void>;
  getPackage(id: string, version: string): Promise<WidgetPackage | undefined>;
  putPlacement(placement: Placement): Promise<void>;
  getPlacement(id: string): Promise<Placement | undefined>;
  deletePlacement(id: string): Promise<void>;
  listPlacements(): Promise<Placement[]>;
  putState(placementId: string, scope: string, state: Json): Promise<void>;
  getState(placementId: string, scope: string): Promise<Json | undefined>;
  putStyle(style: StyleRecord): Promise<void>;
  getStyle(kind: StyleRecord["kind"], id: string, version: string): Promise<StyleRecord | undefined>;
}

export { loadPlacement, verifyPlacementInputs } from "./load.ts";
export { memoryStore } from "./memory.ts";
