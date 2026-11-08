import { type Implementation, implement } from "@arnilo/liveframe/react";
import { createElement, type CSSProperties, type FormEvent, type ReactNode, useState } from "react";
import * as Aria from "react-aria-components";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Disclosure,
  Grid,
  Heading,
  Hint,
  Icon,
  Image,
  Inline,
  Link,
  Menu,
  MenuItem,
  Popover,
  Scroll,
  Select,
  Separator,
  Stack,
  Switch,
  Tab,
  Tabs,
  Text,
  TextField,
  Tooltip,
} from "./ui.definitions.gen.ts";

// A host-owned value follows the incoming one when the widget sends a new one, and is local between renders.
function useValue<T>(incoming: T) {
  const [value, setValue] = useState(incoming);
  const [previous, setPrevious] = useState(incoming);
  if (previous !== incoming) {
    setPrevious(incoming);
    setValue(incoming);
  }
  return [value, setValue] as const;
}

const tags = {
  section: "section",
  article: "article",
  aside: "aside",
  header: "header",
  footer: "footer",
  nav: "nav",
  list: "ul",
  listItem: "li",
  terms: "dl",
  term: "dt",
  detail: "dd",
  form: "form",
  group: "div",
  figure: "figure",
  status: "div",
  alert: "div",
} as const;
const roles = { group: "group", status: "status", alert: "alert" } as const;
type Semantics = keyof typeof tags;

// `semantics` picks the element; without one a layout primitive stays a plain div.
function layout(
  props: { semantics?: Semantics | undefined; label?: string | undefined },
  className: string,
  style: CSSProperties,
  children: ReactNode,
) {
  const { semantics, label } = props;
  return createElement(
    semantics ? tags[semantics] : "div",
    {
      className,
      style,
      ...(semantics && semantics in roles ? { role: roles[semantics as keyof typeof roles] } : {}),
      ...(label ? { "aria-label": label } : {}),
      ...(semantics === "form" ? { onSubmit: (event: FormEvent) => event.preventDefault() } : {}),
    },
    children,
  );
}

// A small generic glyph set. Replace it with your icon registry: the catalog only says an icon has a name.
const glyphs: Record<string, string> = {
  check: "✓",
  close: "×",
  plus: "+",
  minus: "−",
  alert: "!",
  info: "i",
  search: "⌕",
  "chevron-down": "⌄",
  "chevron-right": "›",
  "arrow-right": "→",
  refresh: "↻",
};
const glyph = (name: string) => glyphs[name] ?? "◇";
const icon = (name: string | undefined, className: string) =>
  name ? (
    <span aria-hidden="true" className={className} data-icon={name}>
      {glyph(name)}
    </span>
  ) : null;

