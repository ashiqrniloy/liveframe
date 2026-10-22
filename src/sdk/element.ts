/**
 * A private marker no author can forge: the frozen `{ kind }` record a primitive tag
 * stands for. `render()` reads it to tell a catalog primitive from a composed component.
 */
const PRIMITIVE = Symbol("liveframe.primitive");

/** An SDK element: a frozen record of a primitive, a composed component or a host tag. */
export class Element {
  readonly type: unknown;
  readonly props: Readonly<Record<string, unknown>>;
  readonly key: unknown;
  /** True when `jsxs` (or `jsxDEV`) produced the children as one static array. */
  readonly staticChildren: boolean;

  constructor(type: unknown, props: Readonly<Record<string, unknown>>, key: unknown, staticChildren: boolean) {
    this.type = type;
    this.props = props;
    this.key = key;
    this.staticChildren = staticChildren;
  }
}

/** The only way to know an element is one: a look-alike object is not. */
export function isElement(value: unknown): value is Element {
  return value instanceof Element;
}

/** A JSX component type: a primitive tag or an author's composed component. */
export type Component<Props = Record<string, unknown>> = (props: Props) => Element;

/**
 * Builds one primitive's JSX tag. `jsx` never calls it: the tag only records the
 * primitive's frozen type, and composed components expand inside `render()` (spec §7.1).
 */
export function primitive<Props = Record<string, unknown>>(kind: string): Component<Props> {
  const type = Object.freeze({ kind });
  const tag = (props: Props) => createElement(tag, props as Record<string, unknown>, undefined, false);
  Object.defineProperty(tag, PRIMITIVE, { value: type });
  return Object.freeze(tag) as Component<Props>;
}

/** Freezes one element. A `key` prop given to `jsx` as an argument wins over the props one. */
export function createElement(
  type: unknown,
  props: Record<string, unknown> | null,
  key: unknown,
  staticChildren: boolean,
): Element {
  const { key: propKey, ...rest } = props ?? {};
  if (Array.isArray(rest.children)) Object.freeze(rest.children);
  const resolved =
    typeof type === "function" ? ((type as unknown as Record<symbol, unknown>)[PRIMITIVE] ?? type) : type;
  return Object.freeze(new Element(resolved, Object.freeze(rest), key ?? propKey, staticChildren));
}
