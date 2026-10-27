import type { Definition } from "@arnilo/liveframe";
import { type ImplementationProps, implement } from "@arnilo/liveframe/react";
import { createElement, useState } from "react";
import * as Aria from "react-aria-components";
import { catalog } from "../../css/fixtures.ts";
import type { PrimitiveDefinition, PrimitiveProps } from "../../runtime/types.ts";

type Def<K> = Extract<PrimitiveDefinition, { kind: K }>;
function bind<K extends PrimitiveDefinition["kind"]>(
  kind: K,
  Component: (context: ImplementationProps<Definition, PrimitiveProps<Def<K>>>) => React.ReactNode,
) {
  const definition = catalog.definitions.find((entry) => entry.kind === kind);
  if (!definition) throw new Error(`Missing primitive: ${kind}`);
  return implement<Definition, PrimitiveProps<Def<K>>>(definition, Component);
}
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
// Layout semantics pick the element; without one a layout primitive stays a plain div.
function element(
  semantics: Semantics | undefined,
  label: string | undefined,
  className: string,
  style: React.CSSProperties,
  children: React.ReactNode,
) {
  return createElement(
    semantics ? tags[semantics] : "div",
    {
      className,
      style,
      ...(semantics && semantics in roles ? { role: roles[semantics as keyof typeof roles] } : {}),
      ...(label ? { "aria-label": label } : {}),
      ...(semantics === "form" ? { onSubmit: (event: React.FormEvent) => event.preventDefault() } : {}),
    },
    children,
  );
}
// Artifact glyphs are app-owned copies of the approved SVG symbols (agent-home-certified.html, synapta-core fc6df4b3).
const glyphs: Record<string, React.ReactNode> = {
  "mk-solid": <circle cx="12" cy="12" r="6" fill="currentColor" />,
  "mk-dashed": (
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3.2 2.6" />
  ),
  "mk-half": (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
    </>
  ),
  "mk-struck": (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 17.5 17.5 6.5" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  "seal-brand": (
    <>
      <path
        d="M20.8 12l1.35 .7 .5 .4 .4 .45 .15 .4-.05 .4-.25 .35-.45 .3-.65 .2-1.45 .15-2.7-.1-.35 .1-.15 .1-.05 .25 .15 .4 .8 1.75 .55 1.5 .15 .65 0 .65-.1 .45-.3 .35-.35 .15-.45-.05-.55-.2-.6-.35-1.15-1-1.4-1.5-.3-.3-.25-.1-.2 .05-.2 .25-.9 2.4-.7 1.35-.4 .5-.45 .4-.4 .15-.4-.05-.35-.25-.3-.45-.2-.65-.15-1.45 .1-2.7-.1-.35-.1-.15-.25-.05-.4 .15-1.75 .8-1.5 .55-.65 .15-.65 0-.45-.1-.35-.3-.15-.35 .05-.45 .2-.55 .8-1.2 2.05-1.95 .3-.3 .1-.25-.05-.2-.25-.2-2.4-.9-1.35-.7-.5-.4-.4-.45-.15-.4 .05-.4 .25-.35 .45-.3 .65-.2 1.45-.15 2.7 .1 .35-.1 .15-.1 .05-.25-.15-.4-.8-1.75-.55-1.5-.15-.65 0-.65 .1-.45 .3-.35 .35-.15 .45 .05 .55 .2 .6 .35 1.15 1 1.4 1.5 .3 .3 .25 .1 .2-.05 .2-.25 .9-2.4 .7-1.35 .4-.5 .45-.4 .4-.15 .4 .05 .35 .25 .3 .45 .2 .65 .15 1.45-.1 2.7 .1 .35 .1 .15 .25 .05 .4-.15 1.75-.8 1.5-.55 .65-.15 .65 0 .45 .1 .35 .3 .15 .35-.05 .45-.2 .55-.35 .6-1 1.15-1.5 1.4-.3 .3-.1 .25 .05 .2 .25 .2 2.4 .9zM23.4 12l-.1 .4-.3 .35-.5 .35-.65 .3-1.5 .35-2 .3-.4 .1-.2 .15-.05 .25 .15 .3 1.5 2.1 .75 1.35 .15 .65 .05 .55-.1 .4-.3 .3-.4 .1-.55-.05-.65-.15-1.35-.75-2.1-1.5-.3-.15-.25 .05-.15 .2-.1 .4-.3 2-.35 1.5-.3 .65-.35 .5-.35 .3-.4 .1-.4-.1-.35-.3-.35-.5-.3-.65-.35-1.5-.3-2-.1-.4-.15-.2-.25-.05-.3 .15-1.5 1.1-1.3 .8-.65 .35-.65 .15-.55 .05-.4-.1-.3-.3-.1-.4 .05-.55 .15-.65 .75-1.35 1.5-2.1 .15-.3-.05-.25-.2-.15-.4-.1-2-.3-1.5-.35-.65-.3-.5-.35-.3-.35-.1-.4 .1-.4 .3-.35 .5-.35 .65-.3 1.5-.35 2-.3 .4-.1 .2-.15 .05-.25-.15-.3-1.5-2.1-.75-1.35-.15-.65-.05-.55 .1-.4 .3-.3 .4-.1 .55 .05 .65 .15 1.35 .75 2.1 1.5 .3 .15 .25-.05 .15-.2 .1-.4 .3-2 .35-1.5 .3-.65 .35-.5 .35-.3 .4-.1 .4 .1 .35 .3 .35 .5 .3 .65 .35 1.5 .3 2 .1 .4 .15 .2 .25 .05 .3-.15 2.1-1.5 1.35-.75 .65-.15 .55-.05 .4 .1 .3 .3 .1 .4-.05 .55-.15 .65-.75 1.35-1.5 2.1-.15 .3 .05 .25 .2 .15 .4 .1 2 .3 1.5 .35 .65 .3 .5 .35 .3 .35 .1 .4zM20.8 12l-2.4 .9-.25 .2-.05 .2 .1 .25 .3 .3 1.5 1.4 1 1.15 .35 .6 .2 .55 .05 .45-.15 .35-.35 .3-.45 .1-.65 0-.65-.15-1.5-.55-1.75-.8-.4-.15-.25 .05-.1 .15-.1 .35 .1 2.7-.15 1.45-.2 .65-.3 .45-.35 .25-.4 .05-.4-.15-.45-.4-.75-1.15-1.25-3.1-.2-.25-.2-.05-.25 .1-.3 .3-1.4 1.5-1.15 1-.6 .35-.55 .2-.45 .05-.35-.15-.3-.35-.1-.45 0-.65 .15-.65 .55-1.5 .8-1.75 .15-.4-.05-.25-.15-.1-.35-.1-2.7 .1-1.45-.15-.65-.2-.45-.3-.25-.35-.05-.4 .15-.4 .4-.45 .5-.4 1.35-.7 2.4-.9 .25-.2 .05-.2-.1-.25-.3-.3-1.5-1.4-1-1.15-.35-.6-.2-.55-.05-.45 .15-.35 .35-.3 .45-.1 .65 0 .65 .15 1.5 .55 1.75 .8 .4 .15 .25-.05 .1-.15 .1-.35-.1-2.7 .15-1.45 .2-.65 .3-.45 .35-.25 .4-.05 .4 .15 .45 .4 .4 .5 .7 1.35 .9 2.4 .2 .25 .2 .05 .25-.1 .3-.3 1.4-1.5 1.15-1 .6-.35 .55-.2 .45-.05 .35 .15 .3 .35 .1 .45 0 .65-.4 1.4-1.1 2.5-.15 .4 .05 .25 .15 .1 .35 .1 2.7-.1 1.45 .15 .65 .2 .45 .3 .25 .35 .05 .4-.15 .4-.4 .45-.5 .4-1.35 .7zM18.2 12l.1 .2 .3 .25 2.25 1.45 1.15 .95 .35 .5 .2 .5 0 .4-.2 .35-.4 .25-.55 .15-.65 .05-1.55-.2-2-.45-.7-.1-.2 .2 0 .25 .55 2.45 .2 1.55-.05 .65-.15 .55-.25 .4-.35 .2-.4 0-.5-.2-.5-.35-.95-1.15-1.45-2.25-.25-.3-.2-.1-.2 .1-.25 .3-1.45 2.25-.95 1.15-.5 .35-.5 .2-.4 0-.35-.2-.25-.4-.15-.55-.05-.65 .2-1.55 .55-2.45 0-.25-.2-.2-.7 .1-2 .45-1.55 .2-.65-.05-.55-.15-.4-.25-.2-.35 0-.4 .2-.5 .35-.5 1.15-.95 2.25-1.45 .3-.25 .1-.2-.1-.2-.3-.25-2.25-1.45-1.15-.95-.35-.5-.2-.5 0-.4 .2-.35 .4-.25 .55-.15 .65-.05 1.55 .2 2 .45 .7 .1 .2-.2 0-.25-.55-2.45-.2-1.55 .05-.65 .15-.55 .25-.4 .35-.2 .4 0 .5 .2 .5 .35 .95 1.15 1.45 2.25 .25 .3 .2 .1 .2-.1 .25-.3 1.45-2.25 .95-1.15 .5-.35 .5-.2 .4 0 .35 .2 .25 .4 .15 .55 .05 .65-.2 1.55-.55 2.45 0 .25 .2 .2 .7-.1 2-.45 1.55-.2 .65 .05 .55 .15 .4 .25 .2 .35 0 .4-.2 .5-.35 .5-1.15 .95-2.25 1.45-.3 .25-.1 .2z"
        fill="none"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </>
  ),
};
const Glyph = ({ name }: { name: string }) =>
  name in glyphs ? (
    <svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {glyphs[name]}
    </svg>
  ) : (
    <>{icons[name] ?? "◇"}</>
  );
