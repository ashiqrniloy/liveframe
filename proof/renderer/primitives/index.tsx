import { createElement, useState } from "react";
import * as Aria from "react-aria-components";
import { definitions } from "../../catalog/definitions.ts";
import { slotClasses, styleProps } from "../../css/project.ts";
import type { PrimitiveDefinition, PrimitiveProps, UiNode } from "../../runtime/types.ts";
import { type ImplementationProps, implement } from "../implement.ts";

type Def<K> = Extract<PrimitiveDefinition, { kind: K }>;
function bind<K extends PrimitiveDefinition["kind"]>(
  kind: K,
  Component: (context: ImplementationProps<PrimitiveProps<Def<K>>>) => React.ReactNode,
) {
  const definition = definitions.find((entry) => entry.kind === kind) as Def<K>;
  return implement(definition, Component);
}
const childSlot = (node: UiNode, slot: string) => slotClasses(node.kind, node.variant ?? "default", slot);
function useValue<T>(incoming: T) {
  const [value, setValue] = useState(incoming);
  const [previous, setPrevious] = useState(incoming);
  if (previous !== incoming) {
    setPrevious(incoming);
    setValue(incoming);
  }
  return [value, setValue] as const;
}
const icon = (name: string | undefined, className: string) =>
  name ? (
    <span aria-hidden="true" className={className} data-icon={name}>
      {icons[name] ?? "◇"}
    </span>
  ) : null;
// shortcut: the proof has a small glyph map; replace with the host's icon registry when integrating a real app.
const icons: Record<string, string> = {
  branch: "⑂",
  refresh: "↻",
  check: "✓",
  close: "×",
  alert: "!",
  chevron: "⌄",
  folder: "▱",
  git: "⑂",
  "git-branch": "⑂",
  "refresh-cw": "↻",
  "circle-dot": "●",
};

