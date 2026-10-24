import { type Catalog, compileValidator, defineComponent, type Intent, obj, str, type UiTree } from "@arnilo/liveframe";
import { createRenderer, implement } from "@arnilo/liveframe/react";
import vocabulary from "./vocabulary.json" with { type: "json" };

export const button = defineComponent({
  kind: "button",
  description: "Requests an operation.",
  props: obj({ label: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: { onPress: { carries: "none", description: "Pressed." } },
  styleProps: [],
  a11y: { role: "button", name: "label" },
});
export const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "App primitives.",
  vocabulary,
  definitions: [button],
} as const satisfies Catalog;
export const capabilities = {
  format: "liveframe-capabilities/1",
  sources: {},
  actions: { "tasks.claim": { description: "Claim a task.", args: obj({ id: str({ maxLength: 128 }) }) } },
};
export const manifest = {
  format: "liveframe-manifest/1",
  id: "claim",
  version: "1.0.0",
  catalogId: catalog.catalogId,
  params: obj({}),
  state: obj({}),
  context: obj({}),
  initialState: {},
  sources: {},
  actions: ["tasks.claim"],
};

const Button = implement(button, ({ props, slot, style, emit }) => (
  <button type="button" className={slot("root")} style={style} onClick={() => emit("onPress")}>
    <span className={slot("label")}>{props.label}</span>
  </button>
));
const { Surface } = createRenderer({ catalog, implementations: [Button] });
export const validator = compileValidator({ catalog, capabilities, manifest });
export const tree: UiTree = {
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "claim-panel",
  revision: 1,
  root: {
    id: "root",
    kind: "button",
    props: { label: "Claim" },
    events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
  },
};
export const identity = { id: "acme", version: "1.0.0" };

export function GuideSurface({ tree, onIntent }: { tree: unknown; onIntent: (intent: Intent) => void }) {
  return (
    <Surface
      tree={tree}
      validator={validator}
      theme={identity}
      designSystem={identity}
      onIntent={onIntent}
      fallback={<p>Unavailable</p>}
    />
  );
}
