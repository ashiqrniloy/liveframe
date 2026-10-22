import { isRecord } from "../formats/capabilities.ts";
import { styleProps } from "../formats/fixed.ts";
import type { Vocabulary } from "../formats/vocabulary.ts";
import { field, reject } from "./checks.ts";
import type { SchemaCheck } from "./schema.ts";

type StyleProp = (typeof styleProps)[number];
function choices(values: readonly string[]): SchemaCheck {
  const names = new Set(values);
  const expected = `one of: ${values.join(", ") || "no declared values"}`;
  return (value, at, sink) => (typeof value === "string" && names.has(value)) || reject(sink, at, expected);
}

export function compileStyles(vocabulary: Vocabulary): ReadonlyMap<StyleProp, SchemaCheck> {
  const space = choices(vocabulary.space);
  const lengths = new Set([...vocabulary.space, ...vocabulary.size]);
  const lengthExpected = `a declared space or size (${[...lengths].join(", ")}), or a fraction from 0fr to 12fr`;
  const measure = /^(\d+(?:\.\d+)?)(fr|ch|%)$/;
  const dimension: SchemaCheck = (value, at, sink) => {
    if (typeof value === "string") {
      if (lengths.has(value) || value === "fill" || value === "fit") return true;
      const match = measure.exec(value);
      if (match && Number(match[1]) <= (match[2] === "fr" ? 12 : 100)) return true;
    }
    return reject(sink, at, `${lengthExpected}, fill, fit, or a ch/% value from 0 to 100`);
  };
  const fraction = /^(\d+(?:\.\d+)?)fr$/;
  const track: SchemaCheck = (value, at, sink) => {
    if (typeof value === "string") {
      if (lengths.has(value)) return true;
      const match = fraction.exec(value);
      if (match && Number(match[1]) <= 12) return true;
    }
    return reject(sink, at, lengthExpected);
  };
  const tracks: SchemaCheck = (value, at, sink) => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 12)
      return reject(sink, at, "a list of 1 to 12 tracks");
    let valid = true;
    for (let i = 0; i < value.length; i++) {
      if (!field(track, value[i], sink, i)) valid = false;
      if (!valid && sink.errors.length >= sink.maxErrors) break;
    }
    return valid;
  };
  const areaRow = /^(?:[a-zA-Z][a-zA-Z0-9_-]*|\.)(?: (?:[a-zA-Z][a-zA-Z0-9_-]*|\.)){0,11}$/;
  const area: SchemaCheck = (value, at, sink) =>
    (Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 12 &&
      value.every((row) => typeof row === "string" && row.length <= 256 && areaRow.test(row))) ||
    reject(sink, at, "1 to 12 grid area rows, each at most 256 characters and 12 area names or dots");
  const number: SchemaCheck = (value, at, sink) =>
    (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) ||
    reject(sink, at, "a finite number from 0 to 100");
  const scalar = {
    padding: space,
    paddingX: space,
    paddingY: space,
    paddingTop: space,
    paddingRight: space,
    paddingBottom: space,
    paddingLeft: space,
    margin: space,
    marginX: space,
    marginY: space,
    marginTop: space,
    marginRight: space,
    marginBottom: space,
    marginLeft: space,
    gap: space,
    insetTop: space,
    insetBottom: space,
    direction: choices(["horizontal", "vertical"]),
    align: choices(["start", "center", "end", "stretch", "baseline"]),
    justify: choices(["start", "center", "end", "between", "around", "evenly"]),
    wrap: choices(["nowrap", "wrap"]),
    textAlign: choices(["start", "center", "end"]),
    position: choices(["static", "sticky"]),
    width: dimension,
    height: dimension,
    minWidth: dimension,
    maxWidth: dimension,
    grow: number,
    shrink: number,
    basis: number,
    columns: tracks,
    rows: tracks,
    area,
    surface: choices(vocabulary.surfaceRoles),
    fill: choices(vocabulary.fillableRoles),
    radius: choices([...vocabulary.radius, "full"]),
    textStyle: choices(vocabulary.typographyRoles),
    tone: choices(Object.keys(vocabulary.tones)),
  } satisfies Record<StyleProp, SchemaCheck>;
  const breakpoints = new Set(["base", ...vocabulary.breakpoints]);
  const breakpointExpected = `base first, followed by declared breakpoints: ${vocabulary.breakpoints.join(", ") || "none"}`;
  return new Map(
    styleProps.map((prop) => {
      const check = scalar[prop];
      const responsive: SchemaCheck = (value, at, sink) => {
        if (!isRecord(value)) return check(value, at, sink);
        let first = true;
        let valid = Object.hasOwn(value, "base") || reject(sink, at, breakpointExpected);
        for (const key in value) {
          if (!Object.hasOwn(value, key)) continue;
          if (first && key !== "base") valid = reject(sink, at, breakpointExpected);
          first = false;
          if (!breakpoints.has(key))
            valid = reject(sink, `${at}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, breakpointExpected);
          else if (!field(check, value[key], sink, key)) valid = false;
          if (!valid && sink.errors.length >= sink.maxErrors) break;
        }
        return valid;
      };
      return [prop, responsive];
    }),
  );
}
