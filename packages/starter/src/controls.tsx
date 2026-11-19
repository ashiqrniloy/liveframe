import { type Implementation, implement } from "@arnilo/liveframe/react";
import { parseDate } from "@internationalized/date";
import { useContext, useEffect, useRef } from "react";
import * as Aria from "react-aria-components";
import { DateField, Progress, Radio, RadioGroup, Slider } from "./ui.definitions.gen.ts";
import { useValue } from "./use-value.ts";

/**
 * The bounds a slider or progress bar draws with. A `maximum` at or below `minimum` cannot be checked by a schema, so it
 * collapses onto `minimum`, and the value is clamped into the range.
 */
export function range(minimum = 0, maximum = 100, value?: number | null) {
  const high = Math.max(minimum, maximum);
  const clamped = value == null ? undefined : Math.min(high, Math.max(minimum, value));
  return { minimum, maximum: high, value: clamped, empty: high === minimum };
}

/** The fill is the one geometry these controls compute: a position, never a colour (law 3). */
const fillEnd = (minimum: number, maximum: number, value: number) =>
  `${maximum > minimum ? 100 - ((value - minimum) / (maximum - minimum)) * 100 : 100}%`;

/** A calendar date for an ISO `YYYY-MM-DD` string, or null when it names no real day (such as `2026-02-30`). */
export function calendarDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

/** The four form controls of the starter catalog beyond the 0.3 set, built on React Aria Components. */
export const controls: Implementation[] = [
  implement(RadioGroup, function RadioGroupImplementation({ props, slot, style, emit, children }) {
    const [value, setValue] = useValue<string | null>(props.value ?? null);
    return (
      <Aria.RadioGroup
        className={slot("root")}
        style={style}
        value={value}
        orientation={props.orientation ?? "vertical"}
        isDisabled={props.disabled ?? false}
        {...(props.describedBy === undefined ? {} : { "aria-describedby": props.describedBy })}
        onChange={(next) => {
          setValue(next);
          emit("onChange", next);
        }}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        {children}
      </Aria.RadioGroup>
    );
  }),
  implement(Radio, function RadioImplementation({ props, slot, style }) {
    // `Radio`, not `RadioButton`: the `^1.22.0` peer floor is the API this binds to.
    // The catalog has no parent rules, so a radio can be placed outside a group: the node's error boundary contains it.
    if (!useContext(Aria.RadioGroupStateContext)) throw new Error("A radio is drawn only inside a radioGroup.");
    return (
      <Aria.Radio value={props.value} isDisabled={props.disabled ?? false} className={slot("root")} style={style}>
        <span aria-hidden="true" className={slot("indicator")} />
        <span className={slot("label")}>{props.label}</span>
      </Aria.Radio>
    );
  }),
  implement(Slider, function SliderImplementation({ props, slot, style, emit }) {
    const bounds = range(props.minimum, props.maximum, props.value);
    const [value, setValue] = useValue(bounds.value ?? bounds.minimum);
    const input = useRef<HTMLInputElement>(null);
    // React Aria derives `aria-valuetext` from number formatting only; a supplied text replaces it after each commit.
    useEffect(() => {
      if (props.valueText !== undefined) input.current?.setAttribute("aria-valuetext", props.valueText);
    });
    return (
      <Aria.Slider
        className={slot("root")}
        style={style}
        value={value}
        minValue={bounds.minimum}
        // A collapsed range still needs a span to draw; it is disabled, so the value never leaves `minimum`.
        maxValue={bounds.empty ? bounds.minimum + 1 : bounds.maximum}
        step={props.step ?? 1}
        isDisabled={(props.disabled ?? false) || bounds.empty}
        onChange={setValue}
        // Tier 1: the drag stays local, and the host hears the value it ends on.
        onChangeEnd={(next) => emit("onChange", next)}
      >
        {({ state }) => (
          <>
            <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
            <Aria.SliderOutput className={slot("output")}>
              {props.valueText ?? state.getThumbValueLabel(0)}
            </Aria.SliderOutput>
            <Aria.SliderTrack className={slot("track")}>
              <span
                className={slot("fill")}
                style={{ insetInlineEnd: fillEnd(bounds.minimum, bounds.maximum, value) }}
              />
              <Aria.SliderThumb
                inputRef={input}
                className={slot("thumb")}
                // The library's `active` state reads `data-pressed`; React Aria marks a dragged thumb `data-dragging`.
                {...(state.isThumbDragging(0) ? { "data-pressed": "" } : {})}
              />
            </Aria.SliderTrack>
          </>
        )}
      </Aria.Slider>
    );
  }),
  implement(Progress, ({ props, slot, style }) => {
    const bounds = range(props.minimum, props.maximum, props.value);
    return (
      <Aria.ProgressBar
        className={slot("root")}
        style={style}
        minValue={bounds.minimum}
        maxValue={bounds.maximum}
        isIndeterminate={bounds.value === undefined}
        {...(bounds.value === undefined ? { "data-mixed": "" } : { value: bounds.value })}
        {...(props.valueText === undefined ? {} : { valueLabel: props.valueText })}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        <span aria-hidden="true" className={slot("track")}>
          <span
            className={slot("fill")}
            style={
              bounds.value === undefined
                ? {}
                : { insetInlineEnd: fillEnd(bounds.minimum, bounds.maximum, bounds.value) }
            }
          />
        </span>
      </Aria.ProgressBar>
    );
  }),
  implement(DateField, function DateFieldImplementation({ props, slot, style, emit }) {
    const [value, setValue] = useValue(props.value ?? null);
    const minimum = calendarDate(props.minimum);
    const maximum = calendarDate(props.maximum);
    return (
      <Aria.DateField
        className={slot("root")}
        style={style}
        // A value that names no real day draws an empty field, never a guessed one.
        value={calendarDate(value)}
        granularity="day"
        {...(minimum ? { minValue: minimum } : {})}
        {...(maximum ? { maxValue: maximum } : {})}
        // Range errors show as the value arrives, not only after a form submits.
        validationBehavior="aria"
        isDisabled={props.disabled ?? false}
        isReadOnly={props.readOnly ?? false}
        {...(props.describedBy === undefined ? {} : { "aria-describedby": props.describedBy })}
        // React Aria raises a change only for a complete date, or null once every segment is cleared.
        onChange={(next) => {
          const text = next === null ? "" : next.toString();
          setValue(next === null ? null : text);
          emit("onChange", text);
        }}
      >
        <Aria.Label className={slot("label")}>{props.label}</Aria.Label>
        <Aria.DateInput className={slot("input")}>
          {(segment) => <Aria.DateSegment segment={segment} className={slot("segment")} />}
        </Aria.DateInput>
      </Aria.DateField>
    );
  }),
];
