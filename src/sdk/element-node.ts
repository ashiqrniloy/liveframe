// The structural checks every element-JSON node shares, whether its values are literals
// (`renderElements`) or expressions (`validateTemplate`, plan 028 Task 3): which fields a node may
// carry, how `props`/`style`/`events` merge into one flat prop set, and what a fragment may omit.
import type { LiveframeError } from "../errors.ts";
import { at } from "../internal.ts";
import { isRecord } from "../schema.ts";

/** Where a node's structural problems go: a pointer and what was expected. */
export type ElementReject = {
  at(pointer: string, expected: string): void;
  readonly stopped: boolean;
};

/** Collects `invalid-prop` errors up to a bound, as `renderElements` reports them. */
export class Reject implements ElementReject {
  readonly errors: LiveframeError[] = [];
  readonly maxErrors: number;
  stopped = false;

  constructor(maxErrors: number) {
    this.maxErrors = maxErrors;
  }

  at(pointer: string, expected: string): void {
    if (this.stopped) return;
    this.errors.push({ kind: "invalid-prop", pointer, expected, message: `Expected ${expected}` });
    if (this.errors.length >= this.maxErrors) this.stopped = true;
  }
}

export const ELEMENT_KEYS: ReadonlySet<string> = new Set([
  "kind",
  "key",
  "$anchor",
  "variant",
  "props",
  "style",
  "events",
  "children",
]);

/** A node may carry only the fields its format defines. */
export function rejectUnknownFields(
  value: Record<string, unknown>,
  pointer: string,
  allowed: ReadonlySet<string>,
  reject: ElementReject,
): void {
  for (const name in value)
    if (Object.hasOwn(value, name) && !allowed.has(name)) reject.at(at(pointer, name), "no such element field");
}

/** A fragment adds no node, so it carries only a key and children. */
export function rejectFragmentFields(value: Record<string, unknown>, pointer: string, reject: ElementReject): void {
  for (const name of ["$anchor", "variant", "props", "style", "events", "when", "bind"] as const)
    if (Object.hasOwn(value, name)) reject.at(at(pointer, name), `no ${name} on a fragment`);
}

function section(value: unknown, pointer: string, reject: ElementReject): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    reject.at(pointer, "an object");
    return undefined;
  }
  return value;
}

function merge(
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
  pointer: string,
  sectionName: string,
  reject: ElementReject,
): void {
  if (!source) return;
  for (const name in source) {
    if (!Object.hasOwn(source, name)) continue;
    if (name === "key" || name === "children" || name === "variant" || name === "$anchor")
      reject.at(at(pointer, name), `no ${name} in ${sectionName}`);
    else if (Object.hasOwn(target, name)) reject.at(at(pointer, name), "one property section per name");
    else target[name] = source[name];
  }
}

/**
 * The node's `props`, `style` and `events` as one flat record, which is how the SDK sees them: a
 * name belongs to one section, and the reserved names `key`, `children`, `variant` and `$anchor`
 * belong to none.
 */
export function mergeSections(
  value: Record<string, unknown>,
  pointer: string,
  reject: ElementReject,
): Record<string, unknown> | undefined {
  const props = section(value.props, at(pointer, "props"), reject);
  const style = section(value.style, at(pointer, "style"), reject);
  const events = section(value.events, at(pointer, "events"), reject);
  if (reject.stopped) return undefined;
  const merged: Record<string, unknown> = { ...props };
  for (const reserved of ["key", "children", "variant", "$anchor"] as const)
    if (Object.hasOwn(merged, reserved)) reject.at(at(at(pointer, "props"), reserved), `no ${reserved} in props`);
  merge(merged, style, at(pointer, "style"), "style", reject);
  merge(merged, events, at(pointer, "events"), "events", reject);
  return reject.stopped ? undefined : merged;
}
