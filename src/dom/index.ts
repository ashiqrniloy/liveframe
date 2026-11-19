// The plain DOM adapter (spec §11): draws a surface with no framework, over the surface core. Client-only.
export { RendererError } from "../surface/registry.ts";
export {
  type DomImplementation,
  type DomItem,
  type DomNode,
  type Draw,
  type DrawHooks,
  implement,
} from "./implement.ts";
export { place } from "./place.ts";
export { createDomRenderer, type DomSurface, type MountOptions } from "./renderer.ts";
