// The surface core (spec §11): the framework-independent half of a renderer. Host-API-free.
export type { LocalState } from "./bindings.ts";
export {
  createSurfaceCore,
  type EventMeta,
  type NodeContext,
  type SurfaceCore,
  type SurfaceCoreOptions,
  type SurfaceEvent,
  type SurfaceSnapshot,
} from "./core.ts";