const icon = (name: string | undefined, className: string) =>
  name ? (
    <span aria-hidden="true" className={className} data-icon={name}>
      <Glyph name={name} />
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
  "git.branch": "⑂",
  "status.success": "✓",
  "status.warning": "⚠",
  "status.error": "×",
  info: "ⓘ",
};

export const implementations = [
  bind("box", ({ props, slot, style, children }) =>
    element(
      props.semantics,
      props.label,
      slot("root"),
      style,
      <>
        {slot("root").includes("lf_box_callout_root") ? (
          <span key="rail" aria-hidden="true" className={slot("rail")} />
        ) : null}
        {children}
      </>,
    ),
  ),
  bind("stack", ({ props, slot, style, children }) =>
    element(props.semantics, props.label, slot("root"), style, children),
  ),
  bind("inline", ({ props, slot, style, children }) =>
    element(props.semantics, props.label, slot("root"), style, children),
  ),
  bind("grid", ({ props, slot, style, children }) =>
    element(props.semantics, props.label, slot("root"), style, children),
  ),
  bind("scroll", ({ props, slot, style, children }) => (
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
  bind("separator", ({ props, slot, style }) => (
    <Aria.Separator orientation={props.orientation ?? "horizontal"} className={slot("root")} style={style} />
  )),
  bind("text", ({ props, slot, style }) => (
    <span className={slot("root")} style={style}>
      {props.text}
    </span>
  )),
  bind("heading", ({ props, slot, style }) =>
    createElement(`h${props.level}`, { className: slot("root"), style }, props.text),
  ),
  bind("icon", ({ props, slot, style }) => (
    <span
      role="img"
      aria-label={props.label}
      aria-hidden={!props.label || undefined}
      className={slot("root")}
      style={style}
      data-icon={props.name}
    >
      <Glyph name={props.name} />
    </span>
  )),
  bind("image", ({ props, slot, style }) => (
    <img src={props.src} alt={props.alt} className={slot("root")} style={style} />
  )),
  bind("link", ({ props, slot, style }) => (
    <Aria.Link href={props.href} className={slot("root")} style={style}>
      <span className={slot("label")}>{props.label}</span>
    </Aria.Link>
  )),
  bind("button", ({ props, slot, style, emit }) => (
    <Aria.Button
      isDisabled={props.disabled ?? false}
      {...(props.current ? { "aria-current": "true" as const } : {})}
      {...(props.pressed === undefined ? {} : { "aria-pressed": props.pressed })}
      className={slot("root")}
      style={style}
      onPress={() => emit("onPress")}
    >
      {icon(props.icon, slot("icon"))}
      <span className={slot("label")}>{props.label}</span>
    </Aria.Button>
  )),
  bind("textField", function TextField({ props, slot, style, emit }) {
    const [value, setValue] = useValue(props.value ?? "");
    const input = {
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
        onChange={(next) => {
          if (props.maxLength === undefined || Array.from(next).length <= props.maxLength) setValue(next);
        }}
        isDisabled={props.disabled ?? false}
        isReadOnly={props.readOnly ?? false}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        {props.multiline ? <Aria.TextArea {...input} /> : <Aria.Input {...input} />}
      </Aria.TextField>
    );
  }),
  bind("select", function Select({ props, slot, style, emit, portal }) {
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
  bind("checkbox", function Checkbox({ props, slot, style, emit }) {
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
              {isSelected ? "✓" : ""}
            </span>
            <span className={slot("label")}>{props.label}</span>
          </>
        )}
      </Aria.Checkbox>
    );
  }),
  bind("switch", function Switch({ props, slot, style, emit }) {
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
  bind("menu", ({ props, slot, style, items, portal }) => (
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
  bind("menuItem", ({ props, slot, style, emit }) => (
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
  bind("popover", ({ props, slot, style, children, portal }) => (
    <div className={slot("root")} style={style}>
      <Aria.DialogTrigger>
        <Aria.Button className={slot("trigger")}>{props.label}</Aria.Button>
        <Aria.Popover {...(portal ? { UNSTABLE_portalContainer: portal } : {})} className={slot("content")}>
          <Aria.Dialog aria-label={props.label}>{children}</Aria.Dialog>
        </Aria.Popover>
      </Aria.DialogTrigger>
    </div>
  )),
  bind("dialog", function Dialog({ props, slot, style, children, emit, portal }) {
    const [open, setOpen] = useValue(props.open ?? false);
    return (
      <div className={slot("root")} style={style}>
        <Aria.ModalOverlay
          {...(portal ? { UNSTABLE_portalContainer: portal } : {})}
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
  bind("tooltip", ({ props, slot, style, children, portal }) => (
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
  bind("tabs", function Tabs({ props, slot, style, items, emit }) {
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
  bind("disclosure", ({ props, slot, style, children, emit }) => (
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
  bind("tab", ({ props, slot, style }) => (
    <Aria.Tab id={props.value} isDisabled={props.disabled ?? false} className={slot("root")} style={style}>
      <span className={slot("label")}>{props.label}</span>
    </Aria.Tab>
  )),
];
