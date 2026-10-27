import { LiveframeFailure } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { Placement, StyleRecord } from "../formats/records.ts";
import type { Json } from "../formats/tree.ts";
import type { Store } from "./index.ts";
import { assertScope } from "./scope.ts";

function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** Ephemeral records, isolated from caller mutation by JSON copies. */
export function memoryStore(): Store {
  const packages = new Map<string, WidgetPackage>();
  const placements = new Map<string, Placement>();
  const states = new Map<string, Map<string, Json>>();
  const styles = new Map<string, StyleRecord>();
  return {
    async putPackage(pkg) {
      const key = JSON.stringify([pkg.manifest.id, pkg.manifest.version]);
      const existing = packages.get(key);
      if (existing) {
        if (existing.hash === pkg.hash) return;
        throw new LiveframeFailure([
          {
            kind: "version-conflict",
            pointer: "",
            message: `${pkg.manifest.id}@${pkg.manifest.version} already stored with another hash`,
            expected: "a new version for changed content",
          },
        ]);
      }
      packages.set(key, copy(pkg));
    },
    async getPackage(id, version) {
      return copy(packages.get(JSON.stringify([id, version])));
    },
    async putPlacement(placement) {
      placements.set(placement.id, copy(placement));
    },
    async getPlacement(id) {
      return copy(placements.get(id));
    },
    async deletePlacement(id) {
      placements.delete(id);
      states.delete(id);
    },
    async listPlacements() {
      return copy([...placements.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
    },
    async putState(id, scope, state) {
      assertScope(scope);
      let scoped = states.get(id);
      if (!scoped) {
        scoped = new Map();
        states.set(id, scoped);
      }
      scoped.set(scope, copy(state));
    },
    async getState(id, scope) {
      assertScope(scope);
      return copy(states.get(id)?.get(scope));
    },
    async putStyle(style) {
      styles.set(JSON.stringify([style.kind, style.id, style.version]), copy(style));
    },
    async getStyle(kind, id, version) {
      return copy(styles.get(JSON.stringify([kind, id, version])));
    },
  };
}
