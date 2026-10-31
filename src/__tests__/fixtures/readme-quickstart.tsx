import { type Catalog, compileValidator, defineComponent, obj, str, type UiTree } from "@arnilo/liveframe";
import { createRenderer, implement } from "@arnilo/liveframe/react";

const text = defineComponent({
  kind: "text",
  description: "One line of text.",
  props: obj({ value: str({ maxLength: 200 }) }),
  children: "none",
  variants: ["default"],
  defaultVariant: "default",
  slots: ["root"],
  events: {},
  styleProps: [],
  a11y: { role: "paragraph" },
});

const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "The app's primitives.",
  vocabulary: {
    colourRoles: ["text.primary", "surface.base", "accent.primary"],
    surfaceRoles: ["surface.base"],
    fillableRoles: ["accent.primary"],
    typographyRoles: ["body"],
    space: ["space.1"],
    radius: ["radius.control"],
    size: ["size.glyph"],
    breakpoints: ["bp.sm"],
    tones: { default: "text.primary" },
    surfaceTypography: "body",
  },
  definitions: [text],
} as const satisfies Catalog;

const capabilities = { format: "liveframe-capabilities/1", sources: {}, actions: {} };
const manifest = {
  format: "liveframe-manifest/1",
  id: "hello",
  version: "1.0.0",
  catalogId: catalog.catalogId,
  params: obj({}),
  state: obj({}),
  context: obj({}),
  initialState: {},
  sources: {},
  actions: [],
};

const Text = implement(text, ({ props, slot, style }) => (
  <p className={slot("root")} style={style}>
    {props.value}
  </p>
));
const { Surface } = createRenderer({ catalog, implementations: [Text] });
const validator = compileValidator({ catalog, capabilities, manifest });
const identity = { id: "acme", version: "1.0.0" };

/** Draw a validated tree that the app's backend rendered. */
export function Hello({
  tree,
  onIntent,
}: {
  tree: unknown;
  onIntent: (intent: { type: "setState" | "action" }) => void;
}) {
  return (
    <Surface
      tree={tree}
      validator={validator}
      theme={identity}
      designSystem={identity}
      onIntent={onIntent}
      fallback={null}
    />
  );
}

export const tree: UiTree = {
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "hello",
  revision: 1,
  root: { id: "root", kind: "text", props: { value: "Hello from Liveframe" } },
};
