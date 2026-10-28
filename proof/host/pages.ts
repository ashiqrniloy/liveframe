import {
  checkOffered,
  compileValidator,
  type IntentOrigin,
  checkValue,
  type Intent,
  type Json,
  type Manifest,
  type UiNode,
  type UiTree,
} from "@arnilo/liveframe";
import { pack, type WidgetPackage } from "@arnilo/liveframe/pack";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import type { WidgetProps } from "@arnilo/liveframe/sdk";
import { drafts, packageOptions, value } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { proofWidgets } from "../../src/__tests__/fixtures/widgets/index.ts";

export const pages = {
  "agent-home": "Synapta's agent-home queue",
  "core-queue": "Core queue at four sizes",
  "git-status": "Clay's git status",
  "rack-module": "Rack agent information module",
  "design-system": "Design-system switch — Synapta queue (also try Clay’s git status)",
  harness: "Host protocol smoke fixture",
} as const;
export const packages = new Map(
  proofWidgets.map((fixture, i) => {
    const draft = drafts[i];
    if (!draft) throw new Error("Missing widget draft");
    return [fixture.name, value(pack(draft, packageOptions))];
  }),
);
export const runner = inProcessRunner();
export class StaleRevision extends Error {}
export class InvalidIntent extends Error {}
export interface Snapshot {
  readonly tree: UiTree;
  readonly manifest: Manifest;
  readonly actions: readonly Intent[];
}
export async function createSession(pkg: WidgetPackage, initial: WidgetProps) {
  const surfaceId = crypto.randomUUID();
  const validator = compileValidator({ ...packageOptions, manifest: pkg.manifest });
  let inputs = structuredClone(initial);
  const draw = async (next: WidgetProps, revision: number) =>
    value(await runner.render(pkg, next, { ...packageOptions, surfaceId, revision }));
  let tree = await draw(inputs, 1);
  const actions: Intent[] = [];
  const snapshot = (): Snapshot => ({ tree, manifest: pkg.manifest, actions: structuredClone(actions) });
  return {
    snapshot,
    async dispatch(revision: number, intent: unknown, origin?: IntentOrigin): Promise<Snapshot> {
      // No await before this check; commit only after the new tree validates.
      if (revision !== tree.revision) throw new StaleRevision("Stale surface revision");
      const reject = (): never => {
        throw new InvalidIntent("Invalid or unoffered intent");
      };
      if (!intent || typeof intent !== "object" || Array.isArray(intent)) return reject();
      const candidate = intent as Record<string, unknown>;
      const allowed = candidate.type === "setState" ? ["type", "key", "value"] : ["type", "name", "args"];
      if (Object.keys(candidate).some((key) => !allowed.includes(key))) return reject();
      const offered = (node: UiNode): boolean =>
        Object.keys(node.events ?? {}).some(
          (event) =>
            checkOffered(
              tree,
              { surfaceId, revision: tree.revision, nodeId: node.id, event },
              intent as Intent,
              validator,
            ).ok,
        ) || (node.children ?? []).some(offered);
      if (origin !== undefined ? !checkOffered(tree, origin, intent as Intent, validator).ok : !offered(tree.root))
        return reject();
      if (candidate.type === "setState") {
        if (typeof candidate.key !== "string" || !Object.hasOwn(pkg.manifest.state.properties, candidate.key))
          return reject();
        const nextState = { ...(inputs.state as Record<string, Json>), [candidate.key]: candidate.value };
        if (!checkValue(pkg.manifest.state, nextState).ok) return reject();
        const next = { ...inputs, state: nextState as Record<string, Json> };
        const nextTree = await draw(next, revision + 1);
        // Concurrent requests cannot overwrite a tree accepted while the runner was pending.
        if (revision !== tree.revision) throw new StaleRevision("Stale surface revision");
        inputs = next;
        tree = nextTree;
      } else if (candidate.type === "action") {
        if (
          typeof candidate.name !== "string" ||
          !pkg.manifest.actions.includes(candidate.name) ||
          !Object.hasOwn(packageOptions.capabilities.actions, candidate.name)
        )
          return reject();
        const capability = packageOptions.capabilities.actions[candidate.name];
        if (!capability || !checkValue(capability.args, candidate.args).ok) return reject();
        actions.push(structuredClone(candidate) as Intent);
      } else return reject();
      return snapshot();
    },
  };
}
export type HostedSurface = Awaited<ReturnType<typeof createSession>>;
export async function openPage(size: string, name = "core-queue", scenario?: string) {
  const pkg = packages.get(name === "design-system" ? "agent-home" : name);
  if (!pkg) throw new Error("Unknown page");
  const selected =
    scenario ??
    (name === "core-queue"
      ? `host-${size}`
      : name === "agent-home" || name === "design-system"
        ? "host-ready"
        : "ready");
  const input = pkg.scenarios.find((entry) => entry.name === selected);
  if (!input) throw new Error("Unknown package scenario");
  return createSession(pkg, {
    ...input,
    state: input.state ?? pkg.manifest.initialState,
    context: { ...(input.context as Record<string, Json>), size },
  });
}
