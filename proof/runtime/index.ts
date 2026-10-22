import { definitions } from "../catalog/definitions.ts";
import { primitive } from "./jsx-runtime.ts";
import type { PrimitiveDefinition, PrimitiveProps, WidgetElement } from "./types.ts";

type Primitives = {
  readonly [D in PrimitiveDefinition as Capitalize<D["kind"]>]: (props: PrimitiveProps<D>) => WidgetElement;
};

// The catalog's literals supply both the component names and their prop contracts.
const primitives = Object.fromEntries(
  definitions.map((definition) => [
    definition.kind[0]?.toUpperCase() + definition.kind.slice(1),
    primitive(definition),
  ]),
) as unknown as Primitives;

export const {
  Box,
  Stack,
  Inline,
  Grid,
  Scroll,
  Separator,
  Text,
  Heading,
  Icon,
  Image,
  Link,
  Button,
  TextField,
  Select,
  Checkbox,
  Switch,
  Menu,
  MenuItem,
  Popover,
  Dialog,
  Tooltip,
  Tabs,
  Tab,
  Disclosure,
} = primitives;
export const proofCatalog = { catalogId: "proof@1", definitions } as const;
export { WidgetError } from "./errors.ts";
export { action, state } from "./intents.ts";
export { render } from "./render.ts";
export type { Child, Intent, Json, RenderOptions, UiNode, UiTree, WidgetElement, WidgetProps } from "./types.ts";
export { validate } from "./validate.ts";
