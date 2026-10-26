import type { Definition } from "@arnilo/liveframe";
import { type ImplementationProps, implement } from "@arnilo/liveframe/react";
import { createElement, type ReactNode, useState } from "react";
import * as Aria from "react-aria-components";
import { catalog } from "../app.ts";

type Layout = { semantics?: string; label?: string };

function bind<P>(kind: string, Component: (context: ImplementationProps<Definition, P>) => ReactNode) {
  const definition = catalog.definitions.find((entry) => entry.kind === kind);
  if (!definition) throw new Error(`Missing primitive: ${kind}`);
  return implement<Definition, P>(definition, Component);
}

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

const tags: Record<string, string> = {
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
};

// Layout semantics pick the element; without one a layout primitive stays a plain div.
const layout = ({ props, slot, style, children }: ImplementationProps<Definition, Layout>) =>
  createElement(
    (props.semantics && tags[props.semantics]) || "div",
    { className: slot("root"), style, ...(props.label ? { "aria-label": props.label } : {}) },
    children,
  );

export const implementations = [
  bind<Layout>("box", layout),
  bind<Layout>("stack", layout),
  bind<Layout>("inline", layout),
  bind<{ text: string }>("text", ({ props, slot, style }) => (
    <span className={slot("root")} style={style}>
      {props.text}
    </span>
  )),
  bind<{ text: string; level: number }>("heading", ({ props, slot, style }) =>
    createElement(`h${props.level}`, { className: slot("root"), style }, props.text),
  ),
  bind<{ label: string; disabled?: boolean; current?: boolean; pressed?: boolean }>(
    "button",
    ({ props, slot, style, emit }) => (
      <Aria.Button
        isDisabled={props.disabled ?? false}
        {...(props.current ? { "aria-current": "true" as const } : {})}
        {...(props.pressed === undefined ? {} : { "aria-pressed": props.pressed })}
        className={slot("root")}
        style={style}
        onPress={() => emit("onPress")}
      >
        <span className={slot("label")}>{props.label}</span>
      </Aria.Button>
    ),
  ),
  bind<{
    label: string;
    value?: string;
    placeholder?: string;
    multiline?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    maxLength?: number;
  }>("textField", function TextField({ props, slot, style, emit }) {
    const [value, setValue] = useValue(props.value ?? "");
    const input = {
      className: slot("input"),
      ...(props.placeholder === undefined ? {} : { placeholder: props.placeholder }),
      onBlur: () => emit("onChange", value),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing && (!props.multiline || event.ctrlKey)) {
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
  bind<{ label: string; open?: boolean }>("dialog", function Dialog({ props, slot, style, children, emit, portal }) {
    const [open, setOpen] = useValue(props.open ?? false);
    return (
      <div className={slot("root")} style={style}>
        {/* A modal that mounts before the scoped portal exists is hidden by the later mount and never dismissed
            (plan 010 F1), so an already-open dialog waits for the portal. */}
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
];
