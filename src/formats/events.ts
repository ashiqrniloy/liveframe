import type { LanguageSchema } from "../schema.ts";
import type { Definition } from "./catalog.ts";

export function carriesValue(carries: "number" | "integer", value: unknown): value is number;
export function carriesValue(carries: Definition["events"][string]["carries"] | undefined, value: unknown): boolean;
export function carriesValue(carries: Definition["events"][string]["carries"] | undefined, value: unknown): boolean {
  if (carries === "none") return value === undefined;
  if (carries === "number" || carries === "integer")
    return typeof value === "number" && Number.isFinite(value) && (carries !== "integer" || Number.isInteger(value));
  return carries !== undefined && typeof value === carries;
}

/** The schema an object or array carry checks its value against; scalar carries use `carriesValue`. */
export function carriesSchema(
  carries: Definition["events"][string]["carries"] | undefined,
): LanguageSchema | undefined {
  if (typeof carries !== "object") return undefined;
  if ("object" in carries) return carries.object;
  return { type: "array", items: carries.array.items, maxItems: carries.array.maxItems };
}
