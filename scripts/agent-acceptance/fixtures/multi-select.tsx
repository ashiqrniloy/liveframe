import { arr, type Definition, obj, str } from "@arnilo/liveframe";
import { implement } from "@arnilo/liveframe/react";

const id = str({ maxLength: 32 });

export const multiSelect = {
  kind: "multiSelect",
  description: "Select multiple options. The change event carries the selected option values.",
  props: obj({
    label: str({ maxLength: 80 }),
    options: arr(obj({ value: id, label: str({ maxLength: 80 }) }), { maxItems: 8 }),
  }),
  children: "none",
  events: { onChange: { carries: { array: { items: id, maxItems: 8 } }, description: "Selected option values." } },
  slots: ["root"],
  a11y: { role: "listbox", name: "label" },
  variants: ["default"],
  defaultVariant: "default",
  styleProps: [],
} as const satisfies Definition;

export const multiSelectImplementation = implement(multiSelect, ({ domId, props, emit }) => (
  <label htmlFor={domId}>
    {props.label}
    <select
      id={domId}
      multiple
      onChange={(event) =>
        emit(
          "onChange",
          Array.from(event.currentTarget.selectedOptions, ({ value }) => value),
        )
      }
    >
      {props.options.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  </label>
));
