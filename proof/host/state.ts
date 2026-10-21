import type { PropSchema } from "../catalog/define.ts";
import { assertJson, freeze, isRecord } from "../runtime/data.ts";
import {
  type Intent,
  type RenderOptions,
  render,
  type UiNode,
  type UiTree,
  WidgetError,
  type WidgetProps,
} from "../runtime/index.ts";
import { checkSchema } from "../runtime/validate.ts";

export interface Snapshot {
  readonly tree: UiTree;
  readonly options: RenderOptions;
  readonly actions: readonly Intent[];
}
export class StaleRevision extends Error {}

export function createSurface<P, S extends object, D, C>(
  widget: (props: WidgetProps<P, S, D, C>) => unknown,
  initial: WidgetProps<P, S, D, C>,
  options: RenderOptions,
  actionSchemas: Readonly<Record<string, PropSchema>>,
) {
  const surfaceId = crypto.randomUUID();
  let inputs = structuredClone(initial);
  const draw = (next: typeof inputs, revision: number) => {
    const result = render(widget, next, { ...options, surfaceId, revision });
    if (result instanceof WidgetError) throw result;
    return result;
  };
  let tree = draw(inputs, 1);
  const actions: Intent[] = [];
  const snapshot = (): Snapshot => ({ tree, options, actions: [...actions] });
  return {
    snapshot,
    dispatch(revision: number, value: unknown): Snapshot {
      if (revision !== tree.revision) throw new StaleRevision("Stale surface revision");
      const reject = (): never => {
        throw new WidgetError("invalid-prop", "Invalid or unoffered intent", "intent");
      };
      assertJson(value, "intent");
      if (!isRecord(value)) return reject();
      const allowed = value.type === "setState" ? ["type", "key", "value"] : ["type", "name", "args"];
      if (Object.keys(value).some((key) => !allowed.includes(key))) return reject();
      const offered = (node: UiNode): boolean =>
        Object.values(node.events ?? {}).some((intent) =>
          intent.type === "setState"
            ? value.type === "setState" &&
              value.key === intent.key &&
              (!Object.hasOwn(intent, "value") || Bun.deepEquals(value.value, intent.value))
            : Bun.deepEquals(value, intent),
        ) || (node.children ?? []).some(offered);
      if (!offered(tree.root)) return reject();
      if (value.type === "setState") {
        if (typeof value.key !== "string" || !Object.hasOwn(options.state.properties, value.key)) return reject();
        const next = { ...inputs, state: { ...inputs.state, [value.key]: value.value } };
        // Commit state only after the entire rerender validates.
        const nextTree = draw(next as typeof inputs, tree.revision + 1);
        inputs = next as typeof inputs;
        tree = nextTree;
      } else if (value.type === "action") {
        if (
          typeof value.name !== "string" ||
          !options.actions.includes(value.name) ||
          !Object.hasOwn(actionSchemas, value.name)
        )
          return reject();
        const schema = actionSchemas[value.name];
        if (!schema) return reject();
        checkSchema(schema, value.args, "intent/args");
        actions.push(freeze(structuredClone(value)) as Intent);
      } else return reject();
      return snapshot();
    },
  };
}
export type HostedSurface = ReturnType<typeof createSurface>;