/** One React implementation for every primitive of the starter catalog, built on React Aria Components. */
export const implementations: Implementation[] = [
  implement(Box, ({ props, slot, style, children }) =>
    layout(
      props,
      slot("root"),
      style,
      <>
        {/* Drawn only by the callout variant's CSS. */}
        <span aria-hidden="true" className={slot("rail")} />
        {children}
      </>,
    ),
  ),
  implement(Stack, ({ props, slot, style, children }) => layout(props, slot("root"), style, children)),
  implement(Inline, ({ props, slot, style, children }) => layout(props, slot("root"), style, children)),
  implement(Grid, ({ props, slot, style, children }) => layout(props, slot("root"), style, children)),
  implement(Scroll, ({ props, slot, style, children }) => (
    <div className={slot("root")} style={style}>
      <section
        aria-label={props.label}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to focus and scroll this named region.
        tabIndex={0}
        className={slot("viewport")}
        style={{
          overflowX: props.axis === "vertical" ? "hidden" : "auto",
          overflowY: props.axis === "horizontal" ? "hidden" : "auto",
        }}
      >
        {children}
      </section>
    </div>
  )),
  implement(Separator, ({ props, slot, style }) => (
    <Aria.Separator orientation={props.orientation ?? "horizontal"} className={slot("root")} style={style} />
  )),
  implement(Text, ({ props, slot, style, domId }) => (
    <span id={domId} className={slot("root")} style={style}>
      {props.text}
    </span>
  )),
  implement(Hint, ({ props, slot, style, domId }) => (
    <p id={domId} className={slot("root")} style={style}>
      {props.text}
    </p>
  )),
  implement(Heading, ({ props, slot, style, domId }) =>
    createElement(`h${props.level}`, { id: domId, className: slot("root"), style }, props.text),
  ),
  implement(Icon, ({ props, slot, style }) => (
    <span
      role="img"
      aria-label={props.label}
      aria-hidden={!props.label || undefined}
      className={slot("root")}
      style={style}
      data-icon={props.name}
    >
      {glyph(props.name)}
    </span>
  )),
  implement(Image, ({ props, slot, style }) => (
    <img src={props.src} alt={props.alt} className={slot("root")} style={style} />
  )),
  implement(Link, ({ props, slot, style }) => (
    <Aria.Link href={props.href} className={`${slot("root")} starter-link`} style={style}>
      <span className={slot("label")}>{props.label}</span>
    </Aria.Link>
  )),
  implement(Button, ({ props, slot, style, emit }) => (
    <Aria.Button
      isDisabled={props.disabled ?? false}
      {...(props.current ? { "aria-current": "true" as const } : {})}
      {...(props.pressed === undefined ? {} : { "aria-pressed": props.pressed })}
      // A class that does not move with the variant or tone: the primitive CSS reads the `sheen` extension here.
      className={`${slot("root")} starter-button`}
      style={style}
      onPress={() => emit("onPress")}
    >
      {icon(props.icon, slot("icon"))}
      <span className={slot("label")}>{props.label}</span>
    </Aria.Button>
  )),
  implement(TextField, function TextFieldImplementation({ props, slot, style, emit, domId }) {
    const [value, setValue] = useValue(props.value ?? "");
    const input = {
      id: domId,
      className: slot("input"),
      ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
      onBlur: () => emit("onChange", value),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (
          event.key === "Enter" &&
          !event.nativeEvent.isComposing &&
          (!props.multiline || event.ctrlKey || event.metaKey)
        ) {
          emit("onChange", value);
          emit("onCommit", value);
        }
      },
    };
    return (
      <Aria.TextField
        className={slot("root")}
        style={style}
        value={value}
        // Bounds count code points, as the validator does, not UTF-16 units.
        onChange={(next) => {
          if (props.maxLength === undefined || Array.from(next).length <= props.maxLength) setValue(next);
        }}
        isDisabled={props.disabled ?? false}
        isReadOnly={props.readOnly ?? false}
        {...(props.describedBy === undefined ? {} : { "aria-describedby": props.describedBy })}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        {props.multiline ? <Aria.TextArea {...input} /> : <Aria.Input {...input} />}
      </Aria.TextField>
    );
  }),
  implement(Select, function SelectImplementation({ props, slot, style, emit, portal }) {
    const [value, setValue] = useValue<string | null>(props.value ?? null);
    return (
      <Aria.Select
        aria-label={props.label}
        className={slot("root")}
        style={style}
        selectedKey={value}
        isDisabled={props.disabled ?? false}
        onSelectionChange={(key) => {
          const next = key === null ? null : String(key);
          setValue(next);
          if (next !== null) emit("onChange", next);
        }}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        <Aria.Button className={slot("trigger")}>
          <Aria.SelectValue />
        </Aria.Button>
        <Aria.Popover {...(portal ? { UNSTABLE_portalContainer: portal } : {})}>
          <Aria.ListBox className={slot("list")} items={props.options}>
            {(option) => (
              <Aria.ListBoxItem
                id={option.value}
                textValue={option.label}
                isDisabled={option.disabled ?? false}
                className={slot("option")}
              >
                {option.label}
              </Aria.ListBoxItem>
            )}
          </Aria.ListBox>
        </Aria.Popover>
      </Aria.Select>
    );
  }),
  implement(Checkbox, function CheckboxImplementation({ props, slot, style, emit }) {
    const [value, setValue] = useValue(props.checked ?? false);
    return (
      <Aria.Checkbox
        className={slot("root")}
        style={style}
        isSelected={value}
        isDisabled={props.disabled ?? false}
        onChange={(checked) => {
          setValue(checked);
          emit("onChange", checked);
        }}
      >
        {({ isSelected }) => (
          <>
            <span aria-hidden="true" className={slot("indicator")}>
              {isSelected ? glyph("check") : ""}
            </span>
            <span className={slot("label")}>{props.label}</span>
          </>
        )}
      </Aria.Checkbox>
    );
  }),
  implement(Switch, function SwitchImplementation({ props, slot, style, emit }) {
    const [value, setValue] = useValue(props.checked ?? false);
    return (
      <Aria.Switch
        className={slot("root")}
        style={style}
        isSelected={value}
        isDisabled={props.disabled ?? false}
        onChange={(checked) => {
          setValue(checked);
          emit("onChange", checked);
        }}
      >
        <span aria-hidden="true" className={slot("track")}>
          <span className={slot("thumb")} />
        </span>
        <span className={slot("label")}>{props.label}</span>
      </Aria.Switch>
    );
  }),
  implement(Menu, ({ props, slot, style, items, portal }) => (
    <div className={slot("root")} style={style}>
      <Aria.MenuTrigger>
        <Aria.Button className={slot("trigger")} isDisabled={props.disabled ?? false}>
          {props.label}
        </Aria.Button>
        <Aria.Popover
          {...(portal ? { UNSTABLE_portalContainer: portal } : {})}
          className={slot("content")}
          data-open=""
        >
          <Aria.Menu aria-label={props.label} items={items}>
            {(node) => (
              <Aria.MenuItem
                id={node.id}
                textValue={String(node.props.label)}
                isDisabled={node.props.disabled === true}
                className={node.slot("root")}
                style={node.style}
                onAction={() => node.emit("onPress")}
              >
                {icon(typeof node.props.icon === "string" ? node.props.icon : undefined, node.slot("icon"))}
                <span className={node.slot("label")}>{String(node.props.label)}</span>
              </Aria.MenuItem>
            )}
          </Aria.Menu>
        </Aria.Popover>
      </Aria.MenuTrigger>
    </div>
  )),
  // Drawn by its `menu`, which reads the item's props, slots and events; this binding satisfies the registry.
  implement(MenuItem, ({ props, slot, style, emit }) => (
    <Aria.MenuItem
      textValue={props.label}
      className={slot("root")}
      style={style}
      isDisabled={props.disabled ?? false}
      onAction={() => emit("onPress")}
    >
      {icon(props.icon, slot("icon"))}
      <span className={slot("label")}>{props.label}</span>
    </Aria.MenuItem>
  )),
  implement(Popover, ({ props, slot, style, children, portal }) => (
    <div className={slot("root")} style={style}>
      <Aria.DialogTrigger>
        <Aria.Button className={slot("trigger")}>{props.label}</Aria.Button>
        <Aria.Popover {...(portal ? { UNSTABLE_portalContainer: portal } : {})} className={slot("content")}>
          <Aria.Dialog aria-label={props.label}>{children}</Aria.Dialog>
        </Aria.Popover>
      </Aria.DialogTrigger>
    </div>
  )),
  implement(Dialog, function DialogImplementation({ props, slot, style, children, emit, portal }) {
    const [open, setOpen] = useValue(props.open ?? false);
    return (
      <div className={slot("root")} style={style}>
        {/* A modal that mounts before the scoped portal exists is hidden by the later mount and never dismissed,
            so an already-open dialog waits for the portal. */}
        <Aria.ModalOverlay
          {...(portal ? { UNSTABLE_portalContainer: portal } : {})}
          isOpen={open && portal !== undefined}
          isDismissable
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) emit("onClose");
          }}
          className={slot("backdrop")}
        >
          <Aria.Modal>
            <Aria.Dialog className={slot("content")} aria-label={props.label}>
              <Aria.Heading slot="title" className={slot("title")}>
                {props.label}
              </Aria.Heading>
              {children}
              <Aria.Button slot="close" className={slot("close")}>
                Close
              </Aria.Button>
            </Aria.Dialog>
          </Aria.Modal>
        </Aria.ModalOverlay>
      </div>
    );
  }),
  implement(Tooltip, ({ props, slot, style, children, portal }) => (
    <span className={slot("root")} style={style}>
      <Aria.TooltipTrigger>
        <Aria.Focusable>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Non-interactive tooltip content needs a keyboard focus target. */}
          <span tabIndex={0} className={slot("trigger")}>
            {children}
          </span>
        </Aria.Focusable>
        <Aria.Tooltip {...(portal ? { UNSTABLE_portalContainer: portal } : {})} className={slot("content")}>
          {props.text}
        </Aria.Tooltip>
      </Aria.TooltipTrigger>
    </span>
  )),
  implement(Tabs, function TabsImplementation({ props, slot, style, items, emit }) {
    const [value, setValue] = useValue(props.value ?? String(items[0]?.props.value));
    return (
      <Aria.Tabs
        className={slot("root")}
        style={style}
        selectedKey={value}
        onSelectionChange={(key) => {
          setValue(String(key));
          emit("onChange", String(key));
        }}
      >
        <Aria.TabList aria-label={props.label} className={slot("list")} items={items}>
          {(node) => (
            <Aria.Tab
              id={String(node.props.value)}
              isDisabled={node.props.disabled === true}
              className={node.slot("root")}
              style={node.style}
            >
              <span className={node.slot("label")}>{String(node.props.label)}</span>
              {typeof node.props.count === "string" ? (
                <span className={node.slot("count")}>{node.props.count}</span>
              ) : null}
            </Aria.Tab>
          )}
        </Aria.TabList>
        {items.map((node) => (
          <Aria.TabPanel
            key={node.id}
            id={String(node.props.value)}
            className={`${slot("panel")} ${node.slot("panel")}`}
          >
            {node.children}
          </Aria.TabPanel>
        ))}
      </Aria.Tabs>
    );
  }),
  implement(Disclosure, ({ props, slot, style, children, emit }) => (
    // The browser owns the open attribute; a supplied `open` only changes it when the host value changes.
    <details
      {...(props.open === undefined ? {} : { open: props.open })}
      className={slot("root")}
      style={style}
      onToggle={(event) => emit("onToggle", event.currentTarget.open)}
    >
      <summary className={slot("summary")}>{props.label}</summary>
      <div className={slot("panel")}>{children}</div>
    </details>
  )),
  // Drawn by its `tabs`, like `menuItem`.
  implement(Tab, ({ props, slot, style }) => (
    <Aria.Tab id={props.value} isDisabled={props.disabled ?? false} className={slot("root")} style={style}>
      <span className={slot("label")}>{props.label}</span>
      {props.count === undefined ? null : <span className={slot("count")}>{props.count}</span>}
    </Aria.Tab>
  )),
];
