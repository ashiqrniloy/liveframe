// Helpers shared by the template ports of the proof widgets (plan 028 Task 4).
import type { ObjectSchema } from "../../../formats/capabilities.ts";
import type { Manifest } from "../../../formats/manifest.ts";
import type { Expr, TemplateNode } from "../../../template/index.ts";
import { actionsSchema } from "../../../validate/actions.ts";
import capabilities from "../widgets/capabilities.json" with { type: "json" };

export const p = (path: string): Expr => ({ $path: path });
export const lit = (value: Expr): Expr => ({ $lit: value });

export const text = (value: Expr, style: Record<string, unknown> = {}, key?: string): TemplateNode => ({
  kind: "text",
  ...(key ? { key } : {}),
  props: { text: value },
  style: style as never,
});

export const heading = (
  value: Expr,
  level: number,
  style: Record<string, unknown> = {},
  key?: string,
): TemplateNode => ({
  kind: "heading",
  ...(key ? { key } : {}),
  props: { text: value, level },
  style: style as never,
});

const groups = capabilities.sources["queue.groups"].result;
/** One queue row's schema, as the `queue.groups` source declares it. */
export const rowSchema = groups.items.properties.pages.items.properties.rows.items as unknown as ObjectSchema;

type Schemas = {
  params: ObjectSchema;
  state: ObjectSchema;
  context: ObjectSchema;
  data: ObjectSchema;
  actions: ObjectSchema;
};

/** The five input schemas of a manifest, `data` built from its sources' results (what `dataSchema` yields). */
export function inputSchemas(manifest: unknown): Schemas {
  const { params, state, context, sources } = manifest as Manifest;
  const properties = Object.fromEntries(
    Object.entries(sources).map(([alias, declared]) => [
      alias,
      (capabilities.sources as Record<string, { result: unknown }>)[declared.source]?.result,
    ]),
  );
  const data = { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
  return {
    params,
    state,
    context,
    data,
    actions: actionsSchema(manifest as Manifest, capabilities as never),
  } as unknown as Schemas;
}