export const implementations = [
  bind("box", ({ slot, layout, children }) => (
    <div className={slot("root")} style={layout}>
      {children}
    </div>
  )),
  bind("stack", ({ slot, layout, children }) => (
    <div className={slot("root")} style={layout}>
      {children}
    </div>
  )),
  bind("inline", ({ slot, layout, children }) => (
    <div className={slot("root")} style={layout}>
      {children}
    </div>
  )),
  bind("grid", ({ slot, layout, children }) => (
    <div className={slot("root")} style={layout}>
      {children}
    </div>
  )),
  bind("scroll", ({ props, slot, layout, children }) => (
    <div className={slot("root")} style={layout}>
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
  bind("separator", ({ props, slot, layout }) => (
    <Aria.Separator orientation={props.orientation ?? "horizontal"} className={slot("root")} style={layout} />
  )),
  bind("text", ({ props, slot, layout }) => (
    <span className={slot("root")} style={layout}>
      {props.text}
    </span>
  )),
  bind("heading", ({ props, slot, layout }) =>
    createElement(`h${props.level}`, { className: slot("root"), style: layout }, props.text),
  ),
  bind("icon", ({ props, slot, layout }) => (
    <span
      role="img"
      aria-label={props.label}
      aria-hidden={!props.label || undefined}
      className={slot("root")}
      style={layout}
      data-icon={props.name}
    >
      {icons[props.name] ?? "◇"}
    </span>
  )),
  bind("image", ({ props, slot, layout }) => (
    <img src={props.src} alt={props.alt} className={slot("root")} style={layout} />
  )),
  bind("link", ({ props, slot, layout }) => (
    <Aria.Link href={props.href} className={slot("root")} style={layout}>
      <span className={slot("label")}>{props.label}</span>
    </Aria.Link>
  )),
  bind("button", ({ props, slot, layout, emit }) => (
    <Aria.Button
      isDisabled={props.disabled ?? false}
      className={slot("root")}
      style={layout}
      onPress={() => emit("onPress")}
    >
      {icon(props.icon, slot("icon"))}
      <span className={slot("label")}>{props.label}</span>
    </Aria.Button>
  )),
  bind("textField", function TextField({ props, slot, layout, emit }) {
    const [value, setValue] = useValue(props.value ?? "");
    const input = {
      className: slot("input"),
      ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
      ...(props.maxLength === undefined ? {} : { maxLength: props.maxLength }),
      onBlur: () => emit("onChange", value),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (
          event.key === "Enter" &&
          !event.nativeEvent.isComposing &&
          (!props.multiline || event.ctrlKey || event.metaKey)
        ) {
          emit("onChange", value);
          emit("onSubmit", value);
        }
      },
    };
    return (
      <Aria.TextField
        className={slot("root")}
        style={layout}
        value={value}
        onChange={setValue}
        isDisabled={props.disabled ?? false}
        isReadOnly={props.readOnly ?? false}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        {props.multiline ? <Aria.TextArea {...input} /> : <Aria.Input {...input} />}
      </Aria.TextField>
    );
  }),
  bind("select", function Select({ props, slot, layout, emit }) {
    const [value, setValue] = useValue<string | null>(props.value ?? null);
    return (
      <Aria.Select
        aria-label={props.label}
        className={slot("root")}
        style={layout}
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
        <Aria.Popover>
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
  bind("checkbox", function Checkbox({ props, slot, layout, emit }) {
    const [value, setValue] = useValue(props.checked ?? false);
    return (
      <Aria.Checkbox
        className={slot("root")}
        style={layout}
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
              {isSelected ? "✓" : ""}
            </span>
            <span className={slot("label")}>{props.label}</span>
          </>
        )}
      </Aria.Checkbox>
    );
  }),
  bind("switch", function Switch({ props, slot, layout, emit }) {
    const [value, setValue] = useValue(props.checked ?? false);
    return (
      <Aria.Switch
        className={slot("root")}
        style={layout}
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
  bind("menu", ({ props, slot, layout, nodes, emitNode }) => (
    <div className={slot("root")} style={layout}>
      <Aria.MenuTrigger>
        <Aria.Button className={slot("trigger")} isDisabled={props.disabled ?? false}>
          {props.label}
        </Aria.Button>
        <Aria.Popover className={slot("content")}>
          <Aria.Menu aria-label={props.label} items={nodes}>
            {(node) => (
              <Aria.MenuItem
                id={node.id}
                textValue={String(node.props.label)}
                isDisabled={node.props.disabled === true}
                className={childSlot(node, "root")}
                style={styleProps(node.style ?? {})}
                onAction={() => emitNode(node, "onPress")}
              >
                {icon(typeof node.props.icon === "string" ? node.props.icon : undefined, childSlot(node, "icon"))}
                <span className={childSlot(node, "label")}>{String(node.props.label)}</span>
              </Aria.MenuItem>
            )}
          </Aria.Menu>
        </Aria.Popover>
      </Aria.MenuTrigger>
    </div>
  )),
  bind("menuItem", ({ props, slot, layout, emit, node }) => (
    <Aria.MenuItem
      id={node.id}
      textValue={props.label}
      className={slot("root")}
      style={layout}
      isDisabled={props.disabled ?? false}
      onAction={() => emit("onPress")}
    >
      {icon(props.icon, slot("icon"))}
      <span className={slot("label")}>{props.label}</span>
    </Aria.MenuItem>
  )),
  bind("popover", ({ props, slot, layout, children }) => (
    <div className={slot("root")} style={layout}>
      <Aria.DialogTrigger>
        <Aria.Button className={slot("trigger")}>{props.label}</Aria.Button>
        <Aria.Popover className={slot("content")}>
          <Aria.Dialog aria-label={props.label}>{children}</Aria.Dialog>
        </Aria.Popover>
      </Aria.DialogTrigger>
    </div>
  )),
  bind("dialog", function Dialog({ props, slot, layout, children, emit }) {
    const [open, setOpen] = useValue(props.open ?? false);
    return (
      <div className={slot("root")} style={layout}>
        <Aria.ModalOverlay
          isOpen={open}
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
  bind("tooltip", ({ props, slot, layout, children }) => (
    <span className={slot("root")} style={layout}>
      <Aria.TooltipTrigger>
        <Aria.Focusable>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Non-interactive tooltip content needs a keyboard focus target. */}
          <span tabIndex={0} className={slot("trigger")}>
            {children}
          </span>
        </Aria.Focusable>
        <Aria.Tooltip className={slot("content")}>{props.text}</Aria.Tooltip>
      </Aria.TooltipTrigger>
    </span>
  )),
  bind("tabs", function Tabs({ props, slot, layout, nodes, render, emit }) {
    const [value, setValue] = useValue(props.value ?? String(nodes[0]?.props.value));
    return (
      <Aria.Tabs
        className={slot("root")}
        style={layout}
        selectedKey={value}
        onSelectionChange={(key) => {
          setValue(String(key));
          emit("onChange", String(key));
        }}
      >
        <Aria.TabList aria-label={props.label} className={slot("list")} items={nodes}>
          {(node) => (
            <Aria.Tab
              id={String(node.props.value)}
              isDisabled={node.props.disabled === true}
              className={childSlot(node, "root")}
              style={styleProps(node.style ?? {})}
            >
              <span className={childSlot(node, "label")}>{String(node.props.label)}</span>
            </Aria.Tab>
          )}
        </Aria.TabList>
        {nodes.map((node) => (
          <Aria.TabPanel
            key={node.id}
            id={String(node.props.value)}
            className={`${slot("panel")} ${childSlot(node, "panel")}`}
          >
            {node.children?.map(render)}
          </Aria.TabPanel>
        ))}
      </Aria.Tabs>
    );
  }),
  bind("tab", ({ props, slot, layout }) => (
    <Aria.Tab id={props.value} isDisabled={props.disabled ?? false} className={slot("root")} style={layout}>
      <span className={slot("label")}>{props.label}</span>
    </Aria.Tab>
  )),
];
